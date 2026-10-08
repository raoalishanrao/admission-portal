import { ConflictException, ForbiddenException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, In, Repository } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ApplicationAdmitCardEntity, ApplicationAttendanceAuditEntity, ApplicationAttendanceEntity, ApplicationAttendanceScanEntity, ApplicationContactEntity, ApplicationEntity, ApplicationEntryTestOutcomeEntity, ApplicationProgrammeOptionEntity, IntakeEntity, ProgrammeOfferingEntity, TestCentreEntity, TestSessionEntity, TestSessionOfferingEntity } from '../../database/entities/index.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../integrations/storage/object-storage.interface.js';
import type { AssignAdmitCardSessionDto, CreateTestCentreDto, MarkAttendanceDto, RecordOutcomeDto, TestSessionDto, UpdateTestCentreDto, UpdateTestSessionDto } from './dto/entry-test.dto.js';

// Match the admissions-admin role aliases already used by application review
// and document verification. Applicant access is handled separately by ownership.
const ADMISSIONS_ADMIN_ROLES = new Set([
  'ADMISSION_ADMIN',
  'ADMISSION_MANAGER',
  'ADMISSIONS_MANAGER',
  'ADMISSIONS_ADMIN',
  'ADMISSIONS_OFFICER',
  'ADMIN',
  'SUPER_ADMIN',
]);

