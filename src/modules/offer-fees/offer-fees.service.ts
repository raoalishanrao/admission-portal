import {
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
  type EntityManager,
} from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import type { RequestContext } from '../../common/decorators/request-context.decorator.js';
import {
  OfferExpiredReason,
  OfferFeeStatus,
  SeatReleaseTrigger,
  isOfferFeeType,
} from '../../common/enums/offer-fee.enum.js';
import {
  PaymentEvidenceSource,
  PaymentEvidenceVerificationIndicator,
} from '../../common/enums/processing-fee.enum.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import {
  AdmissionOfferFeeChallanEntity,
  AdmissionOfferFeeChallanItemEntity,
  AdmissionOfferFeeEvidenceEntity,
  ApplicationEntity,
  DesignatedBankEntity,
  IntakeEntity,
  OfferingFeeEntity,
  ProgrammeOfferingEntity,
  SelectionSeatReleaseRunEntity,
} from '../../database/entities/index.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../integrations/storage/object-storage.interface.js';
import type {
  ExpireUnpaidOffersDto,
  VerifyOfferFeeEvidenceDto,
} from './dto/offer-fee.dto.js';

type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

const EVIDENCE_MIME = new Map([
  ['image/jpeg', 'JPG'],
  ['image/jpg', 'JPG'],
  ['image/png', 'PNG'],
  ['image/gif', 'GIF'],
  ['image/bmp', 'BMP'],
  ['application/pdf', 'PDF'],
]);

const PAID = new Set([
  OfferFeeStatus.VERIFIED,
  OfferFeeStatus.LATE_PAYMENT_VERIFIED,
]);

