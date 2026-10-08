import { ConflictException, ForbiddenException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ApplicationStatus } from '../../common/enums/application-status.enum.js';
import { ProcessingFeeStatus } from '../../common/enums/processing-fee.enum.js';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { ApplicationAcademicDocumentEntity, ApplicationAcademicInformationEntity, ApplicationAddressEntity, ApplicationContactEntity, ApplicationDeclarationEntity, ApplicationEntity, ApplicationProgrammeOptionEntity, ApplicationStatusAuditEntity, IntakeEntity } from '../../database/entities/index.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../integrations/storage/object-storage.interface.js';
import { AdmissionDocumentsService } from '../admission-documents/admission-documents.service.js';
import { EntryTestService } from '../entry-test/entry-test.service.js';
import { ProcessingFeeService } from '../processing-fee/processing-fee.service.js';
import { ApplicationDecisionDto, ApplicationReviewQueue, ApplicationReviewQueryDto } from './dto/application-review.dto.js';

const STAFF_ROLES = new Set(['ADMISSION_MANAGER','ADMISSIONS_MANAGER','ADMISSIONS_ADMIN','ADMISSIONS_OFFICER','ADMIN','SUPER_ADMIN']);
const REJECTION_CODES = new Set(['NON_PAYMENT_BEYOND_DUE_PERIOD','UNVERIFIED_PAYMENT','INCOMPLETE_DOCUMENT_SET','FAILED_ELIGIBILITY_CRITERIA','OTHER']);
const VERIFIED_PAYMENT = new Set([ProcessingFeeStatus.VERIFIED, ProcessingFeeStatus.LATE_PAYMENT_VERIFIED]);

