import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'node:crypto';
import { extname } from 'node:path';
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { validate as isUuid } from 'uuid';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import {
  BankImportStatus,
  OnlinePaymentStatus,
  PaymentEvidenceSource,
  PaymentEvidenceVerificationIndicator,
  ProcessingFeeStatus,
  ReconciliationMatchStatus,
  ReconciliationResolutionStatus,
} from '../../common/enums/processing-fee.enum.js';
import { PROCESSING_FEE_TYPE_CODES } from '../../common/enums/offer-fee.enum.js';
import {
  ApplicationEntity,
  ApplicationProgrammeOptionEntity,
  BankReconciliationImportEntity,
  BankReconciliationRecordEntity,
  DesignatedBankEntity,
  GeneralFeeEntity,
  IntakeEntity,
  OnlinePaymentTransactionEntity,
  OfferingFeeEntity,
  PaymentEvidenceEntity,
  ProcessingFeeChallanEntity,
  ProcessingFeeChallanItemEntity,
  ProgrammeOfferingEntity,
  AdmissionOfferFeeChallanEntity,
} from '../../database/entities/index.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../integrations/storage/object-storage.interface.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { OfferFeesService } from '../offer-fees/offer-fees.service.js';
import {
  ConfirmOnlinePaymentDto,
  CreateDesignatedBankDto,
  CreateOnlinePaymentDto,
  ResolveReconciliationExceptionDto,
  VerifyPaymentEvidenceDto,
} from './dto/processing-fee.dto.js';

export interface PaymentUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const EVIDENCE_MIME = new Map([
  ['image/jpeg', 'JPG'],
  ['image/png', 'PNG'],
  ['image/gif', 'GIF'],
  ['image/bmp', 'BMP'],
  ['application/pdf', 'PDF'],
]);
const APPLICANT_ONLY_ROLES = new Set(['ADMISSIONS_APPLICANT', 'APPLICANT']);
const PAID_STATUSES = new Set([
  ProcessingFeeStatus.VERIFIED,
  ProcessingFeeStatus.LATE_PAYMENT_VERIFIED,
]);

