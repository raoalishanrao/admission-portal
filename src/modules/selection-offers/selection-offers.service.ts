import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import { MeritFormulasService } from '../merit-formulas/merit-formulas.service.js';
import { OfferFeesService } from '../offer-fees/offer-fees.service.js';

type WorkbookRow = Record<string, unknown>;

export type UploadedWorkbookFile = {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype?: string;
};

type ApplicationLookupRow = {
  id: string;
  application_reference: string;
  application_status: string;
};

type AllocationDecision = {
  applicationRecordId: string;
  applicationReference: string;
  selectionStatus: 'SELECTED' | 'WAITING' | 'REJECTED';
  selectedProgrammeOfferingId: string | null;
  preferenceOrder: number | null;
  meritListItemId: string | null;
  reason: string | null;
};

@Injectable()
export class SelectionOffersService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly meritFormulas: MeritFormulasService,
    private readonly config: ConfigService,
    private readonly offerFees: OfferFeesService,
  ) {}

  private maxProgrammePreferences(): number {
    const raw = Number(
      this.config.get<string>('APPLICATION_MAX_PROGRAMME_PREFERENCES') ?? '2',
    );
    if (!Number.isFinite(raw) || raw < 2) return 2;
    return Math.min(Math.trunc(raw), 20);
  }

  admin(ctx: RequestContext) {
    if (!(ctx.roles ?? []).some((r) => ['ADMISSION_MANAGER', 'ADMISSIONS_ADMIN', 'ADMISSION_ADMIN'].includes(r.toUpperCase()))) throw new ForbiddenException('Admissions admin role is required');
  }
  private headers(row: WorkbookRow) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) result[key.toLowerCase().replace(/[\s_-]/g, '')] = value;
    return result;
  }
  private number(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
    return null;
  }

  /** Normalized workbook row → entry-test score fields (percentage derived when omitted). */
  private resolveEntryTestRow(r: Record<string, unknown>) {
    const ref = String(r.applicationreference ?? '').trim();
    const score =
      this.number(r.testscore) ??
      this.number(r.entrytestscore) ??
      this.number(r.entrytestmarks);
    const total = this.number(r.totalmarks);
    let pct = this.number(r.percentage);
    if (
      pct === null &&
      score !== null &&
      total !== null &&
      total > 0 &&
      score >= 0 &&
      score <= total
    ) {
      pct = Math.round((score / total) * 10000) / 100;
    }
    const status = String(r.resultstatus ?? '').trim().toUpperCase();
    const errors: string[] = [];
    if (!ref) errors.push('APPLICATION_REFERENCE_REQUIRED');
    if ((score === null) !== (total === null)) {
      errors.push('INVALID_SCORE_TOTAL_MARKS');
    } else if (
      score !== null &&
      (score < 0 || total! <= 0 || score > total!)
    ) {
      errors.push('INVALID_SCORE_TOTAL_MARKS');
    }
    if (pct === null) {
      errors.push('ENTRY_TEST_SCORE_OR_PERCENTAGE_REQUIRED');
    } else if (pct < 0 || pct > 100) {
      errors.push('PERCENTAGE_MUST_BE_0_TO_100');
    }
    if (!['PASS', 'FAIL'].includes(status)) {
      errors.push('RESULT_STATUS_MUST_BE_PASS_OR_FAIL');
    }
    return {
      ref,
      pct,
      score,
      total,
      status,
      remarks: r.remarks == null ? null : String(r.remarks).slice(0, 5000),
      errors,
    };
  }
  async upload(ctx: RequestContext, testSessionId: string, file: UploadedWorkbookFile) {
    this.admin(ctx);
    if (!file || file.size > 10 * 1024 * 1024) throw new BadRequestException('Provide an .xlsx file up to 10 MB');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) throw new BadRequestException('Only .xlsx workbooks are supported');
    let rawRows: WorkbookRow[];
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      if (!workbook.SheetNames.includes('RESULT')) throw new Error('Required RESULT worksheet is missing');
      rawRows = XLSX.utils.sheet_to_json<WorkbookRow>(workbook.Sheets.RESULT!, { defval: null, raw: true });
    } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Invalid Excel workbook'); }
    if (!rawRows.length) throw new BadRequestException('The RESULT worksheet contains no rows');
    if (rawRows.length > 10000) throw new BadRequestException('The workbook exceeds the 10,000 row limit');

    const session = await this.db.query(`SELECT s.id, s.intake_session_id AS "intakeId" FROM test_sessions s WHERE s.id=$1 AND s.tenant_id=$2 AND s.status IN ('PUBLISHED','CLOSED')`, [testSessionId, ctx.tenantId]);
    if (!session[0]) throw new NotFoundException('Published/closed test session not found for tenant');
    const mapped = rawRows.map((raw, index) => {
      const parsed = this.resolveEntryTestRow(this.headers(raw));
      return {
        index,
        raw,
        ref: parsed.ref,
        pct: parsed.pct,
        score: parsed.score,
        total: parsed.total,
        status: parsed.status,
        remarks: parsed.remarks,
        errors: parsed.errors,
      };
    });
    const duplicates = new Set<string>(); const seen = new Set<string>();
    for (const row of mapped) { if (row.ref && seen.has(row.ref)) duplicates.add(row.ref); if (row.ref) seen.add(row.ref); }
    for (const row of mapped) if (duplicates.has(row.ref)) row.errors.push('DUPLICATE_APPLICATION_REFERENCE_IN_FILE');

    for (const row of mapped) {
      if (!row.ref || row.errors.length) continue;
      const app = await this.db.query(`SELECT a.id,a.application_status FROM applications a WHERE a.tenant_id=$1 AND a.application_reference=$2 AND a.intake_id=$3`, [ctx.tenantId,row.ref,session[0].intakeId]);
      if (!app[0]) { row.errors.push('APPLICATION_NOT_FOUND_IN_INTAKE'); continue; }
      const eligibility = await this.db.query(`SELECT 1 FROM application_attendance aa WHERE aa.tenant_id=$1 AND aa.applicant_id=$2 AND aa.test_session_id=$3 AND aa.attendance_status='PRESENT' AND aa.identity_verified=TRUE AND aa.result_awaited_at IS NOT NULL`, [ctx.tenantId,app[0].id,testSessionId]);
      if (!eligibility.length) row.errors.push('VERIFIED_RESULT_AWAITED_ATTENDANCE_REQUIRED');
      const option = await this.db.query(`SELECT 1 FROM application_programme_options apo JOIN programme_offerings po ON po.id=apo.programme_offering_id JOIN test_session_offerings tso ON tso.test_session_id=$2 AND tso.programme_offering_id=po.id AND tso.tenant_id=po.tenant_id WHERE apo.tenant_id=$1 AND apo.applicant_id=$3 AND po.intake_id=$4 AND po.offering_status='PUBLISHED' LIMIT 1`, [ctx.tenantId,testSessionId,app[0].id,session[0].intakeId]);
      if (!option.length) row.errors.push('NO_SELECTED_OFFERING_FOR_TEST_SESSION');
      row['applicationRecordId' as keyof typeof row] = app[0].id as never;
    }
    const valid = mapped.filter((r) => !r.errors.length).length; const invalid = mapped.length - valid;
    const sha = createHash('sha256').update(file.buffer).digest('hex');
    return this.db.transaction(async (m) => {
      const ins = await m.query(`INSERT INTO result_imports(tenant_id,intake_session_id,test_session_id,file_name,file_sha256,status,total_rows,valid_rows,invalid_rows,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [ctx.tenantId,session[0].intakeId,testSessionId,file.originalname.slice(0,255),sha,invalid?'VALIDATION_FAILED':'READY_TO_CONFIRM',mapped.length,valid,invalid,ctx.userId]);
      const id = ins[0].id;
      for (const r of mapped) await m.query(`INSERT INTO result_import_rows(tenant_id,import_id,row_number,application_reference,application_record_id,raw_data,test_score,total_marks,percentage,result_status,remarks,validation_status,validation_errors) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [ctx.tenantId,id,r.index+2,r.ref || `ROW-${r.index+2}`, (r as any).applicationRecordId ?? null,JSON.stringify(r.raw),r.score,r.total,r.pct,r.status||null,r.remarks,r.errors.length?'INVALID':'VALID',JSON.stringify(r.errors)]);
      return { id, status: invalid?'VALIDATION_FAILED':'READY_TO_CONFIRM', totalRows:mapped.length, validRows:valid, invalidRows:invalid };
    });
  }

  async getImport(ctx: RequestContext, id: string) { this.admin(ctx); const rows=await this.db.query('SELECT * FROM result_imports WHERE tenant_id=$1 AND id=$2',[ctx.tenantId,id]); if(!rows[0]) throw new NotFoundException('Result import not found'); return rows[0]; }
  async importRows(ctx: RequestContext,id:string,page=1,limit=20) { this.admin(ctx); const batch=await this.getImport(ctx,id); const [items,count]=await Promise.all([this.db.query(`SELECT * FROM result_import_rows WHERE tenant_id=$1 AND import_id=$2 ORDER BY row_number LIMIT $3 OFFSET $4`,[ctx.tenantId,id,limit,(page-1)*limit]),this.db.query(`SELECT count(*)::int AS total FROM result_import_rows WHERE tenant_id=$1 AND import_id=$2`,[ctx.tenantId,id])]); return {items,meta:{page,limit,total:count[0].total,totalPages:Math.ceil(count[0].total/limit)}}; }
  async confirmImport(ctx:RequestContext,id:string,correctionReason?:string) { this.admin(ctx); return this.db.transaction(async m=>{ const b=(await m.query(`SELECT * FROM result_imports WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[ctx.tenantId,id]))[0]; if(!b) throw new NotFoundException('Result import not found'); if(b.status==='CONFIRMED') return b; if(b.status!=='READY_TO_CONFIRM'||Number(b.invalid_rows)>0) throw new UnprocessableEntityException({code:'IMPORT_NOT_CONFIRMABLE',message:'All rows must be valid before confirmation'}); const rows=await m.query(`SELECT * FROM result_import_rows WHERE tenant_id=$1 AND import_id=$2 ORDER BY row_number FOR UPDATE`,[ctx.tenantId,id]); for(const row of rows){ const prior=(await m.query(`SELECT id,revision FROM application_entry_test_results WHERE tenant_id=$1 AND application_record_id=$2 AND test_session_id=$3 AND is_current FOR UPDATE`,[ctx.tenantId,row.application_record_id,b.test_session_id]))[0]; if(prior&&!correctionReason?.trim()) throw new ConflictException({code:'RESULT_ALREADY_EXISTS',message:'Existing result requires a documented correctionReason to replace'}); if(prior) await m.query(`UPDATE application_entry_test_results SET is_current=FALSE WHERE id=$1`,[prior.id]); const revision=prior?Number(prior.revision)+1:1; await m.query(`INSERT INTO application_entry_test_results(tenant_id,application_record_id,application_reference,test_session_id,test_score,total_marks,percentage,result_status,remarks,import_id,revision,supersedes_result_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[ctx.tenantId,row.application_record_id,row.application_reference,b.test_session_id,row.test_score,row.total_marks,row.percentage,row.result_status,row.remarks,id,revision,prior?.id??null,ctx.userId]); await m.query(`UPDATE result_import_rows SET validation_status='COMMITTED' WHERE id=$1`,[row.id]); } return (await m.query(`UPDATE result_imports SET status='CONFIRMED',confirmed_by=$3,confirmed_at=now(),correction_reason=$4 WHERE tenant_id=$1 AND id=$2 RETURNING *`,[ctx.tenantId,id,ctx.userId,correctionReason?.trim()??null]))[0]; }); }
  async publishResults(ctx: RequestContext, testSessionId: string) {
    this.admin(ctx);
    const rows = await this.db.query(
      `UPDATE application_entry_test_results
       SET published_at = COALESCE(published_at, now()),
           published_by = COALESCE(published_by, $3)
       WHERE tenant_id = $1 AND test_session_id = $2 AND is_current
       RETURNING id`,
      [ctx.tenantId, testSessionId, ctx.userId],
    );

    const intake = (
      await this.db.query(
        `SELECT i.id, i.merit_generation_mode
         FROM intakes i
         JOIN test_sessions s ON s.intake_session_id = i.id
         WHERE s.tenant_id = $1 AND s.id = $2
         LIMIT 1`,
        [ctx.tenantId, testSessionId],
      )
    )[0] as { id: string; merit_generation_mode: string } | undefined;

    const autoMerit: Array<{
      programmeOfferingId: string;
      meritListId?: string;
      status: 'GENERATED' | 'SKIPPED' | 'FAILED';
      message?: string;
    }> = [];

    if (intake?.merit_generation_mode === 'AUTO') {
      const offerings = await this.db.query(
        `SELECT DISTINCT po.id
         FROM programme_offerings po
         JOIN test_session_offerings tso
           ON tso.programme_offering_id = po.id AND tso.tenant_id = po.tenant_id
         WHERE po.tenant_id = $1
           AND po.intake_id = $2
           AND tso.test_session_id = $3
           AND po.offering_status = 'PUBLISHED'
           AND po.seat_capacity IS NOT NULL
           AND po.seat_capacity > 0`,
        [ctx.tenantId, intake.id, testSessionId],
      );
      for (const row of offerings as Array<{ id: string }>) {
        try {
          const list = await this.generateMerit(ctx, testSessionId, row.id);
          autoMerit.push({
            programmeOfferingId: row.id,
            meritListId: list?.id,
            status: 'GENERATED',
          });
        } catch (err) {
          autoMerit.push({
            programmeOfferingId: row.id,
            status: 'FAILED',
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return {
      testSessionId,
      publishedCount: rows.length,
      meritGenerationMode: intake?.merit_generation_mode ?? 'MANUAL',
      autoMerit,
    };
  }
  async applicantResults(ctx:RequestContext,userId:string) {
    const rows = await this.db.query(
      `SELECT r.id,
              r.application_reference AS "applicationReference",
              r.test_session_id AS "testSessionId",
              r.test_score AS "testScore",
              r.total_marks AS "totalMarks",
              r.percentage,
              r.result_status AS "resultStatus",
              r.published_at AS "publishedAt",
              s.test_date AS "testDate",
              s.reporting_time AS "reportingTime",
              s.test_time AS "testTime",
              s.room AS "room",
              c.centre_name AS "centreName",
              c.location AS "centreLocation",
              CASE
                WHEN c.centre_name IS NULL THEN NULL
                ELSE CONCAT(c.centre_name, ', ', c.location)
              END AS "testVenue"
       FROM application_entry_test_results r
       JOIN applications a ON a.id = r.application_record_id
       LEFT JOIN test_sessions s
         ON s.id = r.test_session_id
        AND s.tenant_id = r.tenant_id
       LEFT JOIN test_centres c
         ON c.id = s.test_centre_id
        AND c.tenant_id = s.tenant_id
       WHERE r.tenant_id = $1
         AND a.iam_user_id = $2
         AND r.is_current
         AND r.published_at IS NOT NULL
       ORDER BY r.published_at DESC`,
      [ctx.tenantId, userId],
    );
    return rows;
  }
  async getResult(ctx:RequestContext,id:string){this.admin(ctx);const r=await this.db.query(`SELECT * FROM application_entry_test_results WHERE tenant_id=$1 AND id=$2`,[ctx.tenantId,id]);if(!r[0])throw new NotFoundException('Result not found');return r[0];}

  async generateMerit(
    ctx: RequestContext,
    testSessionId: string,
    offeringId: string,
  ) {
    this.admin(ctx);
    const formula = await this.meritFormulas.resolveFormulaSnapshot(
      ctx.tenantId,
      offeringId,
    );

    return this.db.transaction(async (m) => {
      const off = (
        await m.query(
          `SELECT po.*, s.intake_session_id
           FROM programme_offerings po
           JOIN test_session_offerings tso
             ON tso.programme_offering_id = po.id
            AND tso.tenant_id = po.tenant_id
            AND tso.test_session_id = $2
           JOIN test_sessions s
             ON s.id = tso.test_session_id
            AND s.tenant_id = tso.tenant_id
           WHERE po.tenant_id = $1 AND po.id = $3
             AND po.offering_status = 'PUBLISHED'
             AND po.intake_id = s.intake_session_id
             AND s.status IN ('PUBLISHED', 'CLOSED')
           LIMIT 1`,
          [ctx.tenantId, testSessionId, offeringId],
        )
      )[0];
      if (!off) {
        throw new NotFoundException(
          'Published offering is not associated with this session and intake',
        );
      }
      if (!off.seat_capacity || off.seat_capacity < 1) {
        throw new UnprocessableEntityException({
          code: 'OFFERING_CAPACITY_NOT_CONFIGURED',
          message: 'Configure a positive seat capacity before generating merit',
        });
      }

      const imp = (
        await m.query(
          `SELECT id FROM result_imports
           WHERE tenant_id = $1 AND test_session_id = $2 AND status = 'CONFIRMED'
           ORDER BY confirmed_at DESC LIMIT 1`,
          [ctx.tenantId, testSessionId],
        )
      )[0];
      if (!imp) {
        throw new UnprocessableEntityException(
          'Confirm a result import before generating merit',
        );
      }

      const last = (
        await m.query(
          `SELECT COALESCE(MAX(list_version), 0)::int AS v
           FROM programme_merit_lists
           WHERE tenant_id = $1 AND test_session_id = $2 AND programme_offering_id = $3`,
          [ctx.tenantId, testSessionId, offeringId],
        )
      )[0];

      const list = (
        await m.query(
          `INSERT INTO programme_merit_lists(
             tenant_id, intake_session_id, test_session_id, programme_offering_id,
             list_version, capacity_snapshot, source_import_id, generated_by, formula_snapshot
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
           RETURNING *`,
          [
            ctx.tenantId,
            off.intake_id,
            testSessionId,
            offeringId,
            last.v + 1,
            off.seat_capacity,
            imp.id,
            ctx.userId,
            JSON.stringify(formula),
          ],
        )
      )[0];

      const candidates = await m.query(
        `SELECT r.id AS result_id,
                r.application_record_id,
                r.application_reference,
                r.test_score,
                r.total_marks,
                r.percentage,
                apo.preference_order
         FROM application_entry_test_results r
         JOIN applications a ON a.id = r.application_record_id
         JOIN application_programme_options apo
           ON apo.applicant_id = a.id
          AND apo.tenant_id = a.tenant_id
          AND apo.programme_offering_id = $3
         JOIN programme_offerings po ON po.id = apo.programme_offering_id
         JOIN test_session_offerings tso
           ON tso.tenant_id = po.tenant_id
          AND tso.test_session_id = r.test_session_id
          AND tso.programme_offering_id = po.id
         WHERE r.tenant_id = $1
           AND r.test_session_id = $2
           AND r.is_current
           AND r.result_status = 'PASS'
           AND a.application_status = 'APPROVED'
           AND po.intake_id = $4`,
        [ctx.tenantId, testSessionId, offeringId, off.intake_id],
      );

      const appIds = candidates.map(
        (c: { application_record_id: string }) => c.application_record_id,
      );
      const academics =
        appIds.length === 0
          ? []
          : await m.query(
              `SELECT applicant_id, degree_type, percentage
               FROM application_academic_information
               WHERE tenant_id = $1 AND applicant_id = ANY($2::uuid[])`,
              [ctx.tenantId, appIds],
            );
      const academicsByApp = new Map<
        string,
        Array<{ degreeType: string; percentage: number }>
      >();
      for (const row of academics) {
        const listForApp = academicsByApp.get(row.applicant_id) ?? [];
        listForApp.push({
          degreeType: row.degree_type,
          percentage: Number(row.percentage),
        });
        academicsByApp.set(row.applicant_id, listForApp);
      }

      type ScoredCandidate = {
        result_id: string;
        application_record_id: string;
        application_reference: string;
        test_score: number | string | null;
        total_marks: number | string | null;
        percentage: number | string;
        preference_order: number;
        meritScore: number;
        breakdown: unknown;
        incomplete: boolean;
      };

      const scored: ScoredCandidate[] = candidates.map(
        (c: {
          result_id: string;
          application_record_id: string;
          application_reference: string;
          test_score: number | string | null;
          total_marks: number | string | null;
          percentage: number | string;
          preference_order: number;
        }) => {
          const score = this.meritFormulas.computeMeritScore(
            formula,
            academicsByApp.get(c.application_record_id) ?? [],
            Number(c.percentage),
          );
          return { ...c, ...score };
        },
      );

      scored.sort((a, b) => {
        if (b.meritScore !== a.meritScore) return b.meritScore - a.meritScore;
        const pctDiff = Number(b.percentage) - Number(a.percentage);
        if (pctDiff !== 0) return pctDiff;
        return String(a.application_reference).localeCompare(
          String(b.application_reference),
        );
      });

      let rank = 0;
      let prevScore: number | null = null;
      let position = 0;
      for (const c of scored) {
        position += 1;
        if (prevScore === null || c.meritScore !== prevScore) rank = position;
        prevScore = c.meritScore;
        await m.query(
          `INSERT INTO programme_merit_list_items(
             tenant_id, merit_list_id, result_id, application_record_id,
             application_reference, preference_order, merit_rank, percentage,
             score_snapshot, total_marks_snapshot, merit_score, score_breakdown
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [
            ctx.tenantId,
            list.id,
            c.result_id,
            c.application_record_id,
            c.application_reference,
            c.preference_order,
            rank,
            c.percentage,
            c.test_score,
            c.total_marks,
            c.meritScore,
            JSON.stringify(c.breakdown),
          ],
        );
      }

      return {
        ...list,
        candidateCount: scored.length,
        formulaSnapshot: formula,
      };
    });
  }

  async approveMerit(ctx:RequestContext,id:string) { this.admin(ctx); const r=await this.db.query(`UPDATE programme_merit_lists SET status='APPROVED',approved_by=$3,approved_at=now() WHERE tenant_id=$1 AND id=$2 AND status='DRAFT' RETURNING *`,[ctx.tenantId,id,ctx.userId]); if(!r[0]) throw new NotFoundException('Draft merit list not found'); return r[0]; }
  async meritDetails(ctx:RequestContext,id:string,page=1,limit=20){this.admin(ctx);const list=(await this.db.query(`SELECT * FROM programme_merit_lists WHERE tenant_id=$1 AND id=$2`,[ctx.tenantId,id]))[0];if(!list)throw new NotFoundException('Merit list not found');const [items,c]=await Promise.all([this.db.query(`SELECT * FROM programme_merit_list_items WHERE tenant_id=$1 AND merit_list_id=$2 ORDER BY merit_rank,application_reference LIMIT $3 OFFSET $4`,[ctx.tenantId,id,limit,(page-1)*limit]),this.db.query(`SELECT count(*)::int total FROM programme_merit_list_items WHERE tenant_id=$1 AND merit_list_id=$2`,[ctx.tenantId,id])]);return {...list,items,meta:{page,limit,total:c[0].total,totalPages:Math.ceil(c[0].total/limit)}};}
  async publishMerit(ctx:RequestContext,id:string) { this.admin(ctx); const r=await this.db.query(`UPDATE programme_merit_lists SET status='PUBLISHED',published_by=$3,published_at=now() WHERE tenant_id=$1 AND id=$2 AND status='APPROVED' RETURNING *`,[ctx.tenantId,id,ctx.userId]); if(!r[0]) throw new NotFoundException('Approved merit list not found'); return r[0]; }

  async previewAllocation(
    ctx: RequestContext,
    intakeId: string,
    sessionId: string,
  ) {
    this.admin(ctx);
    const maxPref = this.maxProgrammePreferences();

    return this.db.transaction(async (m) => {
      const lists = await m.query(
        `SELECT ml.*, po.seat_capacity
         FROM programme_merit_lists ml
         JOIN programme_offerings po ON po.id = ml.programme_offering_id
         WHERE ml.tenant_id = $1
           AND ml.intake_session_id = $2
           AND ml.test_session_id = $3
           AND ml.status IN ('APPROVED', 'PUBLISHED')
         ORDER BY ml.programme_offering_id, ml.list_version DESC`,
        [ctx.tenantId, intakeId, sessionId],
      );
      const latest = new Map<string, any>();
      for (const l of lists) {
        if (!latest.has(l.programme_offering_id)) {
          latest.set(l.programme_offering_id, l);
        }
      }
      if (!latest.size) {
        throw new UnprocessableEntityException(
          'Approve merit lists for this test session before allocation',
        );
      }
      const offers = [...latest.values()];
      if (
        offers.some(
          (o) =>
            !o.seat_capacity ||
            Number(o.seat_capacity) !== Number(o.capacity_snapshot),
        )
      ) {
        throw new ConflictException(
          'Offering capacity changed after merit generation; regenerate affected merit lists',
        );
      }

      const listIds = offers.map((o) => o.id);
      const all = await m.query(
        `SELECT a.id AS app_id,
                a.application_reference,
                po.id AS offering_id,
                apo.preference_order,
                mi.id AS item_id,
                mi.percentage,
                mi.merit_score,
                mi.merit_rank,
                ml.id AS merit_list_id,
                ml.list_version
         FROM application_programme_options apo
         JOIN applications a ON a.id = apo.applicant_id
         JOIN programme_offerings po ON po.id = apo.programme_offering_id
         JOIN test_session_offerings tso
           ON tso.tenant_id = po.tenant_id
          AND tso.programme_offering_id = po.id
          AND tso.test_session_id = $3
         JOIN programme_merit_list_items mi
           ON mi.application_record_id = a.id AND mi.tenant_id = a.tenant_id
         JOIN programme_merit_lists ml
           ON ml.id = mi.merit_list_id
          AND ml.programme_offering_id = po.id
          AND ml.id = ANY($4::uuid[])
         WHERE a.tenant_id = $1 AND a.intake_id = $2 AND ml.test_session_id = $3
         ORDER BY apo.preference_order, mi.merit_rank`,
        [ctx.tenantId, intakeId, sessionId, listIds],
      );

      const byApp = new Map<string, any[]>();
      for (const x of all) {
        const arr = byApp.get(x.app_id) ?? [];
        arr.push({
          ...x,
          preference_order: Number(x.preference_order),
          merit_score:
            x.merit_score != null ? Number(x.merit_score) : Number(x.percentage),
        });
        byApp.set(x.app_id, arr);
      }

      const capacities = new Map(
        offers.map((o) => [
          o.programme_offering_id,
          Number(o.capacity_snapshot),
        ]),
      );
      const selected = new Map<string, any>();
      const waiting = new Set<string>();

      const scoreOf = (c: {
        choice: { merit_score: number; percentage: number };
      }) => Number(c.choice.merit_score ?? c.choice.percentage);

      for (let pref = 1; pref <= maxPref; pref += 1) {
        const candidates = [...byApp.entries()]
          .filter(
            ([app, items]) =>
              !selected.has(app) &&
              items.some((x) => x.preference_order === pref),
          )
          .map(([app, items]) => ({
            app,
            choice: items.find((x) => x.preference_order === pref)!,
          }))
          .sort((a, b) => {
            const diff = scoreOf(b) - scoreOf(a);
            if (diff !== 0) return diff;
            return Number(b.choice.percentage) - Number(a.choice.percentage);
          });

        const groups = new Map<number, typeof candidates>();
        for (const c of candidates) {
          const key = scoreOf(c);
          const arr = groups.get(key) ?? [];
          arr.push(c);
          groups.set(key, arr);
        }

        for (const [, group] of groups) {
          for (const cand of group) {
            const cap = capacities.get(cand.choice.offering_id) ?? 0;
            const used = [...selected.values()].filter(
              (x) => x.choice.offering_id === cand.choice.offering_id,
            ).length;
            if (used < cap) selected.set(cand.app, cand);
            else waiting.add(cand.app);
          }
        }
      }

      const appIds = [...byApp.keys()];
      const existing = (await m.query(
        `SELECT a.id, a.application_reference, a.application_status
         FROM applications a
         WHERE a.tenant_id = $1 AND a.intake_id = $2 AND a.id = ANY($3::uuid[])`,
        [ctx.tenantId, intakeId, appIds],
      )) as ApplicationLookupRow[];

      const decisions: AllocationDecision[] = existing
        .filter((a) => a.application_status === 'APPROVED')
        .map((a) => {
          const s = selected.get(a.id);
          return {
            applicationRecordId: a.id,
            applicationReference: a.application_reference,
            selectionStatus: s
              ? 'SELECTED'
              : waiting.has(a.id)
                ? 'WAITING'
                : 'REJECTED',
            selectedProgrammeOfferingId: s?.choice.offering_id ?? null,
            preferenceOrder: s?.choice.preference_order ?? null,
            meritListItemId: s?.choice.item_id ?? null,
            reason: s
              ? null
              : waiting.has(a.id)
                ? 'Eligible but outside current capacity'
                : 'No qualifying available preference',
          };
        });

      const ver =
        (
          await m.query(
            `SELECT COALESCE(MAX(allocation_version), 0)::int v
             FROM application_selection_allocations
             WHERE tenant_id = $1 AND intake_session_id = $2 AND test_session_id = $3`,
            [ctx.tenantId, intakeId, sessionId],
          )
        )[0].v + 1;
      const key = `preview:${ctx.userId}:${sessionId}:${ver}:${Date.now()}`;
      const allocation = (
        await m.query(
          `INSERT INTO application_selection_allocations(
             tenant_id, intake_session_id, test_session_id, allocation_version,
             status, source_merit_list_versions, idempotency_key, created_by
           ) VALUES ($1,$2,$3,$4,'PREVIEW',$5::jsonb,$6,$7)
           RETURNING *`,
          [
            ctx.tenantId,
            intakeId,
            sessionId,
            ver,
            JSON.stringify(
              offers.map((o) => ({
                meritListId: o.id,
                offeringId: o.programme_offering_id,
                version: o.list_version,
              })),
            ),
            key,
            ctx.userId,
          ],
        )
      )[0];

      for (const d of decisions) {
        await m.query(
          `INSERT INTO application_selection_allocation_items(
             tenant_id, allocation_id, application_record_id, application_reference,
             selection_status, selected_programme_offering_id, preference_order,
             merit_list_item_id, reason
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            ctx.tenantId,
            allocation.id,
            d.applicationRecordId,
            d.applicationReference,
            d.selectionStatus,
            d.selectedProgrammeOfferingId,
            d.preferenceOrder,
            d.meritListItemId,
            d.reason,
          ],
        );
      }

      return {
        allocationId: allocation.id,
        allocationVersion: ver,
        status: 'PREVIEW',
        selectedCount: decisions.filter((d) => d.selectionStatus === 'SELECTED')
          .length,
        waitingCount: decisions.filter((d) => d.selectionStatus === 'WAITING')
          .length,
        rejectedCount: decisions.filter((d) => d.selectionStatus === 'REJECTED')
          .length,
        items: decisions,
      };
    });
  }

  async confirmAllocation(ctx:RequestContext,id:string,version:number,key:string) { this.admin(ctx); if(!key?.trim()||key.length>100) throw new BadRequestException('Idempotency-Key header is required (maximum 100 characters)'); return this.db.transaction(async m=>{const a=(await m.query(`SELECT * FROM application_selection_allocations WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[ctx.tenantId,id]))[0]; if(!a)throw new NotFoundException('Allocation not found'); if(a.status==='CONFIRMED')return a; if(a.status!=='PREVIEW'||Number(a.allocation_version)!==version)throw new ConflictException('Allocation preview is stale or not confirmable'); const prev=await m.query(`SELECT id FROM application_selection_allocations WHERE tenant_id=$1 AND intake_session_id=$2 AND test_session_id=$3 AND status='CONFIRMED' FOR UPDATE`,[ctx.tenantId,a.intake_session_id,a.test_session_id]); if(prev[0])await m.query(`UPDATE application_selection_allocations SET status='SUPERSEDED' WHERE id=$1`,[prev[0].id]); const items=await m.query(`SELECT * FROM application_selection_allocation_items WHERE tenant_id=$1 AND allocation_id=$2 ORDER BY application_record_id FOR UPDATE`,[ctx.tenantId,id]); for(const item of items){ await m.query(`UPDATE applications SET selection_status=$3,selected_programme_offering_id=$4,selection_at=now(),selection_by=$5,selection_reason=$6 WHERE tenant_id=$1 AND id=$2`,[ctx.tenantId,item.application_record_id,item.selection_status,item.selected_programme_offering_id,ctx.userId,item.reason]); } await m.query(`UPDATE programme_merit_list_items mi SET selection_status=ai.selection_status,final_selection=(ai.selection_status='SELECTED') FROM application_selection_allocation_items ai WHERE ai.tenant_id=$1 AND ai.allocation_id=$2 AND ai.merit_list_item_id=mi.id`,[ctx.tenantId,id]); return (await m.query(`UPDATE application_selection_allocations SET status='CONFIRMED',idempotency_key=$3,confirmed_at=now(),supersedes_allocation_id=$4 WHERE tenant_id=$1 AND id=$2 RETURNING *`,[ctx.tenantId,id,key,prev[0]?.id??null]))[0]; }); }

  async allocation(ctx:RequestContext,id:string) { this.admin(ctx); const r=await this.db.query(`SELECT * FROM application_selection_allocations WHERE tenant_id=$1 AND id=$2`,[ctx.tenantId,id]); if(!r[0])throw new NotFoundException('Allocation not found'); return r[0]; }
  async allocationItems(ctx:RequestContext,id:string,page=1,limit=20) { this.admin(ctx); await this.allocation(ctx,id); const [items,c]=await Promise.all([this.db.query(`SELECT * FROM application_selection_allocation_items WHERE tenant_id=$1 AND allocation_id=$2 ORDER BY application_reference LIMIT $3 OFFSET $4`,[ctx.tenantId,id,limit,(page-1)*limit]),this.db.query(`SELECT count(*)::int total FROM application_selection_allocation_items WHERE tenant_id=$1 AND allocation_id=$2`,[ctx.tenantId,id])]);return {items,meta:{page,limit,total:c[0].total,totalPages:Math.ceil(c[0].total/limit)}};}

  async authorizeOffer(ctx:RequestContext,applicationId:string,dto:any) { this.admin(ctx); return this.db.transaction(async m=>{const app=(await m.query(`SELECT a.*,i.offer_payment_period_days FROM applications a JOIN intakes i ON i.id=a.intake_id WHERE a.tenant_id=$1 AND a.id=$2 FOR UPDATE`,[ctx.tenantId,applicationId]))[0]; if(!app)throw new NotFoundException('Application not found'); if(app.selection_status!=='SELECTED'||!app.selected_programme_offering_id)throw new UnprocessableEntityException('Only selected applicants can receive an offer'); const deadline=new Date(Date.now()+Number(app.offer_payment_period_days)*86400000); const r=await m.query(`INSERT INTO admission_offers(tenant_id,application_record_id,programme_offering_id,offer_type,offer_conditions,acceptance_deadline,fee_payment_instructions,offer_letter_document,authorized_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[ctx.tenantId,app.id,app.selected_programme_offering_id,dto.offerType,dto.offerConditions??null,deadline,dto.feePaymentInstructions??null,dto.offerLetterDocument,ctx.userId]); return r[0];}); }
  async publishOffer(ctx:RequestContext,applicationId:string) {
    this.admin(ctx);
    const authorized = (
      await this.db.query(
        `SELECT * FROM admission_offers
         WHERE tenant_id=$1 AND application_record_id=$2 AND status='AUTHORIZED'
         ORDER BY created_at DESC
         LIMIT 1`,
        [ctx.tenantId, applicationId],
      )
    )[0];
    if (!authorized) {
      throw new NotFoundException('Authorized offer not found');
    }
    // Generate challan while still AUTHORIZED so a fee-config failure cannot
    // leave a PUBLISHED offer without a payable challan.
    const challan = await this.offerFees.generateForOffer(ctx.tenantId, {
      id: authorized.id,
      application_record_id: authorized.application_record_id,
      programme_offering_id: authorized.programme_offering_id,
      acceptance_deadline: authorized.acceptance_deadline,
    });
    const offer = (
      await this.db.query(
        `UPDATE admission_offers
         SET status='PUBLISHED', published_at=now(), offer_issue_date=now(), updated_at=now()
         WHERE tenant_id=$1 AND id=$2 AND status='AUTHORIZED'
         RETURNING *`,
        [ctx.tenantId, authorized.id],
      )
    )[0];
    if (!offer) {
      throw new ConflictException('Offer could not be published (status changed)');
    }
    return { ...offer, feeChallan: challan };
  }
  async getOffer(ctx:RequestContext,applicationId:string) { const r=await this.db.query(`SELECT * FROM admission_offers WHERE tenant_id=$1 AND application_record_id=$2 AND status IN ('PUBLISHED','ACCEPTED','DECLINED','EXPIRED') ORDER BY created_at DESC LIMIT 1`,[ctx.tenantId,applicationId]); if(!r[0])throw new NotFoundException('Published offer not found');return r[0]; }
  async applicantOffer(ctx:RequestContext,userId:string) {
    const r = await this.db.query(
      `SELECT o.*
       FROM admission_offers o
       JOIN applications a ON a.id = o.application_record_id
       WHERE o.tenant_id = $1
         AND a.iam_user_id = $2
         AND o.status IN ('PUBLISHED','ACCEPTED','DECLINED','EXPIRED')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [ctx.tenantId, userId],
    );
    const offer = r[0];
    if (!offer) throw new NotFoundException('Published offer not found');
    const bundle = await this.offerFees.getOfferFeeBundle(
      ctx.tenantId,
      offer.application_record_id,
      { ensureIfPublished: true },
    );
    return {
      ...offer,
      feeChallan: bundle.challan,
      currentEvidence: bundle.currentEvidence,
    };
  }
  async receiveOfferEvent(ctx:RequestContext,event:any) { const client=await this.db.query(`SELECT current_setting('app.service_client',true) AS client`); void client; const status=event.responseStatus; return this.db.transaction(async m=>{const old=(await m.query(`SELECT * FROM admission_offers WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[ctx.tenantId,event.offerId]))[0]; if(!old)throw new NotFoundException('Offer not found'); const existed=await m.query(`SELECT event_id FROM admission_offer_events WHERE event_id=$1`,[event.eventId]); if(existed.length)return {offerId:old.id,status:old.status,idempotent:true}; if(old.application_record_id!==event.applicationRecordId)throw new BadRequestException('Offer/application mismatch'); if(old.status!== 'PUBLISHED')throw new ConflictException('Offer response can only transition from PUBLISHED'); await m.query(`INSERT INTO admission_offer_events(event_id,tenant_id,offer_id,event_version,event_type,payload,occurred_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,[event.eventId,ctx.tenantId,event.offerId,event.eventVersion,event.eventType,JSON.stringify(event),event.occurredAt]); const updated=(await m.query(`UPDATE admission_offers SET status=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' RETURNING *`,[ctx.tenantId,event.offerId,status]))[0]; return updated; }); }
}
