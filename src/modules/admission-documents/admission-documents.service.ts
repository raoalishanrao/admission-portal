import { ConflictException, ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { DataSource, In, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { AdmissionDocumentSource, AdmissionDocumentStatus } from '../../common/enums/admission-document.enum.js';
import { EDITABLE_OFFERING_STATUSES } from '../../common/enums/offering-status.enum.js';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { ApplicantDocumentEntity, ApplicantDocumentFileEntity, ApplicationAcademicDocumentEntity, ApplicationEntity, ApplicationProgrammeOptionEntity, DocumentTypeEntity, DocumentVerificationAuditEntity, OfferingRequiredDocumentEntity, ProgrammeOfferingEntity } from '../../database/entities/index.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../integrations/storage/object-storage.interface.js';
import { Inject } from '@nestjs/common';
import type { CreateDocumentTypeDto, CreateOfferingRequirementsDto, LinkAcademicDocumentDto, RequestResubmissionDto, UpdateOfferingRequirementDto } from './dto/admission-document.dto.js';
import { ProgrammeOfferingsService } from '../programme-offerings/programme-offerings.service.js';

export interface AdmissionUpload { buffer: Buffer; originalname: string; mimetype: string; size: number; }
const MIME_EXT: Record<string, string[]> = { 'image/jpeg': ['.jpg','.jpeg'], 'image/png': ['.png'], 'image/gif': ['.gif'], 'image/bmp': ['.bmp'], 'application/pdf': ['.pdf'] };
const STAFF_ROLES = new Set(['ADMISSION_MANAGER','ADMISSIONS_MANAGER','ADMISSIONS_ADMIN','ADMISSIONS_OFFICER','ADMIN','SUPER_ADMIN']);

@Injectable()
export class AdmissionDocumentsService {
  constructor(
    @InjectRepository(DocumentTypeEntity) private readonly types: Repository<DocumentTypeEntity>,
    @InjectRepository(OfferingRequiredDocumentEntity) private readonly requirements: Repository<OfferingRequiredDocumentEntity>,
    @InjectRepository(ApplicantDocumentEntity) private readonly documents: Repository<ApplicantDocumentEntity>,
    @InjectRepository(ApplicantDocumentFileEntity) private readonly documentFiles: Repository<ApplicantDocumentFileEntity>,
    @InjectRepository(DocumentVerificationAuditEntity) private readonly audits: Repository<DocumentVerificationAuditEntity>,
    @InjectRepository(ApplicationEntity) private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationProgrammeOptionEntity) private readonly options: Repository<ApplicationProgrammeOptionEntity>,
    @InjectRepository(ProgrammeOfferingEntity) private readonly offerings: Repository<ProgrammeOfferingEntity>,
    @InjectRepository(ApplicationAcademicDocumentEntity) private readonly academicDocs: Repository<ApplicationAcademicDocumentEntity>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly dataSource: DataSource,
    private readonly programmeOfferingsService: ProgrammeOfferingsService,
  ) {}

  async listTypes(user: RequestContext) { this.assertStaff(user); return this.types.find({ order: { category: 'ASC', name: 'ASC' } }); }
  async createType(user: RequestContext, dto: CreateDocumentTypeDto) {
    this.assertStaff(user); const code = dto.code.trim().toUpperCase();
    if (await this.types.findOne({ where: { code } })) throw new ConflictException('Document type code already exists');
    return this.types.save(this.types.create({ ...dto, code, name: dto.name.trim(), category: dto.category.trim().toUpperCase(), active: dto.active ?? true }));
  }
  async updateType(user: RequestContext, id: string, dto: Partial<CreateDocumentTypeDto>) {
    this.assertStaff(user); const row = await this.types.findOneBy({ id }); if (!row) throw new NotFoundException('Document type not found');
    if (dto.code) row.code = dto.code.trim().toUpperCase(); if (dto.name) row.name = dto.name.trim(); if (dto.category) row.category = dto.category.trim().toUpperCase();
    if (dto.description !== undefined) row.description = dto.description ?? null; if (dto.active !== undefined) row.active = dto.active;
    return this.types.save(row);
  }
  async listRequirements(user: RequestContext, offeringId: string) {
    this.assertStaff(user); await this.requireOffering(user.tenantId, offeringId);
    const rules = await this.requirements.find({ where: { tenantId: user.tenantId, programmeOfferingId: offeringId }, order: { sortOrder: 'ASC' } });
    const map = new Map((await this.types.findBy({ id: In(rules.map(x => x.documentTypeId)) })).map(x => [x.id,x]));
    return rules.map(r => ({ ...r, documentType: map.get(r.documentTypeId) ?? null }));
  }
  async createRequirementsForOfferings(user: RequestContext, dto: CreateOfferingRequirementsDto) {
    this.assertStaff(user);
    for (const offeringId of dto.offeringIds) await this.programmeOfferingsService.ensureEditableOffering(user.tenantId, offeringId);
    const types = await this.types.findBy({ id: In(dto.requirements.map(r => r.documentTypeId)), active: true });
    const typeMap = new Map(types.map(t => [t.id, t]));
    if (typeMap.size !== new Set(dto.requirements.map(r => r.documentTypeId)).size) throw new NotFoundException('One or more active document types were not found');
    const generated = new Set<string>();
    for (const offeringId of dto.offeringIds) for (const item of dto.requirements) {
      const key = `${offeringId}:${item.documentTypeId}`;
      if (generated.has(key) || await this.requirements.findOne({ where: { tenantId: user.tenantId, programmeOfferingId: offeringId, documentTypeId: item.documentTypeId } })) throw new ConflictException(`Document type ${typeMap.get(item.documentTypeId)!.code} is already configured for offering ${offeringId}`);
      generated.add(key);
    }
    const items: Array<Record<string, unknown>> = [];
    await this.dataSource.transaction(async manager => {
      for (const offeringId of dto.offeringIds) for (const item of dto.requirements) {
        const saved = await manager.getRepository(OfferingRequiredDocumentEntity).save(manager.getRepository(OfferingRequiredDocumentEntity).create({ tenantId: user.tenantId, programmeOfferingId: offeringId, documentTypeId: item.documentTypeId, mandatory: item.mandatory ?? true, conditionCode: item.conditionCode?.trim().toUpperCase() ?? null, sortOrder: item.sortOrder ?? 0, active: item.active ?? true, createdBy: user.userId, updatedBy: user.userId }));
        items.push({ ...saved, documentType: typeMap.get(item.documentTypeId)! });
      }
    });
    for (const offeringId of dto.offeringIds) await this.programmeOfferingsService.markConfiguredForSetup(user.tenantId, offeringId, user.userId);
    return { items };
  }
  async updateRequirement(user: RequestContext, id: string, dto: UpdateOfferingRequirementDto) {
    this.assertStaff(user); const row = await this.requirements.findOneBy({ id, tenantId: user.tenantId }); if (!row) throw new NotFoundException('Offering document requirement not found');
    this.assertOfferingEditable(await this.requireOffering(user.tenantId, row.programmeOfferingId));
    if (dto.mandatory !== undefined) row.mandatory = dto.mandatory; if (dto.conditionCode !== undefined) row.conditionCode = dto.conditionCode?.trim().toUpperCase() ?? null;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder; if (dto.active !== undefined) row.active = dto.active; row.updatedBy = user.userId;
    return this.requirements.save(row);
  }
  async deleteRequirement(user: RequestContext, id: string) {
    this.assertStaff(user); const row = await this.requirements.findOneBy({ id, tenantId: user.tenantId }); if (!row) throw new NotFoundException('Offering document requirement not found');
    this.assertOfferingEditable(await this.requireOffering(user.tenantId, row.programmeOfferingId));
    const used = await this.documents.exists({ where: { tenantId: user.tenantId, offeringRequiredDocumentId: id } }); if (used) throw new ConflictException('Requirement has applicant document records; deactivate it instead');
    await this.requirements.remove(row); return { deleted: true, id };
  }

  async applicantRequirements(user: AuthUser, applicantId: string) {
    const app = await this.requireOwned(user, applicantId); const selected = await this.selectedOfferingIds(user.tenantId, applicantId);
    const rules = selected.length ? await this.requirements.find({ where: { tenantId: user.tenantId, programmeOfferingId: In(selected), active: true }, order: { sortOrder: 'ASC' } }) : [];
    const types = await this.types.findBy({ id: In(rules.map(r => r.documentTypeId)) }); const typeMap = new Map(types.map(t => [t.id,t]));
    const docs = await this.documents.find({ where: { tenantId: user.tenantId, applicantId } }); const docMap = new Map(docs.map(d => [d.offeringRequiredDocumentId,d]));
    const groups = new Map<string, OfferingRequiredDocumentEntity[]>();
    for (const rule of rules) { const key = `${rule.documentTypeId}:${rule.conditionCode?.trim().toUpperCase() ?? ''}`; groups.set(key, [...(groups.get(key) ?? []), rule]); }
    return Promise.all([...groups.values()].map(async (group) => {
      const first = group[0]!; const type = typeMap.get(first.documentTypeId)!; const linked = group.map((rule) => ({ rule, doc: docMap.get(rule.id) }));
      const statuses = linked.map(({ doc }) => doc?.status ?? AdmissionDocumentStatus.NOT_SUBMITTED);
      const status = statuses.every((value) => value === AdmissionDocumentStatus.VERIFIED) ? AdmissionDocumentStatus.VERIFIED : statuses.includes(AdmissionDocumentStatus.RESUBMISSION_REQUIRED) ? AdmissionDocumentStatus.RESUBMISSION_REQUIRED : statuses.some((value) => value === AdmissionDocumentStatus.SUBMITTED) ? AdmissionDocumentStatus.SUBMITTED : AdmissionDocumentStatus.NOT_SUBMITTED;
      const representative = linked.find(({ doc }) => doc)?.doc;
      return { applicantId: app.id, programmeOfferingId: first.programmeOfferingId, programmeOfferingIds: [...new Set(group.map((rule) => rule.programmeOfferingId))], offeringRequiredDocumentId: first.id, offeringRequiredDocumentIds: group.map((rule) => rule.id), documentTypeId: first.documentTypeId, documentTypeCode: type?.code, documentTypeName: type?.name, mandatory: group.some((rule) => rule.mandatory), conditionCode: first.conditionCode, status, document: representative && type ? await this.toDto(representative, type) : null, requirementStatuses: linked.map(({ rule, doc }) => ({ offeringRequiredDocumentId: rule.id, programmeOfferingId: rule.programmeOfferingId, applicantDocumentId: doc?.id ?? null, documentFileId: doc?.documentFileId ?? null, mandatory: rule.mandatory, conditionCode: rule.conditionCode, status: doc?.status ?? AdmissionDocumentStatus.NOT_SUBMITTED })) };
    }));
  }
  async listApplicantDocuments(user: AuthUser, applicantId: string) { await this.requireOwned(user, applicantId); const rows = await this.documents.find({ where: { tenantId: user.tenantId, applicantId }, order: { createdAt: 'ASC' } }); return Promise.all(this.uniqueFileRows(rows).map(r => this.getDocumentDto(r))); }
  async getApplicantDocument(user: AuthUser, applicantId: string, id: string) { await this.requireOwned(user, applicantId); const row = await this.requireDocument(user.tenantId, applicantId, id); return this.getDocumentDto(row); }
  async upload(user: AuthUser, applicantId: string, requirementIds: string[], file?: AdmissionUpload) {
    const app = await this.requireOwned(user, applicantId); this.assertSubmitted(app); this.validateFile(file);
    const rules = await this.requireCompatibleSelectedRules(user.tenantId, applicantId, requirementIds);
    const type = await this.types.findOneBy({ id: rules[0]!.documentTypeId, active: true }); if (!type) throw new NotFoundException('Active document type not found');
    const expandedIds = rules.map((rule) => rule.id);
    const existingRows = await this.documents.find({ where: { tenantId: user.tenantId, applicantId, offeringRequiredDocumentId: In(expandedIds) } });
    if (existingRows.some((row) => row.status === AdmissionDocumentStatus.VERIFIED)) throw new ConflictException('A verified document requirement cannot be replaced');
    if (existingRows.some((row) => row.status !== AdmissionDocumentStatus.NOT_SUBMITTED && row.status !== AdmissionDocumentStatus.RESUBMISSION_REQUIRED)) throw new ConflictException('A document is already submitted; use replace after it is returned for resubmission');
    return this.storeUploadForRules(user, app, rules, type, file!);
  }
  async replace(user: AuthUser, applicantId: string, id: string, file?: AdmissionUpload) {
    const app = await this.requireOwned(user, applicantId); this.assertSubmitted(app); this.validateFile(file);
    const row = await this.requireDocument(user.tenantId, applicantId, id);
    const linked = row.documentFileId ? await this.documents.find({ where: { tenantId: user.tenantId, applicantId, documentFileId: row.documentFileId } }) : [row];
    if (linked.some((item) => item.status === AdmissionDocumentStatus.VERIFIED)) throw new ConflictException('A verified shared document cannot be replaced');
    if (linked.some((item) => ![AdmissionDocumentStatus.SUBMITTED, AdmissionDocumentStatus.RESUBMISSION_REQUIRED].includes(item.status as AdmissionDocumentStatus))) throw new ConflictException('Only submitted or returned documents can be replaced');
    const shared = row.documentFileId ? await this.documentFiles.findOneBy({ id: row.documentFileId, tenantId: user.tenantId, applicantId }) : null;
    const oldReference = shared?.fileReference ?? row.fileReference;
    const stored = await this.storage.upload({ buffer: file!.buffer, mimeType: file!.mimetype, folder: `admissions/documents/${applicantId}/shared`, fileName: file!.originalname });
    try {
      const nextShared = shared ?? this.documentFiles.create({ tenantId: row.tenantId, applicantId: row.applicantId, documentTypeId: row.documentTypeId, sourceModule: AdmissionDocumentSource.F004, sourceDocumentId: null });
      Object.assign(nextShared, { sourceModule: AdmissionDocumentSource.F004, sourceDocumentId: null, fileReference: stored.publicUrl, fileName: file!.originalname, mimeType: file!.mimetype, fileSizeBytes: String(file!.size), checksumSha256: createHash('sha256').update(file!.buffer).digest('hex') });
      const now = new Date();
      await this.dataSource.transaction(async (manager) => {
        const savedFile = await manager.getRepository(ApplicantDocumentFileEntity).save(nextShared);
        for (const item of linked) {
          const from = item.status;
          Object.assign(item, { documentFileId: savedFile.id, sourceModule: AdmissionDocumentSource.F004, sourceDocumentId: null, fileReference: stored.publicUrl, fileName: file!.originalname, mimeType: file!.mimetype, fileSizeBytes: String(file!.size), checksumSha256: nextShared.checksumSha256, status: AdmissionDocumentStatus.SUBMITTED, submittedBy: user.userId, submittedAt: now, resubmissionReason: null, resubmissionRequestedAt: null, verifiedBy: null, verifiedAt: null });
          const saved = await manager.getRepository(ApplicantDocumentEntity).save(item);
          await manager.getRepository(DocumentVerificationAuditEntity).save(manager.getRepository(DocumentVerificationAuditEntity).create({ tenantId: user.tenantId, applicantDocumentId: saved.id, action: 'REPLACED', fromStatus: from, toStatus: saved.status, reason: null, actedBy: user.userId }));
        }
      });
      if (oldReference && oldReference !== stored.publicUrl) { try { await this.storage.delete(oldReference); } catch { /* best-effort cleanup */ } }
      return Promise.all(linked.map((item) => this.getDocumentDto(item)));
    } catch (error) { try { await this.storage.delete(stored.storageKey); } catch { /* best-effort cleanup */ } throw error; }
  }
  async linkAcademic(user: AuthUser, applicantId: string, dto: LinkAcademicDocumentDto) {
    const app = await this.requireOwned(user, applicantId); this.assertSubmitted(app);
    const requirementIds = dto.offeringRequiredDocumentIds ?? (dto.offeringRequiredDocumentId ? [dto.offeringRequiredDocumentId] : []);
    const rules = await this.requireCompatibleSelectedRules(user.tenantId, applicantId, requirementIds);
    const type = await this.types.findOneBy({ id: rules[0]!.documentTypeId, active: true }); if (!type) throw new NotFoundException('Active document type not found');
    if (type.category !== 'ACADEMIC') throw new BusinessException('Academic records can satisfy academic requirements only', HttpStatus.UNPROCESSABLE_ENTITY, 'DOCUMENT_CATEGORY_MISMATCH');
    const source = await this.academicDocs.findOne({ where: { id: dto.academicDocumentId, tenantId: user.tenantId, applicantId } }); if (!source) throw new NotFoundException('Academic document not found for this applicant');
    const codeMatches = source.documentType === 'TRANSCRIPT' ? type.code === 'TRANSCRIPT' : source.documentType === 'CERTIFICATE' ? type.code.endsWith('_CERTIFICATE') || type.code === 'EQUIVALENCE_CERTIFICATE' : type.code.endsWith('_MARKSHEET');
    if (!codeMatches) throw new BusinessException('The academic document type does not match the configured offering requirements', HttpStatus.UNPROCESSABLE_ENTITY, 'DOCUMENT_TYPE_MISMATCH');
    const expandedIds = rules.map((rule) => rule.id);
    const existingRows = await this.documents.find({ where: { tenantId: user.tenantId, applicantId, offeringRequiredDocumentId: In(expandedIds) } });
    if (existingRows.some((row) => row.status === AdmissionDocumentStatus.VERIFIED)) throw new ConflictException('A document requirement is already verified');
    if (existingRows.some((row) => row.status !== AdmissionDocumentStatus.NOT_SUBMITTED && row.status !== AdmissionDocumentStatus.RESUBMISSION_REQUIRED)) throw new ConflictException('A document is already submitted; use the replacement flow after it is returned');
    const fileRecord = this.documentFiles.create({ tenantId: user.tenantId, applicantId, documentTypeId: type.id, sourceModule: AdmissionDocumentSource.F002, sourceDocumentId: source.id, fileReference: null, fileName: source.originalFileName, mimeType: source.mimeType, fileSizeBytes: source.fileSize == null ? null : String(source.fileSize), checksumSha256: null });
    return this.createRequirementLinks(user, app, rules, type, fileRecord, existingRows, 'UPLOADED');
  }
  async completeness(user: AuthUser, applicantId: string) {
    // Count grouped slots (same document type across offerings = one), matching the applicant UI.
    const requirements = await this.applicantRequirements(user, applicantId);
    const blocking = requirements.filter((r: any) => r.mandatory || r.conditionCode);
    const verifiedCount = blocking.filter((r: any) => r.status === AdmissionDocumentStatus.VERIFIED).length;
    return { applicantId, complete: blocking.length === verifiedCount, requiredCount: blocking.length, verifiedCount, requirements };
  }

  async reviewCompleteness(tenantId: string, applicantId: string) {
    const selected = await this.selectedOfferingIds(tenantId, applicantId);
    const rules = selected.length
      ? await this.requirements.find({
          where: { tenantId, programmeOfferingId: In(selected), active: true },
        })
      : [];
    // Same grouping as applicantRequirements: one slot per document type (+ condition)
    // across selected programmes, so 2 programmes × same marksheet = 1 required item.
    const groups = new Map<string, OfferingRequiredDocumentEntity[]>();
    for (const rule of rules) {
      const key = `${rule.documentTypeId}:${rule.conditionCode?.trim().toUpperCase() ?? ''}`;
      groups.set(key, [...(groups.get(key) ?? []), rule]);
    }
    const blockingGroups = [...groups.values()].filter((group) =>
      group.some((rule) => rule.mandatory || Boolean(rule.conditionCode)),
    );
    const docs = rules.length
      ? await this.documents.find({
          where: {
            tenantId,
            applicantId,
            offeringRequiredDocumentId: In(rules.map((r) => r.id)),
          },
        })
      : [];
    const byRequirement = new Map(docs.map((d) => [d.offeringRequiredDocumentId, d]));
    const outstandingRequirementIds: string[] = [];
    let verifiedCount = 0;
    for (const group of blockingGroups) {
      const members = group.filter((rule) => rule.mandatory || Boolean(rule.conditionCode));
      const allVerified = members.every(
        (rule) => byRequirement.get(rule.id)?.status === AdmissionDocumentStatus.VERIFIED,
      );
      if (allVerified) {
        verifiedCount += 1;
      } else {
        for (const rule of members) {
          if (byRequirement.get(rule.id)?.status !== AdmissionDocumentStatus.VERIFIED) {
            outstandingRequirementIds.push(rule.id);
          }
        }
      }
    }
    return {
      complete: outstandingRequirementIds.length === 0,
      requiredCount: blockingGroups.length,
      verifiedCount,
      outstandingRequirementIds,
    };
  }

  /**
   * F004 staff view — only rows in applicant_documents.
   * Academic (F002) files appear here after applicant link-academic / F004 upload
   * against offering required documents configured by admissions.
   */
  async staffApplicationDocuments(user: RequestContext, applicantId: string) {
    this.assertStaff(user);
    const app = await this.applications.findOneBy({
      id: applicantId,
      tenantId: user.tenantId,
    });
    if (!app) throw new NotFoundException('Application not found');
    const rows = await this.documents.find({
      where: { tenantId: user.tenantId, applicantId },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(
      this.uniqueFileRows(rows).map((row) => this.getDocumentDto(row)),
    );
  }
  async pending(user: RequestContext) { this.assertStaff(user); const rows = await this.documents.find({ where: { tenantId: user.tenantId, status: AdmissionDocumentStatus.SUBMITTED }, order: { submittedAt: 'ASC' } }); return Promise.all(this.uniqueFileRows(rows).map(r => this.getDocumentDto(r))); }
  async exceptions(user: RequestContext) { this.assertStaff(user); const rows = await this.documents.find({ where: { tenantId: user.tenantId, status: In([AdmissionDocumentStatus.SUBMITTED, AdmissionDocumentStatus.RESUBMISSION_REQUIRED]) }, order: { updatedAt: 'ASC' } }); return Promise.all(this.uniqueFileRows(rows).map(r => this.getDocumentDto(r))); }
  async verify(user: RequestContext, id: string) { this.assertStaff(user); const row = await this.requireDocument(user.tenantId, undefined, id); const linked = row.documentFileId ? await this.documents.find({ where: { tenantId: user.tenantId, applicantId: row.applicantId, documentFileId: row.documentFileId } }) : [row]; if (!linked.length || linked.some((item) => item.status !== AdmissionDocumentStatus.SUBMITTED)) throw new ConflictException('All linked requirements must be submitted before the shared document can be verified'); const now = new Date(); await this.dataSource.transaction(async (manager) => { for (const item of linked) { const from = item.status; item.status = AdmissionDocumentStatus.VERIFIED; item.verifiedBy = user.userId; item.verifiedAt = now; item.resubmissionReason = null; const saved = await manager.getRepository(ApplicantDocumentEntity).save(item); await manager.getRepository(DocumentVerificationAuditEntity).save(manager.getRepository(DocumentVerificationAuditEntity).create({ tenantId: user.tenantId, applicantDocumentId: saved.id, action: 'VERIFIED', fromStatus: from, toStatus: saved.status, reason: null, actedBy: user.userId })); } }); return Promise.all(linked.map((item) => this.getDocumentDto(item))); }
  async requestResubmission(user: RequestContext, id: string, dto: RequestResubmissionDto) { this.assertStaff(user); const reason = dto.reason.trim(); if (!reason) throw new BusinessException('A resubmission reason is required', HttpStatus.UNPROCESSABLE_ENTITY, 'RESUBMISSION_REASON_REQUIRED'); const row = await this.requireDocument(user.tenantId, undefined, id); const linked = row.documentFileId ? await this.documents.find({ where: { tenantId: user.tenantId, applicantId: row.applicantId, documentFileId: row.documentFileId } }) : [row]; if (!linked.length || linked.some((item) => item.status !== AdmissionDocumentStatus.SUBMITTED)) throw new ConflictException('All linked requirements must be submitted before the shared document can be returned'); const now = new Date(); await this.dataSource.transaction(async (manager) => { for (const item of linked) { const from = item.status; item.status = AdmissionDocumentStatus.RESUBMISSION_REQUIRED; item.resubmissionReason = reason; item.resubmissionRequestedAt = now; item.verifiedAt = null; item.verifiedBy = null; const saved = await manager.getRepository(ApplicantDocumentEntity).save(item); await manager.getRepository(DocumentVerificationAuditEntity).save(manager.getRepository(DocumentVerificationAuditEntity).create({ tenantId: user.tenantId, applicantDocumentId: saved.id, action: 'RESUBMISSION_REQUESTED', fromStatus: from, toStatus: saved.status, reason, actedBy: user.userId })); } }); return Promise.all(linked.map((item) => this.getDocumentDto(item))); }
  async auditHistory(user: RequestContext, id: string) { this.assertStaff(user); await this.requireDocument(user.tenantId, undefined, id); return this.audits.find({ where: { tenantId: user.tenantId, applicantDocumentId: id }, order: { actedAt: 'ASC' } }); }

  private async storeUploadForRules(user: AuthUser, app: ApplicationEntity, rules: OfferingRequiredDocumentEntity[], type: DocumentTypeEntity, file: AdmissionUpload) {
    const stored = await this.storage.upload({ buffer: file.buffer, mimeType: file.mimetype, folder: `admissions/documents/${app.id}/shared`, fileName: file.originalname });
    try {
      const checksum = createHash('sha256').update(file.buffer).digest('hex');
      const fileRecord = this.documentFiles.create({ tenantId: user.tenantId, applicantId: app.id, documentTypeId: type.id, sourceModule: AdmissionDocumentSource.F004, sourceDocumentId: null, fileReference: stored.publicUrl, fileName: file.originalname, mimeType: file.mimetype, fileSizeBytes: String(file.size), checksumSha256: checksum });
      const saved = await this.dataSource.transaction(async (manager) => {
        const savedFile = await manager.getRepository(ApplicantDocumentFileEntity).save(fileRecord);
        const rows: ApplicantDocumentEntity[] = [];
        for (const rule of rules) {
          const existing = await manager.getRepository(ApplicantDocumentEntity).findOneBy({ tenantId: user.tenantId, applicantId: app.id, offeringRequiredDocumentId: rule.id });
          const from = existing?.status ?? null;
          const row = existing ?? manager.getRepository(ApplicantDocumentEntity).create({ tenantId: user.tenantId, applicantId: app.id, applicationId: String(app.applicationId), programmeOfferingId: rule.programmeOfferingId, offeringRequiredDocumentId: rule.id, documentTypeId: type.id });
          Object.assign(row, { documentFileId: savedFile.id, sourceModule: AdmissionDocumentSource.F004, sourceDocumentId: null, fileReference: stored.publicUrl, fileName: file.originalname, mimeType: file.mimetype, fileSizeBytes: String(file.size), checksumSha256: checksum, status: AdmissionDocumentStatus.SUBMITTED, submittedBy: user.userId, submittedAt: new Date(), resubmissionReason: null, resubmissionRequestedAt: null, verifiedBy: null, verifiedAt: null });
          const savedRow = await manager.getRepository(ApplicantDocumentEntity).save(row); rows.push(savedRow);
          await manager.getRepository(DocumentVerificationAuditEntity).save(manager.getRepository(DocumentVerificationAuditEntity).create({ tenantId: user.tenantId, applicantDocumentId: savedRow.id, action: existing ? 'REPLACED' : 'UPLOADED', fromStatus: from, toStatus: savedRow.status, reason: null, actedBy: user.userId }));
        }
        return rows;
      });
      return Promise.all(saved.map(async (row) => ({ ...(await this.toDto(row, type)), downloadUrl: stored.downloadUrl })));
    } catch (error) { try { await this.storage.delete(stored.storageKey); } catch { /* best-effort cleanup */ } throw error; }
  }

  private async createRequirementLinks(user: AuthUser, app: ApplicationEntity, rules: OfferingRequiredDocumentEntity[], type: DocumentTypeEntity, fileRecord: ApplicantDocumentFileEntity, existingRows: ApplicantDocumentEntity[], action: string) {
    const existingByRequirement = new Map(existingRows.map((row) => [row.offeringRequiredDocumentId, row]));
    const saved = await this.dataSource.transaction(async (manager) => {
      const savedFile = await manager.getRepository(ApplicantDocumentFileEntity).save(fileRecord);
      const rows: ApplicantDocumentEntity[] = [];
      for (const rule of rules) {
        const existing = existingByRequirement.get(rule.id);
        const from = existing?.status ?? null;
        const row = existing ?? manager.getRepository(ApplicantDocumentEntity).create({ tenantId: user.tenantId, applicantId: app.id, applicationId: String(app.applicationId), programmeOfferingId: rule.programmeOfferingId, offeringRequiredDocumentId: rule.id, documentTypeId: type.id });
        Object.assign(row, { documentFileId: savedFile.id, sourceModule: savedFile.sourceModule, sourceDocumentId: savedFile.sourceDocumentId, fileReference: savedFile.fileReference, fileName: savedFile.fileName, mimeType: savedFile.mimeType, fileSizeBytes: savedFile.fileSizeBytes, checksumSha256: savedFile.checksumSha256, status: AdmissionDocumentStatus.SUBMITTED, submittedBy: user.userId, submittedAt: new Date(), resubmissionReason: null, resubmissionRequestedAt: null, verifiedBy: null, verifiedAt: null });
        const savedRow = await manager.getRepository(ApplicantDocumentEntity).save(row); rows.push(savedRow);
        await manager.getRepository(DocumentVerificationAuditEntity).save(manager.getRepository(DocumentVerificationAuditEntity).create({ tenantId: user.tenantId, applicantDocumentId: savedRow.id, action: existing ? 'REPLACED' : action, fromStatus: from, toStatus: savedRow.status, reason: null, actedBy: user.userId }));
      }
      return rows;
    });
    return Promise.all(saved.map((row) => this.getDocumentDto(row)));
  }
  private validateFile(file?: AdmissionUpload): asserts file is AdmissionUpload {
    if (!file) throw new BusinessException('Document file is required', HttpStatus.BAD_REQUEST, 'FILE_REQUIRED');
    const allowed = MIME_EXT[file.mimetype]; if (!allowed || !allowed.includes(extname(file.originalname).toLowerCase()) || !this.matchesSignature(file.buffer, file.mimetype)) throw new BusinessException('Only matching JPG, JPEG, PNG, GIF, BMP, and PDF files are allowed', HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'INVALID_DOCUMENT_FORMAT');
    const max = Number(process.env.ADMISSION_DOCUMENT_MAX_BYTES || 10 * 1024 * 1024); if (file.size > max) throw new BusinessException('Document exceeds the configured maximum file size', HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE');
  }
  private async requireCompatibleSelectedRules(tenantId: string, applicantId: string, ids: string[]) {
    if (!ids.length || new Set(ids).size !== ids.length) {
      throw new BusinessException(
        'Provide one or more unique offering requirement IDs',
        HttpStatus.BAD_REQUEST,
        'DOCUMENT_REQUIREMENTS_REQUIRED',
      );
    }
    const provided = await this.requirements.find({
      where: { id: In(ids), tenantId, active: true },
    });
    if (provided.length !== ids.length) {
      throw new BusinessException(
        'One or more active document requirements were not found',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_DOCUMENT_REQUIREMENT',
      );
    }
    const selected = await this.selectedOfferingIds(tenantId, applicantId);
    if (provided.some((rule) => !selected.includes(rule.programmeOfferingId))) {
      throw new BusinessException(
        'Every document requirement must belong to an offering selected by this applicant',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DOCUMENT_REQUIREMENT_NOT_SELECTED',
      );
    }
    const first = provided[0]!;
    const condition = first.conditionCode?.trim().toUpperCase() ?? null;
    if (
      provided.some(
        (rule) =>
          rule.documentTypeId !== first.documentTypeId ||
          (rule.conditionCode?.trim().toUpperCase() ?? null) !== condition,
      )
    ) {
      throw new BusinessException(
        'A shared upload can only cover requirements with the same document type and condition',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INCOMPATIBLE_DOCUMENT_REQUIREMENTS',
      );
    }
    // Expand to every matching selected-offering requirement so one file covers all programmes.
    const equivalent =
      selected.length > 0
        ? (
            await this.requirements.find({
              where: {
                tenantId,
                programmeOfferingId: In(selected),
                documentTypeId: first.documentTypeId,
                active: true,
              },
            })
          ).filter(
            (rule) => (rule.conditionCode?.trim().toUpperCase() ?? null) === condition,
          )
        : provided;
    const expandedIds = equivalent.map((rule) => rule.id);
    const selectedType = await this.types.findOneBy({
      id: first.documentTypeId,
      active: true,
    });
    if (!selectedType) throw new NotFoundException('Active document type not found');
    const oldRows = await this.documents.find({
      where: {
        tenantId,
        applicantId,
        offeringRequiredDocumentId: In(expandedIds),
      },
    });
    const oldFileIds = [
      ...new Set(
        oldRows
          .map((row) => row.documentFileId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    for (const oldFileId of oldFileIds) {
      const allLinked = await this.documents.find({
        where: { tenantId, applicantId, documentFileId: oldFileId },
      });
      if (
        allLinked.some((row) => !expandedIds.includes(row.offeringRequiredDocumentId))
      ) {
        throw new BusinessException(
          'Include every requirement linked to the returned shared file when replacing it',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'SHARED_DOCUMENT_REQUIREMENTS_INCOMPLETE',
        );
      }
    }
    return equivalent;
  }
  private async selectedOfferingIds(tenantId: string, applicantId: string) { const rows = await this.options.find({ where: { tenantId, applicantId } }); return rows.map(x => x.programmeOfferingId); }
  private async requireOffering(tenantId: string, id: string) { const row = await this.offerings.findOneBy({ id, tenantId }); if (!row) throw new NotFoundException('Programme offering not found'); return row; }
  private assertOfferingEditable(row: ProgrammeOfferingEntity) { if (!EDITABLE_OFFERING_STATUSES.includes(row.offeringStatus as any)) throw new ConflictException('Document requirements can only be configured while the offering is editable'); }
  private async requireOwned(user: AuthUser, applicantId: string) { const row = await this.applications.findOneBy({ id: applicantId, tenantId: user.tenantId }); if (!row) throw new NotFoundException('Application not found'); if (row.iamUserId !== user.userId) throw new ForbiddenException('You do not own this application'); return row; }
  private assertSubmitted(app: ApplicationEntity) {
    if (!['SUBMITTED', 'COMPLETE', 'APPROVED'].includes(app.applicationStatus)) {
      throw new BusinessException(
        'Application must be submitted before document actions',
        HttpStatus.CONFLICT,
        'APPLICATION_NOT_SUBMITTED',
      );
    }
  }
  private async requireDocument(tenantId: string, applicantId: string | undefined, id: string) { const where: any = { id, tenantId }; if (applicantId) where.applicantId = applicantId; const row = await this.documents.findOneBy(where); if (!row) throw new NotFoundException('Applicant document not found'); return row; }
  private uniqueFileRows(rows: ApplicantDocumentEntity[]) { const seen = new Set<string>(); return rows.filter((row) => { const key = row.documentFileId ?? row.id; if (seen.has(key)) return false; seen.add(key); return true; }); }
  private async getDocumentDto(row: ApplicantDocumentEntity) { const type = await this.types.findOneBy({ id: row.documentTypeId }); if (!type) throw new NotFoundException('Document type not found'); return this.toDto(row, type); }
  private async toDto(row: ApplicantDocumentEntity, type: DocumentTypeEntity) { const rule = await this.requirements.findOneBy({ id: row.offeringRequiredDocumentId, tenantId: row.tenantId }); const shared = row.documentFileId ? await this.documentFiles.findOneBy({ id: row.documentFileId, tenantId: row.tenantId, applicantId: row.applicantId }) : null; const sourceModule = shared?.sourceModule ?? row.sourceModule; const sourceDocumentId = shared?.sourceDocumentId ?? row.sourceDocumentId; let fileReference = shared?.fileReference ?? row.fileReference; if (sourceModule === AdmissionDocumentSource.F002 && sourceDocumentId) fileReference = (await this.academicDocs.findOneBy({ id: sourceDocumentId, tenantId: row.tenantId, applicantId: row.applicantId }))?.fileReference ?? null; const linked = row.documentFileId ? await this.documents.find({ where: { tenantId: row.tenantId, applicantId: row.applicantId, documentFileId: row.documentFileId }, order: { createdAt: 'ASC' } }) : [row]; return { id: row.id, documentFileId: row.documentFileId, applicantId: row.applicantId, programmeOfferingId: row.programmeOfferingId, offeringRequiredDocumentId: row.offeringRequiredDocumentId, documentTypeId: row.documentTypeId, documentTypeCode: type.code, documentTypeName: type.name, mandatory: rule?.mandatory ?? true, conditionCode: rule?.conditionCode ?? null, sourceModule, sourceDocumentId, fileReference, downloadUrl: fileReference ? await this.storage.resolveDownloadUrl(fileReference) : null, fileName: shared?.fileName ?? row.fileName, mimeType: shared?.mimeType ?? row.mimeType, fileSizeBytes: shared?.fileSizeBytes ?? row.fileSizeBytes, status: row.status, resubmissionReason: row.resubmissionReason, submittedAt: row.submittedAt, verifiedAt: row.verifiedAt, linkedRequirements: linked.map((item) => ({ applicantDocumentId: item.id, offeringRequiredDocumentId: item.offeringRequiredDocumentId, programmeOfferingId: item.programmeOfferingId, status: item.status })) }; }
  private matchesSignature(buffer: Buffer, mime: string) { if (mime === 'application/pdf') return buffer.subarray(0, 5).toString() === '%PDF-'; if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff; if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])); if (mime === 'image/gif') return ['GIF87a','GIF89a'].includes(buffer.subarray(0, 6).toString()); if (mime === 'image/bmp') return buffer.subarray(0, 2).toString() === 'BM'; return false; }
  private assertStaff(user: RequestContext) { if (!(user.roles ?? []).some(r => STAFF_ROLES.has(r.toUpperCase()))) throw new ForbiddenException('Admissions staff role is required'); }
}