@Injectable()
export class ApplicationReviewService {
  constructor(
    @InjectRepository(ApplicationEntity) private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(IntakeEntity) private readonly intakes: Repository<IntakeEntity>,
    @InjectRepository(ApplicationAcademicInformationEntity) private readonly education: Repository<ApplicationAcademicInformationEntity>,
    @InjectRepository(ApplicationAcademicDocumentEntity) private readonly academicDocuments: Repository<ApplicationAcademicDocumentEntity>,
    @InjectRepository(ApplicationProgrammeOptionEntity) private readonly programmeOptions: Repository<ApplicationProgrammeOptionEntity>,
    @InjectRepository(ApplicationAddressEntity) private readonly addresses: Repository<ApplicationAddressEntity>,
    @InjectRepository(ApplicationContactEntity) private readonly contacts: Repository<ApplicationContactEntity>,
    @InjectRepository(ApplicationDeclarationEntity) private readonly declarations: Repository<ApplicationDeclarationEntity>,
    @InjectRepository(ApplicationStatusAuditEntity) private readonly statusAudits: Repository<ApplicationStatusAuditEntity>,
    private readonly admissionDocuments: AdmissionDocumentsService,
    private readonly processingFees: ProcessingFeeService,
    private readonly entryTest: EntryTestService,
    private readonly dataSource: DataSource,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async summary(user: RequestContext) {
    this.assertStaff(user);
    const assessments = await this.assessQueue(user.tenantId);
    const count = (queue: ApplicationReviewQueue) =>
      assessments.filter(({ app, readiness }) => this.matchesQueue(app, readiness, queue)).length;
    return {
      totalSubmitted: count(ApplicationReviewQueue.SUBMITTED),
      paidProcessingFee: count(ApplicationReviewQueue.PAID_PROCESSING_FEE),
      unpaidProcessingFee: count(ApplicationReviewQueue.UNPAID_PROCESSING_FEE),
      missingDocuments: count(ApplicationReviewQueue.MISSING_DOCUMENTS),
      missingFeeAndDocuments: count(ApplicationReviewQueue.MISSING_FEE_AND_DOCUMENTS),
      missingFee: count(ApplicationReviewQueue.MISSING_FEE),
      approved: count(ApplicationReviewQueue.APPROVED),
      rejected: count(ApplicationReviewQueue.REJECTED),
    };
  }

  async list(user: RequestContext, query: ApplicationReviewQueryDto) {
    this.assertStaff(user);
    const candidates = await this.applications.find({
      where: { tenantId: user.tenantId, applicationStatus: In([ApplicationStatus.COMPLETE, ApplicationStatus.SUBMITTED, ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]) },
      order: { submissionDate: 'DESC', createdAt: 'DESC' },
    });
    const search = query.search?.trim().toLocaleLowerCase();
    const searched = search ? candidates.filter(a => [a.applicantName, a.registeredEmail, a.applicationReference, String(a.applicationId)].some(v => v.toLocaleLowerCase().includes(search))) : candidates;
    const assessments = await Promise.all(searched.map(async app => ({ app, readiness: await this.readiness(user.tenantId, app) })));
    const filtered = query.queue ? assessments.filter(({ app, readiness }) => this.matchesQueue(app, readiness, query.queue!)) : assessments;
    const total = filtered.length;
    const offset = (query.page - 1) * query.limit;
    const rows = filtered.slice(offset, offset + query.limit);
    const applicantIds = rows.map(({ app }) => app.id);
    const [intakeRows, preferenceRows] = await Promise.all([
      rows.length
        ? this.intakes.findBy({ id: In([...new Set(rows.map(x => x.app.intakeId))]), tenantId: user.tenantId })
        : Promise.resolve([]),
      applicantIds.length
        ? this.programmeOptions.find({
            where: { tenantId: user.tenantId, applicantId: In(applicantIds) },
            relations: { programmeOffering: { programme: true } },
            order: { preferenceOrder: 'ASC' },
          })
        : Promise.resolve([]),
    ]);
    const intakeNames = new Map(intakeRows.map(i => [i.id, i.intakeName]));
    const preferencesByApplicant = new Map<string, Array<{
      id: string;
      preferenceOrder: number;
      programmeOfferingId: string;
      programmeId: string | null;
      programmeCode: string | null;
      programmeName: string | null;
    }>>();
    for (const option of preferenceRows) {
      const list = preferencesByApplicant.get(option.applicantId) ?? [];
      list.push({
        id: option.id,
        preferenceOrder: option.preferenceOrder,
        programmeOfferingId: option.programmeOfferingId,
        programmeId: option.programmeOffering?.programme?.id ?? null,
        programmeCode: option.programmeOffering?.programme?.code ?? null,
        programmeName: option.programmeOffering?.programme?.name ?? null,
      });
      preferencesByApplicant.set(option.applicantId, list);
    }
    return {
      items: rows.map(({ app, readiness }) => ({
        applicantId: app.id, applicationId: String(app.applicationId), applicationReference: app.applicationReference,
        applicantName: app.applicantName, registeredEmail: app.registeredEmail, intakeName: intakeNames.get(app.intakeId) ?? '',
        status: app.applicationStatus, paymentStatus: app.processingFeeStatus, documentsComplete: readiness.documentsComplete,
        approvalAllowed: readiness.approvalAllowed, unmetPreconditions: readiness.unmetPreconditions,
        statusUpdatedAt: app.statusUpdatedAt,
        programmePreferences: preferencesByApplicant.get(app.id) ?? [],
      })),
      meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) },
    };
  }

  async review(user: RequestContext, applicantId: string) {
    this.assertStaff(user);
    const app = await this.getApplication(user.tenantId, applicantId);
    const [intake, educationRows, options, addresses, contacts, declaration, documents, payment, readiness] = await Promise.all([
      this.intakes.findOneBy({ id: app.intakeId, tenantId: user.tenantId }),
      this.education.find({ where: { tenantId: user.tenantId, applicantId }, order: { createdAt: 'ASC' } }),
      this.programmeOptions.find({ where: { tenantId: user.tenantId, applicantId }, relations: { programmeOffering: { programme: true } }, order: { preferenceOrder: 'ASC' } }),
      this.addresses.find({ where: { tenantId: user.tenantId, applicantId }, order: { addressType: 'ASC' } }),
      this.contacts.find({ where: { tenantId: user.tenantId, applicantId }, order: { contactType: 'ASC' } }),
      this.declarations.findOneBy({ tenantId: user.tenantId, applicantId }),
      this.admissionDocuments.staffApplicationDocuments(user, applicantId),
      this.processingFees.applicationPayment(this.toAuthUser(user), applicantId),
      this.readiness(user.tenantId, app),
    ]);
    const education = await Promise.all(educationRows.map(async row => ({
      id: row.id, degreeType: row.degreeType, rollNumber: row.rollNumber, qualificationName: row.qualificationName,
      boardOrInstitution: row.boardOrInstitution, passingYear: row.passingYear, division: row.division,
      grade: row.grade, marksOrGpaObtained: row.marksOrGpaObtained, marksOrGpaTotal: row.marksOrGpaTotal,
      percentage: Number(row.percentage), documents: await Promise.all((await this.academicDocuments.find({ where: { tenantId: user.tenantId, applicantId, academicInformationId: row.id } })).map(async doc => ({
        id: doc.id, documentType: doc.documentType, originalFileName: doc.originalFileName, mimeType: doc.mimeType,
        fileSize: doc.fileSize, fileReference: doc.fileReference, downloadUrl: await this.storage.resolveDownloadUrl(doc.fileReference),
        uploadedAt: doc.uploadedAt, verificationStatus: doc.verificationStatus,
      }))),
    })));
    const readinessNow = readiness;
    return {
      application: {
        ...app,
        applicationId: String(app.applicationId),
        profilePhotographDownloadUrl: app.profilePhotograph ? await this.storage.resolveDownloadUrl(app.profilePhotograph) : null,
      },
      intake,
      education,
      programmePreferences: options.map(option => ({
        id: option.id, preferenceOrder: option.preferenceOrder, programmeOfferingId: option.programmeOfferingId,
        programmeOffering: option.programmeOffering,
      })),
      addresses,
      contacts,
      declaration,
      documents,
      payment,
      approvalAllowed: readinessNow.approvalAllowed,
      unmetPreconditions: readinessNow.unmetPreconditions,
    };
  }

  async decide(user: RequestContext, applicantId: string, dto: ApplicationDecisionDto) {
    this.assertStaff(user);
    const status = dto.status;
    if (![ApplicationStatus.APPROVED, ApplicationStatus.REJECTED].includes(status)) throw new BusinessException('Decision must be APPROVED or REJECTED', HttpStatus.BAD_REQUEST, 'INVALID_DECISION');
    const isRejection = status === ApplicationStatus.REJECTED;
    const reasonCode = dto.reasonCode?.trim().toUpperCase() ?? null;
    const reasonText = dto.reasonText?.trim() ?? null;
    if (isRejection && (!reasonCode || !REJECTION_CODES.has(reasonCode) || !reasonText)) throw new BusinessException('A valid rejection reason code and reason text are required', HttpStatus.UNPROCESSABLE_ENTITY, 'REJECTION_REASON_REQUIRED');
    if (!isRejection && (reasonCode || reasonText)) throw new BusinessException('Rejection reasons may only be provided when rejecting', HttpStatus.BAD_REQUEST, 'UNEXPECTED_REJECTION_REASON');

    const saved = await this.dataSource.transaction(async manager => {
      const app = await manager.getRepository(ApplicationEntity).findOne({ where: { id: applicantId, tenantId: user.tenantId }, lock: { mode: 'pessimistic_write' } });
      if (!app) throw new NotFoundException('Application not found');
      if (app.applicationStatus === status) return { app, previousStatus: status, unchanged: true };
      if (![ApplicationStatus.COMPLETE, ApplicationStatus.SUBMITTED].includes(app.applicationStatus as ApplicationStatus)) throw new ConflictException(`Application in ${app.applicationStatus} status cannot receive a decision`);
      if (!isRejection) {
        const readiness = await this.readiness(user.tenantId, app);
        if (!readiness.approvalAllowed) throw new BusinessException('Application cannot be approved until all preconditions are met', HttpStatus.UNPROCESSABLE_ENTITY, 'APPROVAL_PRECONDITIONS_NOT_MET', { unmetPreconditions: readiness.unmetPreconditions });
      }
      const previousStatus = app.applicationStatus;
      app.applicationStatus = status;
      app.rejectionReasonCode = reasonCode;
      app.rejectionReason = reasonText;
      app.statusUpdatedBy = user.userId;
      app.statusUpdatedAt = new Date();
      const savedApp = await manager.getRepository(ApplicationEntity).save(app);
      await manager.getRepository(ApplicationStatusAuditEntity).save(manager.getRepository(ApplicationStatusAuditEntity).create({
        tenantId: user.tenantId, applicantId: app.id, fromStatus: previousStatus, toStatus: status,
        reasonCode, reason: reasonText, actedBy: user.userId, source: 'MANUAL',
      }));
      return { app: savedApp, previousStatus, unchanged: false };
    });
    const response = {
      applicantId: saved.app.id, applicationReference: saved.app.applicationReference,
      previousStatus: saved.previousStatus, status: saved.app.applicationStatus,
      rejectionReasonCode: saved.app.rejectionReasonCode, rejectionReason: saved.app.rejectionReason,
      statusUpdatedBy: saved.app.statusUpdatedBy ?? user.userId,
      statusUpdatedAt: saved.app.statusUpdatedAt ?? new Date(),
      unchanged: saved.unchanged,
      admitCard: null as Awaited<ReturnType<EntryTestService['generateAdmitCard']>> | null,
    };
    if (saved.app.applicationStatus === ApplicationStatus.APPROVED) {
      response.admitCard = await this.entryTest.generateAdmitCard(user, applicantId);
    }
    return response;
  }

  async history(user: RequestContext, applicantId: string) {
    this.assertStaff(user); await this.getApplication(user.tenantId, applicantId);
    return this.statusAudits.find({ where: { tenantId: user.tenantId, applicantId }, order: { actedAt: 'DESC' } });
  }

  private async assessQueue(tenantId: string) {
    const candidates = await this.applications.find({
      where: {
        tenantId,
        applicationStatus: In([
          ApplicationStatus.COMPLETE,
          ApplicationStatus.SUBMITTED,
          ApplicationStatus.APPROVED,
          ApplicationStatus.REJECTED,
        ]),
      },
      order: { submissionDate: 'DESC', createdAt: 'DESC' },
    });
    return Promise.all(
      candidates.map(async (app) => ({
        app,
        readiness: await this.readiness(tenantId, app),
      })),
    );
  }

  private async readiness(tenantId: string, app: ApplicationEntity) {
    const paymentVerified = VERIFIED_PAYMENT.has(app.processingFeeStatus);
    const documents = await this.admissionDocuments.reviewCompleteness(tenantId, app.id);
    const unmetPreconditions: string[] = [];
    if (![ApplicationStatus.COMPLETE, ApplicationStatus.SUBMITTED].includes(app.applicationStatus as ApplicationStatus)) unmetPreconditions.push('APPLICATION_NOT_SUBMITTED');
    if (!paymentVerified) unmetPreconditions.push('PROCESSING_FEE_NOT_VERIFIED');
    if (!documents.complete) unmetPreconditions.push('DOCUMENT_SET_INCOMPLETE');
    return { paymentVerified, documentsComplete: documents.complete, approvalAllowed: unmetPreconditions.length === 0, unmetPreconditions };
  }
  private matchesQueue(app: ApplicationEntity, readiness: Awaited<ReturnType<ApplicationReviewService['readiness']>>, queue: ApplicationReviewQueue) {
    const paid = readiness.paymentVerified; const docs = readiness.documentsComplete;
    switch (queue) {
      case ApplicationReviewQueue.SUBMITTED: return [ApplicationStatus.COMPLETE, ApplicationStatus.SUBMITTED].includes(app.applicationStatus as ApplicationStatus);
      case ApplicationReviewQueue.PAID_PROCESSING_FEE: return app.applicationStatus === ApplicationStatus.COMPLETE && paid;
      case ApplicationReviewQueue.UNPAID_PROCESSING_FEE: return app.applicationStatus === ApplicationStatus.COMPLETE && !paid;
      case ApplicationReviewQueue.APPROVED: return app.applicationStatus === ApplicationStatus.APPROVED;
      case ApplicationReviewQueue.REJECTED: return app.applicationStatus === ApplicationStatus.REJECTED;
      case ApplicationReviewQueue.MISSING_FEE: return app.applicationStatus === ApplicationStatus.COMPLETE && !paid && docs;
      case ApplicationReviewQueue.MISSING_DOCUMENTS: return app.applicationStatus === ApplicationStatus.COMPLETE && paid && !docs;
      case ApplicationReviewQueue.MISSING_FEE_AND_DOCUMENTS: return app.applicationStatus === ApplicationStatus.COMPLETE && !paid && !docs;
    }
  }
  private async getApplication(tenantId: string, id: string) { const app = await this.applications.findOneBy({ id, tenantId }); if (!app) throw new NotFoundException('Application not found'); return app; }
  private toAuthUser(user: RequestContext): AuthUser { return { userId: user.userId, email: user.email ?? '', tenantId: user.tenantId, roles: user.roles ?? [] }; }
  private assertStaff(user: RequestContext) { if (!(user.roles ?? []).some(r => STAFF_ROLES.has(r.toUpperCase()))) throw new ForbiddenException('Admissions staff role is required'); }
}