@Injectable()
export class EntryTestService {
  constructor(
    @InjectRepository(TestCentreEntity) private readonly centres: Repository<TestCentreEntity>,
    @InjectRepository(TestSessionEntity) private readonly sessions: Repository<TestSessionEntity>,
    @InjectRepository(TestSessionOfferingEntity) private readonly sessionOfferings: Repository<TestSessionOfferingEntity>,
    @InjectRepository(ApplicationAdmitCardEntity) private readonly cards: Repository<ApplicationAdmitCardEntity>,
    @InjectRepository(ApplicationAttendanceEntity) private readonly attendance: Repository<ApplicationAttendanceEntity>,
    @InjectRepository(ApplicationAttendanceScanEntity) private readonly scans: Repository<ApplicationAttendanceScanEntity>,
    @InjectRepository(ApplicationAttendanceAuditEntity) private readonly attendanceAudits: Repository<ApplicationAttendanceAuditEntity>,
    @InjectRepository(ApplicationEntryTestOutcomeEntity) private readonly outcomes: Repository<ApplicationEntryTestOutcomeEntity>,
    @InjectRepository(ApplicationEntity) private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationProgrammeOptionEntity) private readonly options: Repository<ApplicationProgrammeOptionEntity>,
    @InjectRepository(ApplicationContactEntity) private readonly contacts: Repository<ApplicationContactEntity>,
    @InjectRepository(IntakeEntity) private readonly intakes: Repository<IntakeEntity>,
    @InjectRepository(ProgrammeOfferingEntity) private readonly offerings: Repository<ProgrammeOfferingEntity>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly dataSource: DataSource,
  ) {}

  async createCentre(user: RequestContext, dto: CreateTestCentreDto) {
    this.staff(user);
    const row = await this.centres.save(this.centres.create({
      tenantId: user.tenantId,
      centreName: dto.centreName.trim(),
      location: dto.location.trim(),
      active: dto.active ?? true,
      createdBy: user.userId,
      updatedBy: user.userId,
    }));
    return row;
  }
  async listCentres(user: RequestContext, active?: boolean) {
    this.staff(user);
    return this.centres.find({
      where: { tenantId: user.tenantId, ...(active === undefined ? {} : { active }) },
      order: { centreName: 'ASC' },
    });
  }
  async updateCentre(user: RequestContext, id: string, dto: UpdateTestCentreDto) {
    this.staff(user); const row = await this.requireCentre(user.tenantId, id);
    if (dto.centreName !== undefined) row.centreName = dto.centreName.trim();
    if (dto.location !== undefined) row.location = dto.location.trim();
    if (dto.active !== undefined) row.active = dto.active;
    row.updatedBy = user.userId;
    return this.centres.save(row);
  }

  async createSession(user: RequestContext, dto: TestSessionDto) {
    this.staff(user); this.validateTimes(dto.reportingTime, dto.testTime);
    const centre = await this.requireCentre(user.tenantId, dto.testCentreId);
    if (!centre.active) throw new BusinessException('Cannot create a session at an inactive test centre', HttpStatus.UNPROCESSABLE_ENTITY, 'TEST_CENTRE_INACTIVE');
    await this.requirePublishedIntake(user.tenantId, dto.intakeSessionId);
    await this.validateSessionOfferings(user.tenantId, dto.intakeSessionId, dto.offeringIds);
    const session = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(TestSessionEntity).save(manager.getRepository(TestSessionEntity).create({
        tenantId: user.tenantId,
        testCentreId: centre.id,
        intakeSessionId: dto.intakeSessionId,
        testDate: dto.testDate,
        reportingTime: dto.reportingTime,
        testTime: dto.testTime,
        room: dto.room.trim(),
        capacity: dto.capacity ?? null,
        status: dto.status ?? 'DRAFT',
        createdBy: user.userId,
        updatedBy: user.userId,
      }));
      await manager.getRepository(TestSessionOfferingEntity).save(dto.offeringIds.map((programmeOfferingId) => manager.getRepository(TestSessionOfferingEntity).create({
        tenantId: user.tenantId,
        testSessionId: saved.id,
        programmeOfferingId,
      })));
      return saved;
    });
    return this.sessionDto(session);
  }
  async listSessions(user: RequestContext, filters: { testCentreId?: string; offeringId?: string; intakeSessionId?: string }) {
    this.staff(user);
    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (filters.testCentreId) where.testCentreId = filters.testCentreId;
    if (filters.intakeSessionId) where.intakeSessionId = filters.intakeSessionId;
    if (filters.offeringId) {
      const links = await this.sessionOfferings.find({ where: { tenantId: user.tenantId, programmeOfferingId: filters.offeringId } });
      if (!links.length) return [];
      where.id = In(links.map((link) => link.testSessionId));
    }
    const sessions = await this.sessions.find({ where, order: { testDate: 'ASC', testTime: 'ASC' } });
    return Promise.all(sessions.map((session) => this.sessionDto(session)));
  }
  async updateSession(user: RequestContext, id: string, dto: UpdateTestSessionDto) {
    this.staff(user); const row = await this.requireSession(user.tenantId, id);
    const currentOfferingLinks = await this.sessionOfferings.find({ where: { tenantId: user.tenantId, testSessionId: id } });
    const previousOfferingIds = currentOfferingLinks.map((link) => link.programmeOfferingId).sort();
    const offeringIds = dto.offeringIds ?? previousOfferingIds;
    const sessionChanges = { ...dto };
    delete sessionChanges.offeringIds;
    const before = { testCentreId: row.testCentreId, intakeSessionId: row.intakeSessionId, testDate: row.testDate, reportingTime: row.reportingTime, testTime: row.testTime, room: row.room };
    Object.assign(row, sessionChanges);
    const centre = await this.requireCentre(user.tenantId, row.testCentreId);
    if (!centre.active) throw new BusinessException('Session centre is inactive', HttpStatus.UNPROCESSABLE_ENTITY, 'TEST_CENTRE_INACTIVE');
    await this.requirePublishedIntake(user.tenantId, row.intakeSessionId);
    await this.validateSessionOfferings(user.tenantId, row.intakeSessionId, offeringIds);
    this.validateTimes(row.reportingTime, row.testTime);
    row.updatedBy = user.userId;
    const changed = Object.entries(before).some(([key, value]) => (row as any)[key] !== value);
    const offeringSetChanged = previousOfferingIds.join(',') !== [...offeringIds].sort().join(',');
    if (changed || offeringSetChanged || row.status !== 'PUBLISHED') {
      const cards = await this.cards.find({ where: { tenantId: user.tenantId, testSessionId: row.id, status: 'PUBLISHED' } });
      for (const card of cards) card.status = 'SUPERSEDED';
      if (cards.length) await this.cards.save(cards);
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(TestSessionEntity).save(row);
      if (offeringSetChanged) {
        await manager.getRepository(TestSessionOfferingEntity).delete({ tenantId: user.tenantId, testSessionId: row.id });
        await manager.getRepository(TestSessionOfferingEntity).save(offeringIds.map((programmeOfferingId) => manager.getRepository(TestSessionOfferingEntity).create({
          tenantId: user.tenantId,
          testSessionId: row.id,
          programmeOfferingId,
        })));
      }
    });
    return this.sessionDto(row);
  }

  async generateAdmitCard(user: RequestContext, applicantId: string) {
    this.staff(user);
    const app = await this.requireApprovedApplication(user.tenantId, applicantId);
    const activeCard = await this.cards.findOne({ where: { tenantId: user.tenantId, applicantId, status: 'PUBLISHED' } });
    if (activeCard) return this.cardDto(activeCard);
    const session = await this.resolveAutomaticSession(user.tenantId, app);
    return this.issueAdmitCard(user, app, session);
  }

  async assignAdmitCardSession(user: RequestContext, applicantId: string, dto: AssignAdmitCardSessionDto) {
    this.staff(user);
    const app = await this.requireApprovedApplication(user.tenantId, applicantId);
    const session = await this.requireAssignableSession(user.tenantId, app, dto.testSessionId);
    const activeCard = await this.cards.findOne({ where: { tenantId: user.tenantId, applicantId, status: 'PUBLISHED' } });
    if (activeCard?.testSessionId === session.id) return this.cardDto(activeCard);
    if (activeCard) {
      const attendance = await this.attendance.findOneBy({
        tenantId: user.tenantId,
        applicantId,
        testSessionId: activeCard.testSessionId,
      });
      if (attendance && ['PRESENT', 'ABSENT'].includes(attendance.attendanceStatus)) {
        throw new ConflictException('Cannot reassign test session after attendance has been marked');
      }
    }
    return this.issueAdmitCard(user, app, session, activeCard);
  }
  async adminAdmitCard(user: RequestContext, applicantId: string) { this.staff(user); const app = await this.requireApplication(user.tenantId, applicantId); return this.getActiveCard(user.tenantId, app.id); }
  async applicantAdmitCard(user: AuthUser, applicantId: string) { const app = await this.requireApplication(user.tenantId, applicantId); if (app.iamUserId !== user.userId) throw new ForbiddenException('You do not own this application'); if (app.applicationStatus !== 'APPROVED') throw new BusinessException('Admit card is available after application approval', HttpStatus.FORBIDDEN, 'APPLICATION_NOT_APPROVED'); return this.getActiveCard(user.tenantId, applicantId); }
  async printableCard(user: RequestContext, applicantId: string) { this.staff(user); const app = await this.requireApplication(user.tenantId, applicantId); return this.getActiveCard(user.tenantId, app.id); }

  async resolveQr(user: RequestContext, token: string) {
    this.staff(user);
    const card = await this.cards.findOneBy({ tenantId: user.tenantId, qrToken: token });
    if (!card || card.status !== 'PUBLISHED') throw new BusinessException('QR reference is invalid or expired', HttpStatus.NOT_FOUND, 'INVALID_QR');
    const app = await this.requireApplication(user.tenantId, card.applicantId);
    if (app.applicationStatus !== 'APPROVED') throw new BusinessException('Applicant is not approved', HttpStatus.UNPROCESSABLE_ENTITY, 'APPLICATION_NOT_APPROVED');
    return { card: await this.cardDto(card), attendance: await this.attendance.findOneBy({ tenantId: user.tenantId, applicantId: app.id, testSessionId: card.testSessionId }) };
  }
  async scanQr(user: RequestContext, token: string, metadata: { ip?: string; userAgent?: string }) {
    this.staff(user);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const card = await this.cards.findOneBy({ tenantId: user.tenantId, qrToken: token });
    const now = new Date();
    if (!card) {
      await this.scans.save(this.scans.create({ tenantId: user.tenantId, attendanceId: null, applicantId: null, applicationId: null, admitCardId: null, testSessionId: null, scanTokenHash: tokenHash, scanStatus: 'INVALID', scannedBy: user.userId, ipAddress: metadata.ip ?? null, userAgent: metadata.userAgent?.slice(0, 500) ?? null }));
      throw new BusinessException('QR reference is invalid', HttpStatus.NOT_FOUND, 'INVALID_QR');
    }
    const app = await this.requireApplication(user.tenantId, card.applicantId);
    const session = await this.requireSession(user.tenantId, card.testSessionId);
    const centre = await this.requireCentre(user.tenantId, session.testCentreId);
    const valid = card.status === 'PUBLISHED' && app.applicationStatus === 'APPROVED' && session.status === 'PUBLISHED' && centre.active;
    const scanStatus = valid ? 'SCANNED' : 'EXPIRED';
    let attendance: ApplicationAttendanceEntity | null = null;
    if (valid) {
      attendance = await this.dataSource.transaction(async (manager) => {
        await manager.query(`INSERT INTO application_attendance (tenant_id, applicant_id, application_id, test_session_id, admit_card_id, attendance_status, scan_count, first_scanned_at, last_scanned_at, recorded_by)
          VALUES ($1,$2,$3,$4,$5,'PENDING',0,NULL,NULL,$6) ON CONFLICT (tenant_id, applicant_id, test_session_id) DO NOTHING`, [user.tenantId, app.id, String(app.applicationId), session.id, card.id, user.userId]);
        const repo = manager.getRepository(ApplicationAttendanceEntity);
        const current = await repo.findOne({ where: { tenantId: user.tenantId, applicantId: app.id, testSessionId: session.id }, lock: { mode: 'pessimistic_write' } });
        if (!current) throw new ConflictException('Could not initialize attendance record');
        const repeated = ['PRESENT', 'ABSENT'].includes(current.attendanceStatus);
        current.scanCount += 1; current.firstScannedAt ??= now; current.lastScannedAt = now;
        const saved = await repo.save(current);
        await manager.getRepository(ApplicationAttendanceScanEntity).save(manager.getRepository(ApplicationAttendanceScanEntity).create({ tenantId: user.tenantId, attendanceId: saved.id, applicantId: app.id, applicationId: String(app.applicationId), admitCardId: card.id, testSessionId: session.id, scanTokenHash: tokenHash, scanStatus: repeated ? 'ALREADY_ATTENDED' : 'SCANNED', scannedBy: user.userId, ipAddress: metadata.ip ?? null, userAgent: metadata.userAgent?.slice(0, 500) ?? null }));
        return saved;
      });
    } else {
      await this.scans.save(this.scans.create({ tenantId: user.tenantId, attendanceId: null, applicantId: app.id, applicationId: String(app.applicationId), admitCardId: card.id, testSessionId: session.id, scanTokenHash: tokenHash, scanStatus, scannedBy: user.userId, ipAddress: metadata.ip ?? null, userAgent: metadata.userAgent?.slice(0, 500) ?? null }));
    }
    if (!valid) throw new BusinessException('QR reference is expired or no longer valid for attendance', HttpStatus.GONE, 'EXPIRED_QR');
    return { scanStatus: attendance?.attendanceStatus === 'PENDING' ? 'SCANNED' : 'ALREADY_ATTENDED', card: await this.cardDto(card), attendance };
  }

  async markAttendance(user: RequestContext, applicantId: string, dto: MarkAttendanceDto) {
    this.staff(user); const app = await this.requireApplication(user.tenantId, applicantId);
    if (app.applicationStatus !== 'APPROVED') throw new BusinessException('Attendance can only be recorded for approved applicants', HttpStatus.UNPROCESSABLE_ENTITY, 'APPLICATION_NOT_APPROVED');
    const cardRow = await this.cards.findOneBy({ tenantId: user.tenantId, applicantId, status: 'PUBLISHED' });
    if (!cardRow) throw new NotFoundException('Published admit card not found');
    const session = await this.requireSession(user.tenantId, cardRow.testSessionId);
    const verified = dto.identityVerified ?? null;
    if (dto.attendanceStatus === 'PRESENT' && verified !== true) throw new BusinessException('Identity must be verified before marking PRESENT', HttpStatus.UNPROCESSABLE_ENTITY, 'IDENTITY_VERIFICATION_REQUIRED');
    if (verified === false && !dto.verificationFailureReason?.trim()) throw new BusinessException('Provide a reason when identity is not verified', HttpStatus.UNPROCESSABLE_ENTITY, 'IDENTITY_FAILURE_REASON_REQUIRED');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ApplicationAttendanceEntity);
      let row = await repo.findOne({ where: { tenantId: user.tenantId, applicantId, testSessionId: session.id }, lock: { mode: 'pessimistic_write' } });
      const from = row?.attendanceStatus ?? null;
      row ??= repo.create({ tenantId: user.tenantId, applicantId, applicationId: String(app.applicationId), testSessionId: session.id, admitCardId: cardRow.id, attendanceStatus: 'PENDING', scanCount: 0, firstScannedAt: null, lastScannedAt: null, recordedBy: user.userId });
      if (row.attendanceStatus !== 'PENDING') throw new ConflictException('Attendance is already marked; corrections require a controlled audited operation');
      row.attendanceStatus = dto.attendanceStatus; row.identityVerified = verified; row.verificationFailureReason = verified === false ? dto.verificationFailureReason!.trim() : null; row.markedBy = user.userId; row.markedAt = new Date();
      const saved = await repo.save(row);
      await manager.getRepository(ApplicationAttendanceAuditEntity).save(manager.getRepository(ApplicationAttendanceAuditEntity).create({ tenantId: user.tenantId, attendanceId: saved.id, fromStatus: from, toStatus: saved.attendanceStatus, identityVerified: saved.identityVerified, reason: saved.verificationFailureReason, actedBy: user.userId }));
      return saved;
    });
  }
  async attendanceAudit(user: RequestContext, applicantId: string) {
    this.staff(user); const app = await this.requireApplication(user.tenantId, applicantId);
    const attendance = await this.attendance.findOneBy({ tenantId: user.tenantId, applicantId });
    if (!attendance) return { attendance: null, scans: [], decisions: [] };
    const [scans, decisions] = await Promise.all([
      this.scans.find({ where: { tenantId: user.tenantId, applicantId }, order: { scannedAt: 'ASC' } }),
      this.attendanceAudits.find({ where: { tenantId: user.tenantId, attendanceId: attendance.id }, order: { actedAt: 'ASC' } }),
    ]);
    return { attendance, scans, decisions, applicationId: String(app.applicationId) };
  }
  async resultAwaited(user: RequestContext, applicantId: string) {
    this.staff(user); const attendance = await this.attendance.findOneBy({ tenantId: user.tenantId, applicantId });
    if (!attendance || attendance.attendanceStatus !== 'PRESENT' || attendance.identityVerified !== true) throw new BusinessException('Result Awaited can be set only after verified PRESENT attendance', HttpStatus.UNPROCESSABLE_ENTITY, 'VALID_ATTENDANCE_REQUIRED');
    if (attendance.resultAwaitedAt) return attendance;
    attendance.resultAwaitedAt = new Date(); attendance.resultAwaitedBy = user.userId;
    return this.attendance.save(attendance);
  }
  async recordOutcome(user: RequestContext, applicantId: string, dto: RecordOutcomeDto) {
    this.staff(user); const app = await this.requireApplication(user.tenantId, applicantId);
    const attendance = await this.attendance.findOneBy({ tenantId: user.tenantId, applicantId });
    if (!attendance || attendance.attendanceStatus !== 'PRESENT' || attendance.resultAwaitedAt === null) throw new BusinessException('A verified attendance record marked Result Awaited is required before recording the outcome', HttpStatus.UNPROCESSABLE_ENTITY, 'RESULT_NOT_AWAITED');
    if (await this.outcomes.exists({ where: { tenantId: user.tenantId, attendanceId: attendance.id } })) throw new ConflictException('Entry-test outcome has already been recorded');
    return this.outcomes.save(this.outcomes.create({ tenantId: user.tenantId, applicantId, applicationId: String(app.applicationId), attendanceId: attendance.id, outcomeStatus: dto.outcomeStatus.trim().toUpperCase(), outcomeDetails: dto.outcomeDetails?.trim() ?? null, outcomeDate: dto.outcomeDate ?? null, recordedBy: user.userId }));
  }
  async getOutcome(user: RequestContext, applicantId: string) { this.staff(user); await this.requireApplication(user.tenantId, applicantId); const row = await this.outcomes.findOneBy({ tenantId: user.tenantId, applicantId }); if (!row) throw new NotFoundException('Entry-test outcome not found'); return row; }

  private async getActiveCard(tenantId: string, applicantId: string) { const row = await this.cards.findOneBy({ tenantId, applicantId, status: 'PUBLISHED' }); if (!row) throw new NotFoundException('Published admit card not found'); return this.cardDto(row); }

  private async requireApprovedApplication(tenantId: string, applicantId: string) {
    const app = await this.requireApplication(tenantId, applicantId);
    if (app.applicationStatus !== 'APPROVED') {
      throw new BusinessException('Only approved applicants can receive an admit card', HttpStatus.UNPROCESSABLE_ENTITY, 'APPLICATION_NOT_APPROVED');
    }
    return app;
  }

  private async resolveAutomaticSession(tenantId: string, app: ApplicationEntity) {
    const choices = await this.options.find({
      where: { tenantId, applicantId: app.id },
      relations: { programmeOffering: { programme: true } },
      order: { preferenceOrder: 'ASC' },
    });
    if (!choices.length || !choices[0]?.programmeOffering?.programme) {
      throw new BusinessException('Applicant programme options are missing', HttpStatus.UNPROCESSABLE_ENTITY, 'PROGRAMME_OPTIONS_MISSING');
    }
    const primaryOfferingId = choices[0].programmeOfferingId;
    const offeringSessionLinks = await this.sessionOfferings.find({ where: { tenantId, programmeOfferingId: primaryOfferingId } });
    const candidates = offeringSessionLinks.length
      ? await this.sessions.find({
          where: {
            tenantId,
            id: In(offeringSessionLinks.map((link) => link.testSessionId)),
            intakeSessionId: app.intakeId,
            status: 'PUBLISHED',
          },
          order: { testDate: 'ASC', testTime: 'ASC' },
        })
      : [];
    if (!candidates.length) {
      throw new BusinessException('No published test session is configured for the applicant’s first programme preference', HttpStatus.UNPROCESSABLE_ENTITY, 'MATCHING_TEST_SESSION_NOT_FOUND');
    }
    const centreIds = [...new Set(candidates.map((session) => session.testCentreId))];
    const eligibleCentres = await this.centres.find({ where: { tenantId, active: true, id: In(centreIds) } });
    const eligibleCentreIds = new Set(eligibleCentres.map((centre) => centre.id));
    const matchedSessions = candidates.filter((session) => eligibleCentreIds.has(session.testCentreId));
    if (!matchedSessions.length) {
      throw new BusinessException('No published test session matches the applicant intake and first programme preference', HttpStatus.UNPROCESSABLE_ENTITY, 'MATCHING_TEST_SESSION_NOT_FOUND');
    }
    if (matchedSessions.length > 1) {
      throw new BusinessException('More than one published session matches the applicant intake and first programme preference; resolve the schedule before issuing cards', HttpStatus.CONFLICT, 'AMBIGUOUS_TEST_SESSION');
    }
    return matchedSessions[0]!;
  }

  private async requireAssignableSession(tenantId: string, app: ApplicationEntity, testSessionId: string) {
    const session = await this.requireSession(tenantId, testSessionId);
    if (session.status !== 'PUBLISHED') {
      throw new BusinessException('Only a published test session can be assigned', HttpStatus.UNPROCESSABLE_ENTITY, 'TEST_SESSION_NOT_PUBLISHED');
    }
    if (session.intakeSessionId !== app.intakeId) {
      throw new BusinessException('Test session must belong to the applicant intake', HttpStatus.UNPROCESSABLE_ENTITY, 'TEST_SESSION_INTAKE_MISMATCH');
    }
    const centre = await this.requireCentre(tenantId, session.testCentreId);
    if (!centre.active) {
      throw new BusinessException('Cannot assign a session at an inactive test centre', HttpStatus.UNPROCESSABLE_ENTITY, 'TEST_CENTRE_INACTIVE');
    }
    const choices = await this.options.find({ where: { tenantId, applicantId: app.id } });
    if (!choices.length) {
      throw new BusinessException('Applicant programme options are missing', HttpStatus.UNPROCESSABLE_ENTITY, 'PROGRAMME_OPTIONS_MISSING');
    }
    const offeringIds = choices.map((choice) => choice.programmeOfferingId);
    const link = await this.sessionOfferings.findOne({
      where: { tenantId, testSessionId: session.id, programmeOfferingId: In(offeringIds) },
    });
    if (!link) {
      throw new BusinessException('Test session must cover at least one of the applicant programme preferences', HttpStatus.UNPROCESSABLE_ENTITY, 'TEST_SESSION_NOT_LINKED_TO_APPLICANT_OFFERING');
    }
    return session;
  }

  private async issueAdmitCard(
    user: RequestContext,
    app: ApplicationEntity,
    session: TestSessionEntity,
    previousCard?: ApplicationAdmitCardEntity | null,
  ) {
    const choices = await this.options.find({
      where: { tenantId: user.tenantId, applicantId: app.id },
      relations: { programmeOffering: { programme: true } },
      order: { preferenceOrder: 'ASC' },
    });
    if (!choices.length || !choices[0]?.programmeOffering?.programme) {
      throw new BusinessException('Applicant programme options are missing', HttpStatus.UNPROCESSABLE_ENTITY, 'PROGRAMME_OPTIONS_MISSING');
    }
    const centre = await this.requireCentre(user.tenantId, session.testCentreId);
    const parent = await this.contacts.findOne({
      where: { tenantId: user.tenantId, applicantId: app.id, contactType: In(['PARENT', 'GUARDIAN'] as any) },
      order: { createdAt: 'ASC' },
    });
    if (!app.profilePhotograph || !app.gender || !parent?.name) {
      throw new BusinessException('Photograph, gender and parent/guardian identity are required before issuing the admit card', HttpStatus.UNPROCESSABLE_ENTITY, 'ADMIT_CARD_PROFILE_INCOMPLETE');
    }
    const intake = await this.intakes.findOneBy({ id: app.intakeId, tenantId: user.tenantId });
    if (!intake) throw new NotFoundException('Intake not found');
    const issuedAt = new Date();
    const card = this.cards.create({
      tenantId: user.tenantId,
      applicantId: app.id,
      applicationId: String(app.applicationId),
      testSessionId: session.id,
      serialNumber: String(app.applicationId),
      intakeSession: intake.intakeName,
      applicantName: app.applicantName,
      fatherGuardianName: parent.name,
      gender: app.gender,
      photographReference: app.profilePhotograph,
      programmeOptions: choices.map((option) => ({
        preferenceOrder: option.preferenceOrder,
        programmeId: option.programmeOffering.programme.id,
        programmeCode: option.programmeOffering.programme.code,
        programmeName: option.programmeOffering.programme.name,
      })),
      testVenue: `${centre.centreName}, ${centre.location}`,
      testDate: session.testDate,
      reportingTime: session.reportingTime,
      testTime: session.testTime,
      room: session.room,
      issueDate: issuedAt.toISOString().slice(0, 10),
      instructions: process.env.F006_ADMIT_CARD_INSTRUCTIONS?.trim() || 'Bring this admit card, your original identity document, and original paid-fee evidence. Arrive before the reporting time.',
      status: 'PUBLISHED',
      qrToken: randomBytes(32).toString('base64url'),
      qrGeneratedAt: issuedAt,
      generatedBy: user.userId,
      generatedAt: issuedAt,
      publishedAt: issuedAt,
    });
    const saved = await this.dataSource.transaction(async (manager) => {
      if (previousCard) {
        previousCard.status = 'SUPERSEDED';
        await manager.getRepository(ApplicationAdmitCardEntity).save(previousCard);
      }
      return manager.getRepository(ApplicationAdmitCardEntity).save(card);
    });
    return this.cardDto(saved);
  }

  private async requirePublishedIntake(tenantId: string, intakeSessionId: string) {
    const intake = await this.intakes.findOneBy({ id: intakeSessionId, tenantId });
    if (!intake || intake.status !== 'PUBLISHED') {
      throw new BusinessException('Test sessions can only be configured for a published intake', HttpStatus.UNPROCESSABLE_ENTITY, 'INTAKE_NOT_PUBLISHED');
    }
    return intake;
  }
  private async validateSessionOfferings(tenantId: string, intakeId: string, offeringIds: string[]) {
    if (!offeringIds.length || new Set(offeringIds).size !== offeringIds.length) {
      throw new BusinessException('Choose one or more distinct offerings for this session', HttpStatus.BAD_REQUEST, 'INVALID_SESSION_OFFERINGS');
    }
    const offerings = await this.offerings.find({
      where: { tenantId, id: In(offeringIds), intakeId, offeringStatus: 'PUBLISHED' },
    });
    if (offerings.length !== offeringIds.length) {
      throw new BusinessException('Every selected offering must be a published offering in the session intake', HttpStatus.UNPROCESSABLE_ENTITY, 'OFFERING_NOT_IN_SESSION_INTAKE');
    }
  }
  private async sessionDto(row: TestSessionEntity) {
    const links = await this.sessionOfferings.find({ where: { tenantId: row.tenantId, testSessionId: row.id }, order: { programmeOfferingId: 'ASC' } });
    return { ...row, offeringIds: links.map((link) => link.programmeOfferingId) };
  }
  private async cardDto(row: ApplicationAdmitCardEntity) {
    const frontEndAttendanceBase = (process.env.F006_ATTENDANCE_PAGE_URL ?? 'http://localhost:5173/attendance/qr').replace(/\/$/, '');
    let photographDownloadUrl: string | null = null;
    try {
      photographDownloadUrl = await this.storage.resolveDownloadUrl(row.photographReference);
    } catch {
      photographDownloadUrl = row.photographReference ?? null;
    }
    return { id: row.id, applicantId: row.applicantId, applicationId: row.applicationId, serialNumber: row.serialNumber, intakeSession: row.intakeSession, applicantName: row.applicantName, fatherGuardianName: row.fatherGuardianName, gender: row.gender, photographReference: row.photographReference, photographDownloadUrl, programmeOptions: row.programmeOptions, testSessionId: row.testSessionId, testVenue: row.testVenue, testDate: row.testDate, reportingTime: row.reportingTime, testTime: row.testTime, room: row.room, issueDate: row.issueDate, instructions: row.instructions, status: row.status, qrUrl: `${frontEndAttendanceBase}/${encodeURIComponent(row.qrToken)}`, qrGeneratedAt: row.qrGeneratedAt, publishedAt: row.publishedAt };
  }
  private async requireCentre(tenantId: string, id: string) { const row = await this.centres.findOneBy({ id, tenantId }); if (!row) throw new NotFoundException('Test centre not found'); return row; }
  private async requireSession(tenantId: string, id: string) { const row = await this.sessions.findOneBy({ id, tenantId }); if (!row) throw new NotFoundException('Test session not found'); return row; }
  private async requireApplication(tenantId: string, id: string) { const row = await this.applications.findOneBy({ id, tenantId }); if (!row) throw new NotFoundException('Application not found'); return row; }
  private validateTimes(reporting: string, test: string) { const valid = (value: string) => /^\d{2}:\d{2}(:\d{2})?$/.test(value); if (!valid(reporting) || !valid(test) || reporting >= test) throw new BusinessException('Reporting time must be a valid time before test time', HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_TEST_TIMES'); }
  private staff(user: RequestContext) { if (!(user.roles ?? []).some((role) => ADMISSIONS_ADMIN_ROLES.has(role.trim().toUpperCase()))) throw new ForbiddenException('Admissions admin role is required'); }
}