@Injectable()
export class OfferFeesService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(AdmissionOfferFeeChallanEntity)
    private readonly challans: Repository<AdmissionOfferFeeChallanEntity>,
    @InjectRepository(AdmissionOfferFeeChallanItemEntity)
    private readonly items: Repository<AdmissionOfferFeeChallanItemEntity>,
    @InjectRepository(AdmissionOfferFeeEvidenceEntity)
    private readonly evidences: Repository<AdmissionOfferFeeEvidenceEntity>,
    @InjectRepository(SelectionSeatReleaseRunEntity)
    private readonly seatReleases: Repository<SelectionSeatReleaseRunEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(IntakeEntity)
    private readonly intakes: Repository<IntakeEntity>,
    @InjectRepository(OfferingFeeEntity)
    private readonly offeringFees: Repository<OfferingFeeEntity>,
    @InjectRepository(ProgrammeOfferingEntity)
    private readonly offerings: Repository<ProgrammeOfferingEntity>,
    @InjectRepository(DesignatedBankEntity)
    private readonly banks: Repository<DesignatedBankEntity>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  admin(ctx: RequestContext) {
    const roles = new Set((ctx.roles ?? []).map((r) => String(r).toUpperCase()));
    if (
      ![
        'ADMISSIONS_ADMIN',
        'ADMISSIONS_OFFICER',
        'TENANT_ADMIN',
        'SUPER_ADMIN',
        'ADMIN',
      ].some((r) => roles.has(r))
    ) {
      throw new BusinessException(
        'Admissions staff role required',
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
      );
    }
  }

  /**
   * Generate (or return existing) admission-fee challan for a published offer.
   * Line items = offering_fees excluding APPLICATION/PROCESSING.
   */
  async generateForOffer(
    tenantId: string,
    offer: {
      id?: string;
      application_record_id?: string;
      applicationRecordId?: string;
      programme_offering_id?: string;
      programmeOfferingId?: string;
      acceptance_deadline?: Date | string;
      acceptanceDeadline?: Date | string;
    },
  ) {
    const offerId = String(offer.id ?? '').trim();
    const applicationRecordId = String(
      offer.application_record_id ?? offer.applicationRecordId ?? '',
    ).trim();
    const programmeOfferingId = String(
      offer.programme_offering_id ?? offer.programmeOfferingId ?? '',
    ).trim();
    const acceptanceDeadline =
      offer.acceptance_deadline ?? offer.acceptanceDeadline;
    if (!offerId || !applicationRecordId || !programmeOfferingId || !acceptanceDeadline) {
      throw new BusinessException(
        'Offer payload is missing id / application / offering / deadline for fee challan generation',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'OFFER_FEE_INVALID_OFFER',
        { offerId, applicationRecordId, programmeOfferingId, hasDeadline: Boolean(acceptanceDeadline) },
      );
    }

    const existing = await this.challans.findOne({
      where: { tenantId, offerId },
    });
    if (existing) return this.challanResponse(existing, true);

    const app = await this.applications.findOne({
      where: { id: applicationRecordId, tenantId },
    });
    if (!app) throw new NotFoundException('Application not found');

    const intake = await this.intakes.findOne({
      where: { id: app.intakeId, tenantId },
    });
    if (!intake) throw new NotFoundException('Intake not found');

    const offering = await this.offerings.findOne({
      where: { id: programmeOfferingId, tenantId },
      relations: { programme: true },
    });
    if (!offering) throw new NotFoundException('Programme offering not found');

    const now = new Date();
    const feeRows = await this.offeringFees.find({
      where: {
        tenantId,
        programmeOfferingId: offering.id,
        status: 'ACTIVE',
      },
      relations: { generalFee: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const effective = feeRows.filter(
      (f) =>
        f.generalFee?.status === 'ACTIVE' &&
        isOfferFeeType(f.generalFee.feeType) &&
        (!f.effectiveFrom || f.effectiveFrom <= now) &&
        (!f.effectiveTo || f.effectiveTo >= now),
    );
    const unique = [
      ...new Map(effective.map((f) => [f.generalFeeId, f])).values(),
    ];
    if (!unique.length) {
      throw new BusinessException(
        'No active admission/tuition fees are configured for the selected programme offering',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'OFFER_FEE_NOT_CONFIGURED',
      );
    }
    if (new Set(unique.map((f) => f.generalFee.currency)).size !== 1) {
      throw new BusinessException(
        'All offer fee items must use the same currency',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'OFFER_FEE_CURRENCY_MISMATCH',
      );
    }

    const bank = await this.resolveBank(tenantId, now);
    const total = unique.reduce((s, f) => s + Number(f.generalFee.amount), 0);
    if (!Number.isFinite(total) || total <= 0) {
      throw new BusinessException(
        'Configured offer fee must be greater than zero',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_OFFER_FEE',
      );
    }

    const dueDate = new Date(acceptanceDeadline);
    const challanNumber = await this.newChallanNumber(now);
    const currency = unique[0].generalFee.currency;

    const saved = await this.db.transaction(async (manager) => {
      const row = manager.create(AdmissionOfferFeeChallanEntity, {
        tenantId,
        offerId,
        applicantId: app.id,
        programmeOfferingId: offering.id,
        challanNumber,
        issueDate: now,
        dueDate,
        designatedBankId: bank.id,
        collectionBankName: bank.bankName,
        collectionBankBranch: bank.branchName,
        collectionBankAccount: bank.accountNumber,
        branchCode: bank.branchCode,
        institutionCode: null,
        applicantName: app.applicantName,
        applicantContactNumber: app.mobileNumber,
        registrationNumber: app.applicationReference,
        intakeSession: intake.intakeName,
        programmeName: offering.programme?.name ?? offering.id,
        totalAmountPayable: total.toFixed(2),
        amountInWords: `${this.amountInWords(total)} ${currency} only`,
        paymentStatus: OfferFeeStatus.UNPAID,
        latePaymentFlag: false,
        paymentDate: null,
        amountPaid: null,
        verifiedBy: null,
        verificationDate: null,
      });
      const challan = await manager.save(row);
      await manager.save(
        AdmissionOfferFeeChallanItemEntity,
        unique.map((f) =>
          manager.create(AdmissionOfferFeeChallanItemEntity, {
            tenantId,
            challanId: challan.id,
            feeTypeCode: f.generalFee.feeType,
            description: f.generalFee.feeType.replaceAll('_', ' '),
            quantity: '1.00',
            unitAmount: f.generalFee.amount,
            amount: f.generalFee.amount,
            currency: f.generalFee.currency,
            dueDate,
            sourceReference: f.generalFeeId,
            offeringFeeId: f.id,
          }),
        ),
      );
      await manager.query(
        `UPDATE admission_offers SET fee_challan_id=$3, updated_at=now()
         WHERE tenant_id=$1 AND id=$2`,
        [tenantId, offerId, challan.id],
      );
      return challan;
    });

    return this.challanResponse(saved, true);
  }

  async getChallanForApplicant(user: AuthUser, applicantId: string) {
    await this.requireApplicant(user, applicantId);
    const challan = await this.resolveChallanForApplicant(
      user.tenantId,
      applicantId,
      { ensureIfPublished: true },
    );
    if (!challan) throw new NotFoundException('Offer fee challan not found');
    return this.challanResponse(challan, true);
  }

  /**
   * Resolve offer-fee challan + current evidence for an application.
   * If the offer is PUBLISHED but the challan was never generated (e.g. fee
   * config was missing at publish time), optionally attempts generation.
   */
  async getOfferFeeBundleForApplicant(
    user: AuthUser,
    applicantId: string,
    options?: { ensureIfPublished?: boolean },
  ) {
    await this.requireApplicant(user, applicantId);
    return this.getOfferFeeBundle(user.tenantId, applicantId, options);
  }

  async getOfferFeeBundle(
    tenantId: string,
    applicantId: string,
    options?: { ensureIfPublished?: boolean },
  ) {
    const challan = await this.resolveChallanForApplicant(tenantId, applicantId, {
      ensureIfPublished: options?.ensureIfPublished ?? true,
    });
    if (!challan) {
      return { challan: null, currentEvidence: null };
    }
    const evidence = await this.evidences.findOne({
      where: {
        tenantId,
        challanId: challan.id,
        isCurrent: true,
      },
      order: { uploadDate: 'DESC' },
    });
    return {
      challan: await this.challanResponse(challan, true),
      currentEvidence: evidence
        ? {
            id: evidence.id,
            challanId: evidence.challanId,
            fileFormat: evidence.fileFormat,
            evidenceSource: evidence.evidenceSource,
            amountClaimed: evidence.amountClaimed,
            verificationIndicator: evidence.verificationIndicator,
            uploadDate: evidence.uploadDate.toISOString(),
            downloadUrl: await this.storage
              .resolveDownloadUrl(evidence.storageKey)
              .catch(() => null),
          }
        : null,
    };
  }

  private async resolveChallanForApplicant(
    tenantId: string,
    applicantId: string,
    options?: { ensureIfPublished?: boolean },
  ) {
    let challan = await this.challans.findOne({
      where: { tenantId, applicantId },
      order: { createdAt: 'DESC' },
    });
    if (challan) return challan;

    const offer = (
      await this.db.query(
        `SELECT *
         FROM admission_offers
         WHERE tenant_id = $1
           AND application_record_id = $2
           AND status IN ('PUBLISHED', 'ACCEPTED', 'DECLINED', 'EXPIRED')
         ORDER BY
           CASE status
             WHEN 'PUBLISHED' THEN 0
             WHEN 'ACCEPTED' THEN 1
             ELSE 2
           END,
           created_at DESC
         LIMIT 1`,
        [tenantId, applicantId],
      )
    )[0] as
      | {
          id: string;
          fee_challan_id: string | null;
          status: string;
          application_record_id: string;
          programme_offering_id: string;
          acceptance_deadline: Date | string;
        }
      | undefined;

    if (!offer) return null;

    if (offer.fee_challan_id) {
      challan = await this.challans.findOne({
        where: { id: offer.fee_challan_id, tenantId },
      });
      if (challan) return challan;
    }

    challan = await this.challans.findOne({
      where: { tenantId, offerId: offer.id },
    });
    if (challan) return challan;

    if (
      options?.ensureIfPublished &&
      (offer.status === 'PUBLISHED' || offer.status === 'ACCEPTED')
    ) {
      try {
        const generated = await this.generateForOffer(tenantId, offer);
        return this.challans.findOne({
          where: { id: generated.id, tenantId },
        });
      } catch {
        return null;
      }
    }

    return null;
  }

  async getChallanByOffer(ctx: RequestContext, offerId: string) {
    this.admin(ctx);
    const challan = await this.challans.findOne({
      where: { tenantId: ctx.tenantId, offerId },
    });
    if (!challan) throw new NotFoundException('Offer fee challan not found');
    return this.challanResponse(challan, true);
  }

  async generateForExistingOffer(ctx: RequestContext, offerId: string) {
    this.admin(ctx);
    const offer = (
      await this.db.query(
        `SELECT * FROM admission_offers WHERE tenant_id=$1 AND id=$2`,
        [ctx.tenantId, offerId],
      )
    )[0];
    if (!offer) throw new NotFoundException('Offer not found');
    if (!['PUBLISHED', 'AUTHORIZED', 'ACCEPTED'].includes(offer.status)) {
      throw new BusinessException(
        'Offer fee challan can only be generated for AUTHORIZED/PUBLISHED/ACCEPTED offers',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'OFFER_STATUS_INVALID',
      );
    }
    return this.generateForOffer(ctx.tenantId, offer);
  }

  async uploadEvidence(
    user: AuthUser,
    applicantId: string,
    file?: UploadFile,
    amountClaimed?: number,
  ) {
    await this.requireApplicant(user, applicantId);
    if (!file?.buffer?.length) {
      throw new BusinessException(
        'Payment evidence file is required',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
      );
    }
    const format = EVIDENCE_MIME.get(file.mimetype);
    if (!format) {
      throw new BusinessException(
        'Accepted formats are JPG, JPEG, PNG, GIF, BMP and PDF',
        HttpStatus.BAD_REQUEST,
        'UNSUPPORTED_EVIDENCE_FORMAT',
      );
    }
    const challan = await this.challans.findOne({
      where: { tenantId: user.tenantId, applicantId },
      order: { createdAt: 'DESC' },
    });
    if (!challan) {
      throw new NotFoundException(
        'Generate/publish the offer fee challan before uploading evidence',
      );
    }
    if (PAID.has(challan.paymentStatus) || challan.paymentStatus === OfferFeeStatus.EXPIRED) {
      throw new BusinessException(
        'Payment evidence cannot be uploaded for this challan status',
        HttpStatus.CONFLICT,
        'OFFER_FEE_NOT_UPLOADABLE',
      );
    }

    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      folder: `admissions/offer-fee-evidence/${applicantId}/${challan.id}`,
      fileName: file.originalname,
    });

    const current = await this.evidences.findOne({
      where: { tenantId: user.tenantId, challanId: challan.id, isCurrent: true },
    });

    const saved = await this.evidences.manager.transaction(async (manager) => {
      if (current) {
        current.isCurrent = false;
        await manager.save(current);
      }
      const row = await manager.save(
        manager.create(AdmissionOfferFeeEvidenceEntity, {
          tenantId: user.tenantId,
          applicantId,
          challanId: challan.id,
          storageKey: stored.storageKey,
          fileFormat: format,
          evidenceSource: PaymentEvidenceSource.BANK_RECEIPT,
          amountClaimed:
            amountClaimed != null && Number.isFinite(amountClaimed)
              ? Number(amountClaimed).toFixed(2)
              : null,
          depositedAt: null,
          verificationIndicator: PaymentEvidenceVerificationIndicator.UNVERIFIED,
          verifiedBy: null,
          verificationDate: null,
          reviewNotes: null,
          replacedBy: null,
          isCurrent: true,
        }),
      );
      if (current) {
        current.replacedBy = row.id;
        await manager.save(current);
      }
      challan.paymentStatus = OfferFeeStatus.EVIDENCE_SUBMITTED;
      await manager.save(challan);
      return row;
    });

    return {
      id: saved.id,
      challanId: saved.challanId,
      fileFormat: saved.fileFormat,
      evidenceSource: saved.evidenceSource,
      amountClaimed: saved.amountClaimed,
      verificationIndicator: saved.verificationIndicator,
      uploadDate: saved.uploadDate.toISOString(),
      downloadUrl: await this.storage.resolveDownloadUrl(saved.storageKey),
    };
  }

  async verifyEvidence(
    ctx: RequestContext,
    evidenceId: string,
    dto: VerifyOfferFeeEvidenceDto,
  ) {
    this.admin(ctx);
    const evidence = await this.evidences.findOne({
      where: { id: evidenceId, tenantId: ctx.tenantId, isCurrent: true },
    });
    if (!evidence) throw new NotFoundException('Offer fee evidence not found');

    const challan = await this.challans.findOne({
      where: { id: evidence.challanId, tenantId: ctx.tenantId },
    });
    if (!challan) throw new NotFoundException('Offer fee challan not found');
    if (PAID.has(challan.paymentStatus)) {
      throw new BusinessException(
        'Offer fee is already verified',
        HttpStatus.CONFLICT,
        'OFFER_FEE_ALREADY_VERIFIED',
      );
    }
    if (challan.paymentStatus === OfferFeeStatus.EXPIRED) {
      throw new BusinessException(
        'Expired offer fee cannot be verified',
        HttpStatus.CONFLICT,
        'OFFER_FEE_EXPIRED',
      );
    }

    if (dto.verificationIndicator === PaymentEvidenceVerificationIndicator.REJECTED) {
      evidence.verificationIndicator = PaymentEvidenceVerificationIndicator.REJECTED;
      evidence.verifiedBy = ctx.userId;
      evidence.verificationDate = new Date();
      evidence.reviewNotes = dto.reviewNotes?.trim() || null;
      await this.evidences.save(evidence);
      challan.paymentStatus = OfferFeeStatus.UNPAID;
      await this.challans.save(challan);
      return { evidenceId: evidence.id, paymentStatus: challan.paymentStatus };
    }

    const app = await this.applications.findOne({
      where: { id: challan.applicantId, tenantId: ctx.tenantId },
    });
    const intake = app
      ? await this.intakes.findOne({ where: { id: app.intakeId, tenantId: ctx.tenantId } })
      : null;
    const marginPct = Number(intake?.feeConfirmMarginPercent ?? 0);
    const due = Number(challan.totalAmountPayable);
    const paid =
      dto.amountPaid != null && Number.isFinite(dto.amountPaid)
        ? Number(dto.amountPaid)
        : evidence.amountClaimed != null
          ? Number(evidence.amountClaimed)
          : due;
    const allowedDelta = (due * marginPct) / 100;
    if (Math.abs(paid - due) > allowedDelta + 0.009) {
      throw new BusinessException(
        `Paid amount ${paid} is outside the allowed margin (±${marginPct}%) of due ${due}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        'OFFER_FEE_AMOUNT_OUTSIDE_MARGIN',
      );
    }

    const now = new Date();
    const late =
      Boolean(dto.forceLate) || now.getTime() > new Date(challan.dueDate).getTime();
    const status = late
      ? OfferFeeStatus.LATE_PAYMENT_VERIFIED
      : OfferFeeStatus.VERIFIED;

    await this.db.transaction(async (manager) => {
      evidence.verificationIndicator = PaymentEvidenceVerificationIndicator.VERIFIED;
      evidence.verifiedBy = ctx.userId;
      evidence.verificationDate = now;
      evidence.reviewNotes = dto.reviewNotes?.trim() || null;
      await manager.save(evidence);

      challan.paymentStatus = status;
      challan.paymentDate = now;
      challan.amountPaid = paid.toFixed(2);
      challan.latePaymentFlag = late;
      challan.verifiedBy = ctx.userId;
      challan.verificationDate = now;
      await manager.save(challan);

      await manager.query(
        `UPDATE admission_offers
         SET status='ACCEPTED', fee_verified_at=$3, updated_at=now()
         WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED'`,
        [ctx.tenantId, challan.offerId, now],
      );
    });

    return {
      evidenceId: evidence.id,
      challanId: challan.id,
      paymentStatus: status,
      amountPaid: paid.toFixed(2),
      latePaymentFlag: late,
    };
  }

  /** Bank-CSV driven verification for an offer-fee challan. */
  async verifyChallanFromBank(
    tenantId: string,
    actorUserId: string,
    challanId: string,
    amount: number,
    paidAt: Date,
    late: boolean,
  ) {
    const challan = await this.challans.findOne({
      where: { id: challanId, tenantId },
    });
    if (!challan) throw new NotFoundException('Offer fee challan not found');
    if (PAID.has(challan.paymentStatus)) {
      return { challanId, paymentStatus: challan.paymentStatus, alreadyVerified: true };
    }
    if (challan.paymentStatus === OfferFeeStatus.EXPIRED) {
      throw new BusinessException(
        'Expired offer fee cannot be verified from bank feed',
        HttpStatus.CONFLICT,
        'OFFER_FEE_EXPIRED',
      );
    }

    const status = late
      ? OfferFeeStatus.LATE_PAYMENT_VERIFIED
      : OfferFeeStatus.VERIFIED;
    const now = new Date();

    await this.db.transaction(async (manager) => {
      const evidence = await manager.findOne(AdmissionOfferFeeEvidenceEntity, {
        where: { tenantId, challanId: challan.id, isCurrent: true },
      });
      if (
        evidence &&
        evidence.verificationIndicator ===
          PaymentEvidenceVerificationIndicator.UNVERIFIED
      ) {
        evidence.verificationIndicator =
          PaymentEvidenceVerificationIndicator.VERIFIED;
        evidence.verifiedBy = actorUserId || 'SYSTEM';
        evidence.verificationDate = now;
        await manager.save(evidence);
      }

      challan.paymentStatus = status;
      challan.paymentDate = paidAt;
      challan.amountPaid = Number(amount).toFixed(2);
      challan.latePaymentFlag = late;
      challan.verifiedBy = actorUserId || 'SYSTEM';
      challan.verificationDate = now;
      await manager.save(challan);

      await manager.query(
        `UPDATE admission_offers
         SET status='ACCEPTED', fee_verified_at=$3, updated_at=now()
         WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED'`,
        [tenantId, challan.offerId, now],
      );
    });

    return { challanId, paymentStatus: status, alreadyVerified: false };
  }

  /**
   * Cron / internal entry: expire unpaid published offers across one or all tenants.
   */
  async expireUnpaidForScheduler(options?: {
    tenantId?: string;
    promoteWaitlist?: boolean;
  }) {
    const tenants: string[] = options?.tenantId
      ? [options.tenantId]
      : (
          await this.db.query(
            `SELECT DISTINCT tenant_id FROM admission_offers WHERE status='PUBLISHED'`,
          )
        ).map((r: { tenant_id: string }) => r.tenant_id);

    const summary = [];
    for (const tenantId of tenants) {
      const ctx = {
        tenantId,
        userId: '00000000-0000-4000-8000-0000000000aa',
        roles: ['ADMISSIONS_ADMIN'],
      } as RequestContext;
      const result = await this.expireUnpaidAndPromote(ctx, {
        promoteWaitlist: options?.promoteWaitlist !== false,
      });
      summary.push({ tenantId, ...result });
    }
    return summary;
  }
  async expireUnpaidAndPromote(ctx: RequestContext, dto: ExpireUnpaidOffersDto = {}) {
    this.admin(ctx);
    const promote = dto.promoteWaitlist !== false;
    const now = new Date();

    const dueOffers: Array<{
      id: string;
      application_record_id: string;
      programme_offering_id: string;
      acceptance_deadline: Date;
      intake_id: string;
      offer_fee_grace_hours: number;
      challan_id: string | null;
      payment_status: string | null;
    }> = await this.db.query(
      `SELECT o.id, o.application_record_id, o.programme_offering_id, o.acceptance_deadline,
              a.intake_id, i.offer_fee_grace_hours, c.id AS challan_id, c.payment_status
       FROM admission_offers o
       JOIN applications a ON a.id = o.application_record_id
       JOIN intakes i ON i.id = a.intake_id
       LEFT JOIN admission_offer_fee_challans c ON c.offer_id = o.id
       WHERE o.tenant_id = $1
         AND o.status = 'PUBLISHED'
         AND ($2::uuid IS NULL OR a.intake_id = $2)
         AND COALESCE(c.payment_status, 'UNPAID') NOT IN ('VERIFIED','LATE_PAYMENT_VERIFIED')
         AND (o.acceptance_deadline + make_interval(hours => COALESCE(i.offer_fee_grace_hours,0))) < $3`,
      [ctx.tenantId, dto.intakeSessionId ?? null, now],
    );

    const runs = [];
    for (const offer of dueOffers) {
      const run = await this.db.transaction(async (manager) => {
        const locked = (
          await manager.query(
            `SELECT * FROM admission_offers WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' FOR UPDATE`,
            [ctx.tenantId, offer.id],
          )
        )[0];
        if (!locked) return null;

        await manager.query(
          `UPDATE admission_offers
           SET status='EXPIRED', expired_reason=$3, updated_at=now()
           WHERE tenant_id=$1 AND id=$2`,
          [ctx.tenantId, offer.id, OfferExpiredReason.FEE_UNPAID],
        );
        if (offer.challan_id) {
          await manager.query(
            `UPDATE admission_offer_fee_challans
             SET payment_status='EXPIRED', updated_at=now()
             WHERE id=$1 AND payment_status NOT IN ('VERIFIED','LATE_PAYMENT_VERIFIED')`,
            [offer.challan_id],
          );
        }
        await manager.query(
          `UPDATE applications
           SET selection_status='REJECTED',
               selected_programme_offering_id=NULL,
               selection_at=now(),
               selection_by=$3,
               selection_reason=$4
           WHERE tenant_id=$1 AND id=$2 AND selection_status='SELECTED'`,
          [
            ctx.tenantId,
            offer.application_record_id,
            ctx.userId,
            'Offer fee unpaid after acceptance deadline',
          ],
        );

        let promotedApplicationId: string | null = null;
        let newOfferId: string | null = null;
        let promotedCount = 0;

        if (promote) {
          const next = (
            await manager.query(
              `SELECT ai.application_record_id, a.application_reference, ai.merit_list_item_id
               FROM application_selection_allocation_items ai
               JOIN application_selection_allocations al ON al.id = ai.allocation_id
               JOIN applications a ON a.id = ai.application_record_id
               LEFT JOIN programme_merit_list_items mi ON mi.id = ai.merit_list_item_id
               WHERE ai.tenant_id = $1
                 AND al.status = 'CONFIRMED'
                 AND ai.selection_status = 'WAITING'
                 AND a.selection_status = 'WAITING'
                 AND a.intake_id = $2
                 AND EXISTS (
                   SELECT 1 FROM application_programme_options apo
                   WHERE apo.applicant_id = a.id
                     AND apo.programme_offering_id = $3
                 )
               ORDER BY COALESCE(mi.merit_rank, 999999) ASC, a.application_reference ASC
               LIMIT 1
               FOR UPDATE OF a`,
              [ctx.tenantId, offer.intake_id, offer.programme_offering_id],
            )
          )[0] as
            | {
                application_record_id: string;
                application_reference: string;
                merit_list_item_id: string | null;
              }
            | undefined;

          if (next) {
            const intake = (
              await manager.query(
                `SELECT offer_payment_period_days FROM intakes WHERE id=$1`,
                [offer.intake_id],
              )
            )[0];
            const deadline = new Date(
              Date.now() + Number(intake?.offer_payment_period_days ?? 5) * 86400000,
            );

            await manager.query(
              `UPDATE applications
               SET selection_status='SELECTED',
                   selected_programme_offering_id=$3,
                   selection_at=now(),
                   selection_by=$4,
                   selection_reason=$5
               WHERE tenant_id=$1 AND id=$2`,
              [
                ctx.tenantId,
                next.application_record_id,
                offer.programme_offering_id,
                ctx.userId,
                'Promoted from waitlist after unpaid offer expiry',
              ],
            );
            if (next.merit_list_item_id) {
              await manager.query(
                `UPDATE programme_merit_list_items
                 SET selection_status='SELECTED', final_selection=TRUE
                 WHERE id=$1`,
                [next.merit_list_item_id],
              );
            }
            await manager.query(
              `UPDATE application_selection_allocation_items
               SET selection_status='SELECTED',
                   selected_programme_offering_id=$3,
                   reason='Promoted from waitlist after unpaid offer expiry'
               WHERE tenant_id=$1
                 AND application_record_id=$2
                 AND selection_status='WAITING'
                 AND allocation_id IN (
                   SELECT id FROM application_selection_allocations
                   WHERE tenant_id=$1 AND status='CONFIRMED'
                 )`,
              [ctx.tenantId, next.application_record_id, offer.programme_offering_id],
            );

            const newOffer = (
              await manager.query(
                `INSERT INTO admission_offers(
                   tenant_id, application_record_id, programme_offering_id,
                   offer_type, offer_conditions, acceptance_deadline,
                   fee_payment_instructions, offer_letter_document,
                   authorized_by, authorized_at, published_at, offer_issue_date, status
                 ) VALUES ($1,$2,$3,'UNCONDITIONAL',NULL,$4,NULL,NULL,$5,now(),now(),now(),'PUBLISHED')
                 RETURNING *`,
                [
                  ctx.tenantId,
                  next.application_record_id,
                  offer.programme_offering_id,
                  deadline,
                  ctx.userId,
                ],
              )
            )[0];
            newOfferId = newOffer.id;
            promotedApplicationId = next.application_record_id;
            promotedCount = 1;

            // Generate challan outside nested complexity via same manager data
            await this.generateForOfferInManager(manager, ctx.tenantId, newOffer);
          }
        }

        const release = manager.create(SelectionSeatReleaseRunEntity, {
          tenantId: ctx.tenantId,
          intakeSessionId: offer.intake_id,
          programmeOfferingId: offer.programme_offering_id,
          triggerType: SeatReleaseTrigger.FEE_UNPAID,
          seatsFreed: 1,
          promotedCount,
          expiredOfferId: offer.id,
          promotedApplicationId,
          newOfferId,
          details: {
            expiredApplicationId: offer.application_record_id,
            challanId: offer.challan_id,
          },
          createdBy: ctx.userId,
        });
        return manager.save(release);
      });

      if (run) runs.push(this.seatRunResponse(run));
    }

    return {
      expiredCount: runs.length,
      promotedCount: runs.reduce((s, r) => s + r.promotedCount, 0),
      runs,
    };
  }

  private async generateForOfferInManager(
    manager: EntityManager,
    tenantId: string,
    offer: {
      id: string;
      application_record_id: string;
      programme_offering_id: string;
      acceptance_deadline: Date | string;
    },
  ) {
    const existing = await manager.findOne(AdmissionOfferFeeChallanEntity, {
      where: { tenantId, offerId: offer.id },
    });
    if (existing) return existing;

    try {
      // Reuse public path with a short-lived approach: call generateForOffer
      // outside transaction is unsafe; inline minimal create.
      const app = await manager.findOne(ApplicationEntity, {
        where: { id: offer.application_record_id, tenantId },
      });
      if (!app) return null;
      const intake = await manager.findOne(IntakeEntity, {
        where: { id: app.intakeId, tenantId },
      });
      if (!intake) return null;
      const offering = await manager.findOne(ProgrammeOfferingEntity, {
        where: { id: offer.programme_offering_id, tenantId },
        relations: { programme: true },
      });
      if (!offering) return null;
      const now = new Date();
      const feeRows = await manager.find(OfferingFeeEntity, {
        where: {
          tenantId,
          programmeOfferingId: offering.id,
          status: 'ACTIVE',
        },
        relations: { generalFee: true },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
      const unique = [
        ...new Map(
          feeRows
            .filter(
              (f) =>
                f.generalFee?.status === 'ACTIVE' &&
                isOfferFeeType(f.generalFee.feeType) &&
                (!f.effectiveFrom || f.effectiveFrom <= now) &&
                (!f.effectiveTo || f.effectiveTo >= now),
            )
            .map((f) => [f.generalFeeId, f]),
        ).values(),
      ];
      if (!unique.length) return null;
      const bank = await this.resolveBank(tenantId, now);
      const total = unique.reduce((s, f) => s + Number(f.generalFee.amount), 0);
      if (!Number.isFinite(total) || total <= 0) return null;
      const dueDate = new Date(offer.acceptance_deadline);
      const challanNumber = `OF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
      const currency = unique[0].generalFee.currency;
      const challan = await manager.save(
        manager.create(AdmissionOfferFeeChallanEntity, {
          tenantId,
          offerId: offer.id,
          applicantId: app.id,
          programmeOfferingId: offering.id,
          challanNumber,
          issueDate: now,
          dueDate,
          designatedBankId: bank.id,
          collectionBankName: bank.bankName,
          collectionBankBranch: bank.branchName,
          collectionBankAccount: bank.accountNumber,
          branchCode: bank.branchCode,
          institutionCode: null,
          applicantName: app.applicantName,
          applicantContactNumber: app.mobileNumber,
          registrationNumber: app.applicationReference,
          intakeSession: intake.intakeName,
          programmeName: offering.programme?.name ?? offering.id,
          totalAmountPayable: total.toFixed(2),
          amountInWords: `${this.amountInWords(total)} ${currency} only`,
          paymentStatus: OfferFeeStatus.UNPAID,
          latePaymentFlag: false,
          paymentDate: null,
          amountPaid: null,
          verifiedBy: null,
          verificationDate: null,
        }),
      );
      await manager.save(
        AdmissionOfferFeeChallanItemEntity,
        unique.map((f) =>
          manager.create(AdmissionOfferFeeChallanItemEntity, {
            tenantId,
            challanId: challan.id,
            feeTypeCode: f.generalFee.feeType,
            description: f.generalFee.feeType.replaceAll('_', ' '),
            quantity: '1.00',
            unitAmount: f.generalFee.amount,
            amount: f.generalFee.amount,
            currency: f.generalFee.currency,
            dueDate,
            sourceReference: f.generalFeeId,
            offeringFeeId: f.id,
          }),
        ),
      );
      await manager.query(
        `UPDATE admission_offers SET fee_challan_id=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`,
        [tenantId, offer.id, challan.id],
      );
      return challan;
    } catch {
      return null;
    }
  }

  private async resolveBank(tenantId: string, now: Date) {
    const effectiveBanks = await this.banks.find({
      where: [
        {
          tenantId,
          isActive: true,
          status: 'ACTIVE',
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: IsNull(),
        },
        {
          tenantId,
          isActive: true,
          status: 'ACTIVE',
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: MoreThanOrEqual(now),
        },
      ],
      order: { effectiveFrom: 'DESC' },
    });
    const bank = effectiveBanks[0];
    if (!bank) {
      throw new BusinessException(
        'No effective designated bank is configured',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DESIGNATED_BANK_UNAVAILABLE',
      );
    }
    return bank;
  }

  private async requireApplicant(user: AuthUser, applicantId: string) {
    const app = await this.applications.findOne({
      where: { id: applicantId, tenantId: user.tenantId },
    });
    if (!app) throw new NotFoundException('Application not found');
    const roles = new Set((user.roles ?? []).map((r) => String(r).toUpperCase()));
    const isStaff = [
      'ADMISSIONS_ADMIN',
      'ADMISSIONS_OFFICER',
      'TENANT_ADMIN',
      'SUPER_ADMIN',
      'ADMIN',
    ].some((r) => roles.has(r));
    if (!isStaff && app.iamUserId !== user.userId) {
      throw new BusinessException(
        'Not allowed to access this application',
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
      );
    }
    return app;
  }

  private async newChallanNumber(now: Date) {
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 8; i++) {
      const n = `OF-${stamp}-${Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')}`;
      const exists = await this.challans.exists({ where: { challanNumber: n } });
      if (!exists) return n;
    }
    throw new BusinessException(
      'Could not allocate offer fee challan number',
      HttpStatus.INTERNAL_SERVER_ERROR,
      'CHALLAN_NUMBER_FAILED',
    );
  }

  private async challanResponse(
    challan: AdmissionOfferFeeChallanEntity,
    withItems: boolean,
  ) {
    const items = withItems
      ? await this.items.find({
          where: { challanId: challan.id },
          order: { createdAt: 'ASC' },
        })
      : [];
    return {
      id: challan.id,
      offerId: challan.offerId,
      applicantId: challan.applicantId,
      programmeOfferingId: challan.programmeOfferingId,
      challanNumber: challan.challanNumber,
      issueDate: challan.issueDate.toISOString(),
      dueDate: challan.dueDate.toISOString(),
      collectionBankName: challan.collectionBankName,
      collectionBankBranch: challan.collectionBankBranch,
      collectionBankAccount: challan.collectionBankAccount,
      branchCode: challan.branchCode,
      institutionCode: challan.institutionCode,
      applicantName: challan.applicantName,
      applicantContactNumber: challan.applicantContactNumber,
      registrationNumber: challan.registrationNumber,
      intakeSession: challan.intakeSession,
      programmeName: challan.programmeName,
      totalAmountPayable: challan.totalAmountPayable,
      amountInWords: challan.amountInWords,
      paymentStatus: challan.paymentStatus,
      paymentDate: challan.paymentDate?.toISOString() ?? null,
      amountPaid: challan.amountPaid,
      latePaymentFlag: challan.latePaymentFlag,
      items: items.map((i) => ({
        id: i.id,
        feeTypeCode: i.feeTypeCode,
        description: i.description,
        quantity: i.quantity,
        unitAmount: i.unitAmount,
        amount: i.amount,
        currency: i.currency,
      })),
    };
  }

  private seatRunResponse(run: SelectionSeatReleaseRunEntity) {
    return {
      id: run.id,
      programmeOfferingId: run.programmeOfferingId,
      triggerType: run.triggerType,
      seatsFreed: run.seatsFreed,
      promotedCount: run.promotedCount,
      expiredOfferId: run.expiredOfferId,
      promotedApplicationId: run.promotedApplicationId,
      newOfferId: run.newOfferId,
    };
  }

  private amountInWords(value: number): string {
    const small = [
      'zero',
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      'eleven',
      'twelve',
      'thirteen',
      'fourteen',
      'fifteen',
      'sixteen',
      'seventeen',
      'eighteen',
      'nineteen',
    ];
    const tens = [
      '',
      '',
      'twenty',
      'thirty',
      'forty',
      'fifty',
      'sixty',
      'seventy',
      'eighty',
      'ninety',
    ];
    const under = (n: number): string =>
      n < 20
        ? small[n]
        : n < 100
          ? `${tens[Math.floor(n / 10)]}${n % 10 ? `-${small[n % 10]}` : ''}`
          : `${small[Math.floor(n / 100)]} hundred${n % 100 ? ` ${under(n % 100)}` : ''}`;
    const [wholeText] = value.toFixed(2).split('.');
    const n = Number(wholeText);
    if (n < 1000) return under(n);
    if (n < 100000) {
      return `${under(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${under(n % 1000)}` : ''}`;
    }
    if (n < 10000000) {
      return `${under(Math.floor(n / 100000))} lakh${n % 100000 ? ` ${this.amountInWords(n % 100000)}` : ''}`;
    }
    return `${under(Math.floor(n / 10000000))} crore${n % 10000000 ? ` ${this.amountInWords(n % 10000000)}` : ''}`;
  }
}