@Injectable()
export class ProcessingFeeService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applications: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationProgrammeOptionEntity)
    private readonly options: Repository<ApplicationProgrammeOptionEntity>,
    @InjectRepository(ProgrammeOfferingEntity)
    private readonly offerings: Repository<ProgrammeOfferingEntity>,
    @InjectRepository(IntakeEntity)
    private readonly intakes: Repository<IntakeEntity>,
    @InjectRepository(OfferingFeeEntity)
    private readonly offeringFees: Repository<OfferingFeeEntity>,
    @InjectRepository(GeneralFeeEntity)
    private readonly generalFees: Repository<GeneralFeeEntity>,
    @InjectRepository(ProcessingFeeChallanEntity)
    private readonly challans: Repository<ProcessingFeeChallanEntity>,
    @InjectRepository(ProcessingFeeChallanItemEntity)
    private readonly items: Repository<ProcessingFeeChallanItemEntity>,
    @InjectRepository(DesignatedBankEntity)
    private readonly banks: Repository<DesignatedBankEntity>,
    @InjectRepository(PaymentEvidenceEntity)
    private readonly evidence: Repository<PaymentEvidenceEntity>,
    @InjectRepository(OnlinePaymentTransactionEntity)
    private readonly onlinePayments: Repository<OnlinePaymentTransactionEntity>,
    @InjectRepository(BankReconciliationImportEntity)
    private readonly imports: Repository<BankReconciliationImportEntity>,
    @InjectRepository(BankReconciliationRecordEntity)
    private readonly bankRecords: Repository<BankReconciliationRecordEntity>,
    @InjectRepository(AdmissionOfferFeeChallanEntity)
    private readonly offerChallans: Repository<AdmissionOfferFeeChallanEntity>,
    private readonly offerFees: OfferFeesService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async generateChallan(user: AuthUser, applicantId: string) {
    const app = await this.requireApplicant(user, applicantId);
    if (!['COMPLETE', 'SUBMITTED'].includes(app.applicationStatus)) {
      throw new BusinessException(
        'Processing fee challan is available only after application submission',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'APPLICATION_NOT_SUBMITTED',
      );
    }
    const previous = await this.challans.findOne({
      where: { tenantId: user.tenantId, applicantId },
    });
    if (previous) return this.challanResponse(previous);

    const now = new Date();
    const choices = await this.options.find({
      where: { tenantId: user.tenantId, applicantId },
      order: { preferenceOrder: 'ASC' },
    });
    if (!choices.length)
      throw new BusinessException(
        'Programme selection is required before generating a challan',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PROGRAMME_SELECTION_REQUIRED',
      );
    const chosenIds = choices.map((x) => x.programmeOfferingId);
    const offerings = await this.offerings.find({
      where: { tenantId: user.tenantId, id: In(chosenIds) },
      relations: { programme: true },
    });
    const names = new Map(offerings.map((o) => [o.id, o.programme.name]));
    const feeRows = await this.offeringFees.find({
      where: {
        tenantId: user.tenantId,
        programmeOfferingId: In(chosenIds),
        status: 'ACTIVE',
      },
      relations: { generalFee: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const effectiveFees = feeRows.filter(
      (f) =>
        f.generalFee.status === 'ACTIVE' &&
        PROCESSING_FEE_TYPE_CODES.has(String(f.generalFee.feeType || '').toUpperCase()) &&
        (!f.effectiveFrom || f.effectiveFrom <= now) &&
        (!f.effectiveTo || f.effectiveTo >= now),
    );
    const uniqueFees = [
      ...new Map(effectiveFees.map((f) => [f.generalFeeId, f])).values(),
    ];
    if (!uniqueFees.length)
      throw new BusinessException(
        'No active processing fee is configured for the selected programmes',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PROCESSING_FEE_NOT_CONFIGURED',
      );

    const effectiveBanks = await this.banks.find({
      where: [
        {
          tenantId: user.tenantId,
          isActive: true,
          status: 'ACTIVE',
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: IsNull(),
        },
        {
          tenantId: user.tenantId,
          isActive: true,
          status: 'ACTIVE',
          effectiveFrom: LessThanOrEqual(now),
          effectiveTo: MoreThanOrEqual(now),
        },
      ],
      order: { effectiveFrom: 'DESC' },
    });
    const bank = effectiveBanks[0];
    if (!bank)
      throw new BusinessException(
        'No effective designated bank is configured',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DESIGNATED_BANK_UNAVAILABLE',
      );
    const intake = await this.intakes.findOne({
      where: { id: app.intakeId, tenantId: app.tenantId },
    });
    if (!intake) throw new NotFoundException('Application intake not found');

    const challanNumber = await this.newChallanNumber(now);
    const lineInputs = uniqueFees.map((f) => ({
      feeTypeCode: f.generalFee.feeType,
      description: f.generalFee.feeType.replaceAll('_', ' '),
      quantity: '1.00',
      unitAmount: f.generalFee.amount,
      amount: f.generalFee.amount,
      currency: f.generalFee.currency,
      sourceReference: f.generalFeeId,
    }));
    if (new Set(lineInputs.map((item) => item.currency)).size !== 1)
      throw new BusinessException(
        'All processing fee items on a challan must use the same currency',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PROCESSING_FEE_CURRENCY_MISMATCH',
      );
    const total = lineInputs.reduce((sum, x) => sum + Number(x.amount), 0);
    if (!Number.isFinite(total) || total <= 0)
      throw new BusinessException(
        'Configured processing fee must be greater than zero',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_PROCESSING_FEE',
      );

    const challan = await this.challans.manager.transaction(async (manager) => {
      await manager.getRepository(ApplicationEntity).findOne({
        where: { id: applicantId, tenantId: app.tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      const concurrentChallan = await manager
        .getRepository(ProcessingFeeChallanEntity)
        .findOne({ where: { tenantId: app.tenantId, applicantId } });
      if (concurrentChallan) return concurrentChallan;
      const row = manager.create(ProcessingFeeChallanEntity, {
        tenantId: app.tenantId,
        applicantId,
        challanNumber,
        issueDate: now,
        dueDate: intake.applicationCloseAt,
        designatedBankId: bank.id,
        collectionBankName: bank.bankName,
        collectionBankBranch: bank.branchName,
        collectionBankAccount: bank.accountNumber,
        branchCode: bank.branchCode,
        applicantName: app.applicantName,
        applicantContactNumber: app.mobileNumber,
        registrationNumber: app.applicationReference,
        intakeSession: intake.intakeName,
        programmesAppliedFor: choices
          .map(
            (c) =>
              `${c.preferenceOrder}. ${names.get(c.programmeOfferingId) ?? c.programmeOfferingId}`,
          )
          .join('; '),
        totalAmountPayable: total.toFixed(2),
        amountInWords: `${this.amountInWords(total)} ${lineInputs[0].currency} only`,
        paymentStatus: ProcessingFeeStatus.UNPAID,
        latePaymentFlag: false,
        paymentDate: null,
        amountPaid: null,
        verifiedBy: null,
        verificationDate: null,
      });
      const saved = await manager.save(row);
      await manager.save(
        ProcessingFeeChallanItemEntity,
        lineInputs.map((x) =>
          manager.create(ProcessingFeeChallanItemEntity, {
            ...x,
            tenantId: app.tenantId,
            challanId: saved.id,
            dueDate: intake.applicationCloseAt,
          }),
        ),
      );
      return saved;
    });
    return this.challanResponse(challan);
  }

  async getChallan(user: AuthUser, applicantId: string) {
    await this.requireApplicant(user, applicantId);
    const challan = await this.challans.findOne({
      where: { tenantId: user.tenantId, applicantId },
    });
    if (!challan)
      throw new NotFoundException('Processing fee challan not found');
    return this.challanResponse(challan);
  }

  async challanPrint(user: AuthUser, applicantId: string) {
    const challan = await this.getChallan(user, applicantId);
    return { challan, copies: ['APPLICANT', 'INSTITUTION', 'BANK'] };
  }

  async listEvidence(user: AuthUser, applicantId: string) {
    await this.requireApplicant(user, applicantId);
    const rows = await this.evidence.find({
      where: { tenantId: user.tenantId, applicantId },
      order: { uploadDate: 'DESC' },
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        downloadUrl: await this.storage.resolveDownloadUrl(row.storageKey),
      })),
    );
  }

  async uploadEvidence(
    user: AuthUser,
    applicantId: string,
    file?: PaymentUpload,
    onlinePaymentTransactionId?: string,
  ) {
    const app = await this.requireApplicant(user, applicantId);
    if (!file?.buffer?.length)
      throw new BusinessException(
        'Payment evidence file is required',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
      );
    const format = EVIDENCE_MIME.get(file.mimetype);
    if (
      !format ||
      !this.hasValidEvidenceSignature(file.buffer, format) ||
      !this.extensionMatches(file.originalname, format)
    )
      throw new BusinessException(
        'Accepted formats are JPG, JPEG, PNG, GIF, BMP and PDF; file extension and content must match',
        HttpStatus.BAD_REQUEST,
        'UNSUPPORTED_EVIDENCE_FORMAT',
      );
    const challan = await this.challans.findOne({
      where: { tenantId: user.tenantId, applicantId },
    });
    if (!challan)
      throw new NotFoundException(
        'Generate the processing fee challan before uploading evidence',
      );
    if (PAID_STATUSES.has(challan.paymentStatus))
      throw new BusinessException(
        'Verified payment evidence cannot be replaced',
        HttpStatus.CONFLICT,
        'PAYMENT_ALREADY_VERIFIED',
      );
    const current = await this.evidence.findOne({
      where: {
        tenantId: user.tenantId,
        challanId: challan.id,
        isCurrent: true,
      },
    });
    const onlinePayment = onlinePaymentTransactionId
      ? isUuid(onlinePaymentTransactionId)
        ? await this.onlinePayments.findOne({
            where: {
              id: onlinePaymentTransactionId,
              tenantId: user.tenantId,
              applicantId,
            },
          })
        : null
      : null;
    if (onlinePaymentTransactionId && !isUuid(onlinePaymentTransactionId))
      throw new BusinessException(
        'onlinePaymentTransactionId must be a valid UUID',
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
      );
    if (onlinePaymentTransactionId && !onlinePayment)
      throw new NotFoundException(
        'Applicant online payment transaction not found',
      );
    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      folder: `admissions/payment-evidence/${applicantId}/${challan.id}`,
      fileName: file.originalname,
    });
    const saved = await this.evidence.manager.transaction(async (manager) => {
      if (current) {
        current.isCurrent = false;
        current.replacedBy = '00000000-0000-0000-0000-000000000000';
        await manager.save(current);
      }
      const row = manager.create(PaymentEvidenceEntity, {
        tenantId: user.tenantId,
        applicantId,
        challanId: challan.id,
        onlinePaymentTransactionId: onlinePayment?.id ?? null,
        storageKey: stored.storageKey,
        fileFormat: format,
        evidenceSource: onlinePayment
          ? PaymentEvidenceSource.ONLINE_RECEIPT
          : PaymentEvidenceSource.BANK_RECEIPT,
        verificationIndicator: PaymentEvidenceVerificationIndicator.UNVERIFIED,
        verifiedBy: null,
        verificationDate: null,
        replacedBy: null,
        isCurrent: true,
      });
      const newRow = await manager.save(row);
      if (current)
        await manager.update(PaymentEvidenceEntity, current.id, {
          replacedBy: newRow.id,
        });
      await manager.update(ProcessingFeeChallanEntity, challan.id, {
        paymentStatus: ProcessingFeeStatus.EVIDENCE_SUBMITTED,
      });
      await manager.update(ApplicationEntity, applicantId, {
        processingFeeStatus: ProcessingFeeStatus.EVIDENCE_SUBMITTED,
      });
      return newRow;
    });
    const reconciled = await this.bankRecords.findOne({
      where: {
        tenantId: user.tenantId,
        matchedChallanId: challan.id,
        matchStatus: In([
          ReconciliationMatchStatus.MATCHED,
          ReconciliationMatchStatus.LATE_PAYMENT,
        ]),
        registrationMatch: true,
        amountMatch: true,
      },
      order: { id: 'DESC' },
    });
    if (reconciled) {
      const paidAt = new Date(reconciled.datePaid);
      await this.verifyChallanFromBank(
        user,
        challan,
        Number(reconciled.amount),
        paidAt,
        paidAt > challan.dueDate,
      );
    }
    return { ...saved, downloadUrl: stored.downloadUrl };
  }

  async paymentStatus(user: AuthUser, applicantId: string) {
    const app = await this.requireApplicant(user, applicantId);
    const challan = await this.challans.findOne({
      where: { tenantId: user.tenantId, applicantId },
    });
    return {
      applicantId,
      applicationStatus: app.applicationStatus,
      paymentStatus: app.processingFeeStatus,
      challan: challan ? await this.challanResponse(challan) : null,
    };
  }

  async createOnlinePayment(
    user: AuthUser,
    applicantId: string,
    dto: CreateOnlinePaymentDto,
  ) {
    await this.requireApplicant(user, applicantId);
    const challan = await this.challans.findOne({
      where: { tenantId: user.tenantId, applicantId },
    });
    if (!challan)
      throw new NotFoundException('Processing fee challan not found');
    if (PAID_STATUSES.has(challan.paymentStatus))
      throw new BusinessException(
        'Processing fee is already verified',
        HttpStatus.CONFLICT,
        'PAYMENT_ALREADY_VERIFIED',
      );
    if (Number(dto.amount) !== Number(challan.totalAmountPayable))
      throw new BusinessException(
        'Online payment amount must equal the challan amount',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYMENT_AMOUNT_MISMATCH',
      );
    const challanItems = await this.items.find({
      where: { tenantId: user.tenantId, challanId: challan.id },
    });
    const challanCurrency = challanItems[0]?.currency;
    if (
      !challanCurrency ||
      dto.currency.toUpperCase() !== challanCurrency.toUpperCase()
    )
      throw new BusinessException(
        'Online payment currency must match the challan currency',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYMENT_CURRENCY_MISMATCH',
      );
    const duplicate = await this.onlinePayments.findOne({
      where: {
        tenantId: user.tenantId,
        transactionReference: dto.transactionReference,
      },
    });
    if (duplicate)
      throw new BusinessException(
        'Transaction reference already exists',
        HttpStatus.CONFLICT,
        'DUPLICATE_TRANSACTION_REFERENCE',
      );
    const payment = await this.onlinePayments.save(
      this.onlinePayments.create({
        tenantId: user.tenantId,
        challanId: challan.id,
        applicantId,
        paymentMethod: dto.paymentMethod,
        transactionReference: dto.transactionReference,
        currency: dto.currency.toUpperCase(),
        amount: Number(dto.amount).toFixed(2),
        senderName: dto.senderName,
        status: OnlinePaymentStatus.INITIATED,
        providerCode: dto.providerCode ?? null,
        notes: dto.notes ?? null,
        paidAt: null,
        confirmedAt: null,
      }),
    );
    return { ...payment, receiptRequired: true, receiptUploaded: false };
  }

  async applicantOnlinePayments(user: AuthUser, applicantId: string) {
    await this.requireApplicant(user, applicantId);
    const row = await this.onlinePayments.findOne({
      where: { tenantId: user.tenantId, applicantId },
      order: { createdAt: 'DESC' },
    });
    if (!row)
      throw new NotFoundException('Online payment has not been initiated');
    const evidence = await this.evidence.findOne({
      where: {
        tenantId: user.tenantId,
        onlinePaymentTransactionId: row.id,
        isCurrent: true,
      },
    });
    return {
      ...row,
      receiptRequired: true,
      receiptUploaded: Boolean(evidence),
    };
  }

  async listBanks(user: AuthUser) {
    this.assertStaff(user);
    const now = new Date();
    const rows = await this.banks
      .find({
        where: { tenantId: user.tenantId, isActive: true, status: 'ACTIVE' },
        order: { effectiveFrom: 'DESC' },
      })
    return Promise.all(rows
      .filter(
        (x) =>
          x.effectiveFrom <= now && (!x.effectiveTo || x.effectiveTo >= now),
      )
      .map((row) => this.bankResponse(row)));
  }

  async createBank(user: AuthUser, dto: CreateDesignatedBankDto) {
    this.assertStaff(user);
    const start = new Date(dto.effectiveFrom);
    const end = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (end && end <= start)
      throw new BusinessException(
        'effectiveTo must be later than effectiveFrom',
        HttpStatus.BAD_REQUEST,
        'INVALID_EFFECTIVE_RANGE',
      );
    const bank = await this.banks.save(
      this.banks.create({
        tenantId: user.tenantId,
        bankName: dto.bankName,
        branchName: dto.branchName,
        branchCode: dto.branchCode,
        accountTitle: dto.accountTitle,
        accountNumber: dto.accountNumber,
        effectiveFrom: start,
        effectiveTo: end,
        isActive: true,
        status: 'ACTIVE',
        createdBy: user.userId,
      }),
    );
    return this.bankResponse(bank);
  }

  async uploadBankLogo(user: AuthUser, id: string, file?: PaymentUpload) {
    this.assertStaff(user);
    const bank = await this.requireBank(user.tenantId, id);
    this.assertBankLogo(file);
    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      folder: `admissions/bank-logos/${user.tenantId}/${bank.id}`,
      fileName: file.originalname,
    });
    const oldLogo = bank.logoStorageKey;
    bank.logoStorageKey = stored.storageKey;
    const saved = await this.banks.save(bank);
    if (oldLogo && oldLogo !== stored.storageKey) {
      try {
        await this.storage.delete(oldLogo);
      } catch {
        // Keep the newly saved logo if cleanup of the replaced object fails.
      }
    }
    return this.bankResponse(saved);
  }

  async updateBank(user: AuthUser, id: string, dto: CreateDesignatedBankDto) {
    this.assertStaff(user);
    const bank = await this.requireBank(user.tenantId, id);
    const from = new Date(dto.effectiveFrom);
    const to = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (to && to <= from)
      throw new BusinessException(
        'effectiveTo must be later than effectiveFrom',
        HttpStatus.BAD_REQUEST,
        'INVALID_EFFECTIVE_RANGE',
      );
    Object.assign(bank, {
      bankName: dto.bankName,
      branchName: dto.branchName,
      branchCode: dto.branchCode,
      accountTitle: dto.accountTitle,
      accountNumber: dto.accountNumber,
      effectiveFrom: from,
      effectiveTo: to,
    });
    return this.bankResponse(await this.banks.save(bank));
  }

  async setBankActive(user: AuthUser, id: string, active: boolean) {
    this.assertStaff(user);
    const bank = await this.requireBank(user.tenantId, id);
    bank.isActive = active;
    bank.status = active ? 'ACTIVE' : 'INACTIVE';
    return this.bankResponse(await this.banks.save(bank));
  }

  async pendingEvidence(user: AuthUser) {
    this.assertStaff(user);
    const rows = await this.evidence.find({
      where: {
        tenantId: user.tenantId,
        isCurrent: true,
        verificationIndicator: PaymentEvidenceVerificationIndicator.UNVERIFIED,
      },
      order: { uploadDate: 'ASC' },
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        downloadUrl: await this.storage.resolveDownloadUrl(row.storageKey),
      })),
    );
  }

  async verifyEvidence(
    user: AuthUser,
    id: string,
    dto: VerifyPaymentEvidenceDto,
  ) {
    this.assertStaff(user);
    const evidence = await this.requireEvidence(user.tenantId, id);
    if (
      !evidence.isCurrent ||
      evidence.verificationIndicator !==
        PaymentEvidenceVerificationIndicator.UNVERIFIED
    )
      throw new BusinessException(
        'Only current unverified evidence can be verified',
        HttpStatus.CONFLICT,
        'EVIDENCE_NOT_VERIFIABLE',
      );
    const challan = await this.requireChallan(
      user.tenantId,
      evidence.challanId,
    );
    const amount = Number(dto.amountPaid ?? challan.totalAmountPayable);
    if (amount !== Number(challan.totalAmountPayable))
      throw new BusinessException(
        'Paid amount must equal the challan amount',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYMENT_AMOUNT_MISMATCH',
      );
    const paidAt = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const late = paidAt > challan.dueDate;
    await this.evidence.manager.transaction(async (manager) => {
      await manager.update(PaymentEvidenceEntity, evidence.id, {
        verificationIndicator: PaymentEvidenceVerificationIndicator.VERIFIED,
        verifiedBy: user.userId,
        verificationDate: new Date(),
      });
      await manager.update(ProcessingFeeChallanEntity, challan.id, {
        paymentStatus: late
          ? ProcessingFeeStatus.LATE_PAYMENT_VERIFIED
          : ProcessingFeeStatus.VERIFIED,
        paymentDate: paidAt,
        amountPaid: amount.toFixed(2),
        latePaymentFlag: late,
        verifiedBy: user.userId,
        verificationDate: new Date(),
      });
      await manager.update(ApplicationEntity, evidence.applicantId, {
        processingFeeStatus: late
          ? ProcessingFeeStatus.LATE_PAYMENT_VERIFIED
          : ProcessingFeeStatus.VERIFIED,
      });
    });
    return {
      evidenceId: evidence.id,
      paymentStatus: late
        ? ProcessingFeeStatus.LATE_PAYMENT_VERIFIED
        : ProcessingFeeStatus.VERIFIED,
      paymentDate: paidAt,
      amountPaid: amount.toFixed(2),
      verificationNote: dto.verificationNote ?? null,
      verificationSource: dto.verificationSource ?? 'MANUAL',
    };
  }

  async rejectEvidence(user: AuthUser, id: string, note?: string) {
    this.assertStaff(user);
    const evidence = await this.requireEvidence(user.tenantId, id);
    if (
      !evidence.isCurrent ||
      evidence.verificationIndicator !==
        PaymentEvidenceVerificationIndicator.UNVERIFIED
    )
      throw new BusinessException(
        'Only current unverified evidence can be rejected',
        HttpStatus.CONFLICT,
        'EVIDENCE_NOT_REJECTABLE',
      );
    await this.evidence.update(evidence.id, {
      verificationIndicator: PaymentEvidenceVerificationIndicator.REJECTED,
      verifiedBy: user.userId,
      verificationDate: new Date(),
    });
    await this.challans.update(evidence.challanId, {
      paymentStatus: ProcessingFeeStatus.UNPAID,
    });
    await this.applications.update(evidence.applicantId, {
      processingFeeStatus: ProcessingFeeStatus.UNPAID,
    });
    return {
      evidenceId: id,
      verificationIndicator: PaymentEvidenceVerificationIndicator.REJECTED,
      reason: note ?? null,
      replacementAllowed: true,
    };
  }

  async confirmOnlinePayment(user: AuthUser, dto: ConfirmOnlinePaymentDto) {
    this.assertProvider(user);
    const payment = await this.onlinePayments.findOne({
      where: {
        transactionReference: dto.transactionReference,
        tenantId: user.tenantId,
      },
    });
    if (!payment) throw new NotFoundException('Online payment not found');
    if (
      payment.status !== OnlinePaymentStatus.INITIATED &&
      payment.status !== OnlinePaymentStatus.PENDING
    ) {
      if (payment.status === dto.status)
        return this.onlinePaymentResponse(payment);
      throw new BusinessException(
        'Payment confirmation conflicts with its current state',
        HttpStatus.CONFLICT,
        'PAYMENT_CONFIRMATION_CONFLICT',
      );
    }
    payment.status = dto.status;
    payment.confirmedAt = new Date();
    if (dto.paidAt) payment.paidAt = new Date(dto.paidAt);
    const saved = await this.onlinePayments.save(payment);
    if (saved.status === OnlinePaymentStatus.SUCCESS) {
      const challan = await this.requireChallan(user.tenantId, saved.challanId);
      const linkedEvidence = await this.evidence.findOne({
        where: {
          tenantId: user.tenantId,
          challanId: challan.id,
          onlinePaymentTransactionId: saved.id,
          isCurrent: true,
          verificationIndicator:
            PaymentEvidenceVerificationIndicator.UNVERIFIED,
        },
      });
      if (
        linkedEvidence &&
        Number(saved.amount) === Number(challan.totalAmountPayable)
      ) {
        const paidAt = saved.paidAt ?? saved.confirmedAt!;
        await this.verifyChallanFromBank(
          user,
          challan,
          Number(saved.amount),
          paidAt,
          paidAt > challan.dueDate,
        );
      }
    }
    return this.onlinePaymentResponse(saved);
  }

  async challanPayments(user: AuthUser, challanId: string) {
    this.assertStaff(user);
    await this.requireChallan(user.tenantId, challanId);
    const rows = await this.onlinePayments.find({
      where: { tenantId: user.tenantId, challanId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        receiptRequired: true,
        receiptUploaded: Boolean(
          await this.evidence.findOne({
            where: {
              tenantId: user.tenantId,
              onlinePaymentTransactionId: row.id,
              isCurrent: true,
            },
          }),
        ),
      })),
    );
  }

  async applicationPayment(user: AuthUser, applicantId: string) {
    this.assertStaff(user);
    const app = await this.applications.findOne({
      where: { id: applicantId, tenantId: user.tenantId },
    });
    if (!app) throw new NotFoundException('Application not found');
    const challan = await this.challans.findOne({
      where: { tenantId: user.tenantId, applicantId },
    });
    const evidence = challan
      ? await this.evidence.find({
          where: { tenantId: user.tenantId, challanId: challan.id },
          order: { uploadDate: 'DESC' },
        })
      : [];
    return {
      applicantId,
      applicationReference: app.applicationReference,
      paymentStatus: app.processingFeeStatus,
      challan: challan ? await this.challanResponse(challan) : null,
      evidence: await Promise.all(
        evidence.map(async (row) => ({
          ...row,
          downloadUrl: await this.storage.resolveDownloadUrl(row.storageKey),
        })),
      ),
    };
  }

  async importBankCsv(user: AuthUser, file?: PaymentUpload) {
    this.assertStaff(user);
    if (!file?.buffer?.length)
      throw new BusinessException(
        'CSV file is required',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
      );
    const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    const rows = this.parseCsv(text);
    if (rows.length < 2)
      throw new BusinessException(
        'CSV must contain a header and at least one data row',
        HttpStatus.BAD_REQUEST,
        'EMPTY_BANK_IMPORT',
      );
    const header = rows[0].map((x) => x.trim());
    const required = [
      'ReceiptNo',
      'ConsumerNo',
      'ClassName',
      'Student Name',
      'Valid Date of Voucher',
      'Due Date',
      'AmountWithinDD',
      'AmountAfterDD',
      'CampusCode',
      'Date_Paid',
      'Amount',
      'PaymentMode',
      'BranchCode',
      'usertext1',
      'usertext2',
      'usertext3',
      'usertext4',
      'usertext5',
    ];
    if (required.some((x) => !header.includes(x)))
      throw new BusinessException(
        'CSV columns do not match the configured bank feed',
        HttpStatus.BAD_REQUEST,
        'INVALID_BANK_CSV_COLUMNS',
        { required, received: header },
      );
    const records = rows.slice(1).filter((r) => r.some((c) => c.trim()));
    if (records.some((r) => r.length !== header.length))
      throw new BusinessException(
        'Each bank CSV row must have the same number of columns as its header',
        HttpStatus.BAD_REQUEST,
        'MALFORMED_BANK_CSV',
      );
    const normalizedRows = records.map((cells) => {
      const row = Object.fromEntries(
        header.map((h, i) => [h, cells[i]?.trim() ?? '']),
      ) as Record<string, string>;
      for (const column of required.slice(0, 13)) {
        if (!row[column])
          throw new BusinessException(
            `Required bank CSV value is missing: ${column}`,
            HttpStatus.BAD_REQUEST,
            'MALFORMED_BANK_CSV',
          );
      }
      row['Valid Date of Voucher'] = this.csvDate(row['Valid Date of Voucher']);
      row['Due Date'] = this.csvDate(row['Due Date']);
      row.Date_Paid = this.csvDate(row.Date_Paid);
      row.AmountWithinDD = this.money(row.AmountWithinDD);
      row.AmountAfterDD = this.money(row.AmountAfterDD);
      row.Amount = this.money(row.Amount);
      return row;
    });
    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: 'text/csv',
      folder: `admissions/bank-reconciliation/${user.tenantId}`,
      fileName: file.originalname,
    });
    const batch = await this.imports.save(
      this.imports.create({
        tenantId: user.tenantId,
        fileReference: stored.storageKey,
        importedBy: user.userId,
        totalRecords: normalizedRows.length,
        matchedRecords: 0,
        exceptionRecords: 0,
        importStatus: BankImportStatus.PARTIAL,
        sourceFormat: 'CSV',
        sourceColumnsHash: createHash('sha256')
          .update(header.join('|'))
          .digest('hex'),
      }),
    );
    let matched = 0;
    let exceptions = 0;
    for (const row of normalizedRows) {
      const existing = await this.bankRecords.findOne({
        where: { tenantId: user.tenantId, receiptNo: row.ReceiptNo },
      });

      type Matched =
        | {
            kind: 'PROCESSING';
            id: string;
            registrationNumber: string;
            totalAmountPayable: string;
            entity: ProcessingFeeChallanEntity;
          }
        | {
            kind: 'OFFER';
            id: string;
            registrationNumber: string;
            totalAmountPayable: string;
            entity: AdmissionOfferFeeChallanEntity;
          };

      let resolved: Matched | null = null;
      if (!existing) {
        const processing = await this.challans.findOne({
          where: { tenantId: user.tenantId, challanNumber: row.ReceiptNo },
        });
        if (processing) {
          resolved = {
            kind: 'PROCESSING',
            id: processing.id,
            registrationNumber: processing.registrationNumber,
            totalAmountPayable: processing.totalAmountPayable,
            entity: processing,
          };
        } else {
          const offer = await this.offerChallans.findOne({
            where: { tenantId: user.tenantId, challanNumber: row.ReceiptNo },
          });
          if (offer) {
            resolved = {
              kind: 'OFFER',
              id: offer.id,
              registrationNumber: offer.registrationNumber,
              totalAmountPayable: offer.totalAmountPayable,
              entity: offer,
            };
          }
        }
      } else if (existing.matchedChallanId && existing.matchedChallanKind) {
        if (existing.matchedChallanKind === 'PROCESSING') {
          const processing = await this.challans.findOne({
            where: { id: existing.matchedChallanId, tenantId: user.tenantId },
          });
          if (processing) {
            resolved = {
              kind: 'PROCESSING',
              id: processing.id,
              registrationNumber: processing.registrationNumber,
              totalAmountPayable: processing.totalAmountPayable,
              entity: processing,
            };
          }
        } else if (existing.matchedChallanKind === 'OFFER') {
          const offer = await this.offerChallans.findOne({
            where: { id: existing.matchedChallanId, tenantId: user.tenantId },
          });
          if (offer) {
            resolved = {
              kind: 'OFFER',
              id: offer.id,
              registrationNumber: offer.registrationNumber,
              totalAmountPayable: offer.totalAmountPayable,
              entity: offer,
            };
          }
        }
      }

      const challan = existing && !resolved ? null : resolved;
      const registrationMatch = Boolean(
        challan && row.ConsumerNo === challan.registrationNumber,
      );
      const paid = Number(row.Amount);
      const base = Number(challan?.totalAmountPayable ?? 0);
      const paidAt = new Date(row.Date_Paid);
      const bankDueDate = new Date(row['Due Date']);
      const late = Boolean(challan && paidAt > bankDueDate);
      const expected = late
        ? Number(row.AmountAfterDD)
        : Number(row.AmountWithinDD);
      const bankAmountMatchesIssuedFee = late
        ? expected >= base
        : expected === base;
      const amountMatch = Boolean(
        challan &&
          Number.isFinite(paid) &&
          paid === expected &&
          bankAmountMatchesIssuedFee,
      );
      let matchStatus: ReconciliationMatchStatus;
      if (existing) matchStatus = ReconciliationMatchStatus.DUPLICATE;
      else if (!challan)
        matchStatus = ReconciliationMatchStatus.UNMATCHED_CHALLAN;
      else if (!registrationMatch)
        matchStatus = ReconciliationMatchStatus.REGISTRATION_MISMATCH;
      else if (!amountMatch)
        matchStatus = ReconciliationMatchStatus.AMOUNT_MISMATCH;
      else if (late) matchStatus = ReconciliationMatchStatus.LATE_PAYMENT;
      else matchStatus = ReconciliationMatchStatus.MATCHED;
      const ok =
        matchStatus === ReconciliationMatchStatus.MATCHED ||
        matchStatus === ReconciliationMatchStatus.LATE_PAYMENT;
      if (ok) matched++;
      else exceptions++;
      const saved = await this.bankRecords.save(
        this.bankRecords.create({
          tenantId: user.tenantId,
          importId: batch.id,
          receiptNo: row.ReceiptNo,
          consumerNo: row.ConsumerNo,
          className: row.ClassName,
          studentName: row['Student Name'],
          validDateOfVoucher: row['Valid Date of Voucher'],
          dueDate: row['Due Date'],
          amountWithinDd: row.AmountWithinDD,
          amountAfterDd: row.AmountAfterDD,
          campusCode: row.CampusCode,
          datePaid: row.Date_Paid,
          amount: row.Amount,
          paymentMode: row.PaymentMode,
          branchCode: row.BranchCode,
          usertext1: row.usertext1 || null,
          usertext2: row.usertext2 || null,
          usertext3: row.usertext3 || null,
          usertext4: row.usertext4 || null,
          usertext5: row.usertext5 || null,
          matchedChallanId: challan?.id ?? null,
          matchedChallanKind: challan?.kind ?? null,
          matchStatus,
          registrationMatch: challan ? registrationMatch : null,
          amountMatch: challan ? amountMatch : null,
          duplicateKey: existing ? `${batch.id}:${row.ReceiptNo}` : null,
          exceptionType: ok ? null : matchStatus,
          resolutionStatus: ReconciliationResolutionStatus.OPEN,
          resolvedBy: null,
          resolutionDate: null,
        }),
      );
      if (ok && challan && saved && !existing) {
        if (challan.kind === 'PROCESSING') {
          await this.verifyChallanFromBank(
            user,
            challan.entity,
            paid,
            paidAt,
            matchStatus === ReconciliationMatchStatus.LATE_PAYMENT,
          );
        } else {
          await this.offerFees.verifyChallanFromBank(
            user.tenantId,
            user.userId,
            challan.id,
            paid,
            paidAt,
            matchStatus === ReconciliationMatchStatus.LATE_PAYMENT,
          );
        }
      } else if (
        existing &&
        resolved &&
        [
          ReconciliationMatchStatus.MATCHED,
          ReconciliationMatchStatus.LATE_PAYMENT,
        ].includes(existing.matchStatus) &&
        existing.consumerNo === row.ConsumerNo &&
        Number(existing.amount) === paid &&
        existing.datePaid === row.Date_Paid
      ) {
        if (resolved.kind === 'PROCESSING') {
          await this.verifyChallanFromBank(
            user,
            resolved.entity,
            Number(existing.amount),
            new Date(`${existing.datePaid}T00:00:00.000Z`),
            existing.matchStatus === ReconciliationMatchStatus.LATE_PAYMENT,
          );
        } else {
          await this.offerFees.verifyChallanFromBank(
            user.tenantId,
            user.userId,
            resolved.id,
            Number(existing.amount),
            new Date(`${existing.datePaid}T00:00:00.000Z`),
            existing.matchStatus === ReconciliationMatchStatus.LATE_PAYMENT,
          );
        }
      }
    }
    batch.matchedRecords = matched;
    batch.exceptionRecords = exceptions;
    batch.importStatus = exceptions
      ? BankImportStatus.PARTIAL
      : BankImportStatus.COMPLETE;
    return this.imports.save(batch);
  }

  async getImport(user: AuthUser, id: string) {
    this.assertStaff(user);
    const row = await this.imports.findOne({
      where: { id, tenantId: user.tenantId },
    });
    if (!row) throw new NotFoundException('Bank import not found');
    return row;
  }
  async importRecords(user: AuthUser, id: string) {
    this.assertStaff(user);
    await this.getImport(user, id);
    return this.bankRecords.find({
      where: { tenantId: user.tenantId, importId: id },
      order: { receiptNo: 'ASC' },
    });
  }
  async exceptionQueue(user: AuthUser) {
    this.assertStaff(user);
    return this.bankRecords.find({
      where: {
        tenantId: user.tenantId,
        resolutionStatus: ReconciliationResolutionStatus.OPEN,
      },
      order: { id: 'DESC' },
    });
  }
  async resolveException(
    user: AuthUser,
    id: string,
    dto: ResolveReconciliationExceptionDto,
  ) {
    this.assertStaff(user);
    const row = await this.bankRecords.findOne({
      where: { id, tenantId: user.tenantId },
    });
    if (!row) throw new NotFoundException('Reconciliation record not found');
    row.resolutionStatus = dto.resolutionStatus;
    row.resolvedBy = user.userId;
    row.resolutionDate = new Date();
    if (
      dto.resolutionStatus === ReconciliationResolutionStatus.RESOLVED &&
      row.matchedChallanId &&
      row.registrationMatch &&
      row.amountMatch
    ) {
      if (row.matchedChallanKind === 'OFFER') {
        const offerChallan = await this.offerChallans.findOne({
          where: { id: row.matchedChallanId, tenantId: user.tenantId },
        });
        if (offerChallan) {
          await this.offerFees.verifyChallanFromBank(
            user.tenantId,
            user.userId,
            offerChallan.id,
            Number(row.amount),
            new Date(row.datePaid),
            new Date(row.datePaid) > offerChallan.dueDate,
          );
        }
      } else {
        const challan = await this.requireChallan(
          user.tenantId,
          row.matchedChallanId,
        );
        await this.verifyChallanFromBank(
          user,
          challan,
          Number(row.amount),
          new Date(row.datePaid),
          new Date(row.datePaid) > challan.dueDate,
        );
      }
    }
    return this.bankRecords.save(row);
  }

  async challanItems(user: AuthUser, challanId: string) {
    this.assertStaff(user);
    await this.requireChallan(user.tenantId, challanId);
    return this.items.find({
      where: { tenantId: user.tenantId, challanId },
      order: { createdAt: 'ASC' },
    });
  }

  private async verifyChallanFromBank(
    user: AuthUser,
    challan: ProcessingFeeChallanEntity,
    amount: number,
    paidAt: Date,
    late: boolean,
  ) {
    const evidence = await this.evidence.findOne({
      where: {
        tenantId: user.tenantId,
        challanId: challan.id,
        isCurrent: true,
      },
    });
    if (
      evidence?.verificationIndicator ===
      PaymentEvidenceVerificationIndicator.UNVERIFIED
    )
      await this.evidence.update(evidence.id, {
        verificationIndicator: PaymentEvidenceVerificationIndicator.VERIFIED,
        verifiedBy: 'SYSTEM',
        verificationDate: new Date(),
      });
    await this.challans.update(challan.id, {
      paymentStatus: late
        ? ProcessingFeeStatus.LATE_PAYMENT_VERIFIED
        : ProcessingFeeStatus.VERIFIED,
      paymentDate: paidAt,
      amountPaid: amount.toFixed(2),
      latePaymentFlag: late,
      verifiedBy: 'SYSTEM',
      verificationDate: new Date(),
    });
    await this.applications.update(challan.applicantId, {
      processingFeeStatus: late
        ? ProcessingFeeStatus.LATE_PAYMENT_VERIFIED
        : ProcessingFeeStatus.VERIFIED,
    });
  }

  private async requireApplicant(user: AuthUser, applicantId: string) {
    const app = await this.applications.findOne({
      where: { id: applicantId, tenantId: user.tenantId },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.iamUserId !== user.userId)
      throw new ForbiddenException('You do not own this application');
    return app;
  }
  private assertStaff(user: AuthUser) {
    const roles = (user.roles ?? []).map((r) => r.toUpperCase());
    const allowed = roles.some((r) =>
      [
        'ADMIN',
        'SUPER_ADMIN',
        'ADMISSIONS_ADMIN',
        'ADMISSION_MANAGER',
        'ADMISSIONS_MANAGER',
        'ADMISSIONS_OFFICER',
      ].includes(r),
    );
    if (roles.some((r) => APPLICANT_ONLY_ROLES.has(r)) || !allowed)
      throw new ForbiddenException('Admissions staff role is required');
  }
  private assertProvider(user: AuthUser) {
    if (
      !user.roles.some((r) =>
        ['PAYMENT_PROVIDER', 'SYSTEM', 'ADMISSIONS_PAYMENT_PROVIDER'].includes(
          r.toUpperCase(),
        ),
      )
    )
      throw new ForbiddenException(
        'Authenticated payment provider role is required',
      );
  }
  private async requireBank(tenantId: string, id: string) {
    const row = await this.banks.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Designated bank not found');
    return row;
  }
  private async requireEvidence(tenantId: string, id: string) {
    const row = await this.evidence.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Payment evidence not found');
    return row;
  }
  private async requireChallan(tenantId: string, id: string) {
    const row = await this.challans.findOne({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Challan not found');
    return row;
  }
  private hasValidEvidenceSignature(buffer: Buffer, format: string) {
    if (format === 'JPG')
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    if (format === 'PNG')
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (format === 'GIF')
      return ['GIF87a', 'GIF89a'].includes(
        buffer.subarray(0, 6).toString('ascii'),
      );
    if (format === 'BMP')
      return buffer.subarray(0, 2).toString('ascii') === 'BM';
    if (format === 'PDF')
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    return false;
  }
  private extensionMatches(fileName: string, format: string) {
    const extension = extname(fileName).slice(1).toUpperCase();
    return format === 'JPG'
      ? extension === 'JPG' || extension === 'JPEG'
      : extension === format;
  }
  private async newChallanNumber(now: Date) {
    for (let n = 0; n < 5; n++) {
      const code = `ADM-${now.getUTCFullYear()}-${randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
      if (!(await this.challans.exists({ where: { challanNumber: code } })))
        return code;
    }
    throw new BusinessException(
      'Could not allocate a unique challan number',
      HttpStatus.CONFLICT,
      'CHALLAN_NUMBER_COLLISION',
    );
  }
  private async challanResponse(row: ProcessingFeeChallanEntity) {
    const bank = await this.banks.findOneBy({
      id: row.designatedBankId,
      tenantId: row.tenantId,
    });
    return {
      ...row,
      bankLogoUrl: bank?.logoStorageKey
        ? await this.storage.resolveDownloadUrl(bank.logoStorageKey)
        : null,
      items: await this.items.find({
        where: { tenantId: row.tenantId, challanId: row.id },
        order: { createdAt: 'ASC' },
      }),
    };
  }

  private async bankResponse(bank: DesignatedBankEntity) {
    const { logoStorageKey, ...details } = bank;
    return {
      ...details,
      logoUrl: logoStorageKey
        ? await this.storage.resolveDownloadUrl(logoStorageKey)
        : null,
    };
  }

  private assertBankLogo(file?: PaymentUpload): asserts file is PaymentUpload {
    if (!file?.buffer?.length)
      throw new BusinessException(
        'Bank logo file is required',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
      );
    const extensions: Record<string, string[]> = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    };
    const allowed = extensions[file.mimetype];
    const signatureMatches =
      (file.mimetype === 'image/jpeg' && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff) ||
      (file.mimetype === 'image/png' && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (file.mimetype === 'image/webp' && file.buffer.toString('ascii', 0, 4) === 'RIFF' && file.buffer.toString('ascii', 8, 12) === 'WEBP');
    if (!allowed || !allowed.includes(extname(file.originalname).toLowerCase()) || !signatureMatches)
      throw new BusinessException(
        'Only matching JPEG, PNG, or WEBP images are allowed',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'INVALID_BANK_LOGO_FORMAT',
      );
    if (file.size > 2 * 1024 * 1024)
      throw new BusinessException(
        'Bank logo must be 2 MB or smaller',
        HttpStatus.PAYLOAD_TOO_LARGE,
        'FILE_TOO_LARGE',
      );
  }
  private async onlinePaymentResponse(row: OnlinePaymentTransactionEntity) {
    const receipt = await this.evidence.findOne({
      where: {
        tenantId: row.tenantId,
        onlinePaymentTransactionId: row.id,
        isCurrent: true,
      },
    });
    return { ...row, receiptRequired: true, receiptUploaded: Boolean(receipt) };
  }
  private csvDate(value: string) {
    const s = value.trim();
    if (/^\d{8}$/.test(s))
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const d = new Date(s);
    if (Number.isNaN(d.valueOf()))
      throw new UnprocessableEntityException(`Invalid bank date: ${value}`);
    return d.toISOString().slice(0, 10);
  }
  private money(value: string) {
    const n = Number(value.replaceAll(',', '').trim());
    if (!Number.isFinite(n) || n < 0)
      throw new UnprocessableEntityException(`Invalid bank amount: ${value}`);
    return n.toFixed(2);
  }
  private parseCsv(text: string): string[][] {
    const out: string[][] = [];
    let row: string[] = [],
      cell = '',
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"' && quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = !quoted;
      else if (c === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        out.push(row);
        row = [];
        cell = '';
      } else cell += c;
    }
    if (cell.length || row.length) {
      row.push(cell);
      out.push(row);
    }
    return out;
  }
  private amountInWords(value: number) {
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
    const [wholeText, fractionalText] = value.toFixed(2).split('.');
    const n = Number(wholeText);
    const cents = Number(fractionalText);
    let wholeWords: string;
    if (n < 1000) {
      wholeWords = under(n);
    } else {
      const parts: string[] = [];
      let rem = n;
      for (const [base, label] of [
        [1_000_000, 'million'],
        [1000, 'thousand'],
        [1, ''],
      ] as [number, string][]) {
        const q = Math.floor(rem / base);
        if (q) {
          parts.push(`${under(q)}${label ? ` ${label}` : ''}`);
          rem %= base;
        }
      }
      wholeWords = parts.join(' ');
    }
    return cents ? `${wholeWords} and ${cents}/100` : wholeWords;
  }
}
