import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  OnlinePaymentMethod,
  OnlinePaymentStatus,
  PaymentEvidenceSource,
  ReconciliationResolutionStatus,
} from '../../../common/enums/processing-fee.enum.js';

export class CreateOnlinePaymentDto {
  @ApiProperty({ enum: OnlinePaymentMethod })
  @IsEnum(OnlinePaymentMethod)
  paymentMethod!: OnlinePaymentMethod;

  @ApiProperty({ example: 'WALLET-20260925-000123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  transactionReference!: string;

  @ApiProperty({ example: 'PKR' })
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/)
  currency!: string;

  @ApiProperty({ example: 2500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: 'Muhammad Ahmed' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  senderName!: string;

  @ApiPropertyOptional({ example: 'JAZZCASH' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  providerCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ConfirmOnlinePaymentDto {
  @ApiProperty({ example: 'WALLET-20260925-000123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  transactionReference!: string;

  @ApiProperty({
    enum: [
      OnlinePaymentStatus.PENDING,
      OnlinePaymentStatus.SUCCESS,
      OnlinePaymentStatus.FAILED,
    ],
    example: OnlinePaymentStatus.SUCCESS,
  })
  @IsIn([
    OnlinePaymentStatus.PENDING,
    OnlinePaymentStatus.SUCCESS,
    OnlinePaymentStatus.FAILED,
  ])
  status!: OnlinePaymentStatus;

  @ApiPropertyOptional({ example: '2026-09-25T10:15:00.000Z' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}

export class VerifyPaymentEvidenceDto {
  @ApiPropertyOptional({ example: 'Stamped challan verified.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  verificationNote?: string;

  @ApiPropertyOptional({ example: 'MANUAL' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  verificationSource?: string;

  @ApiPropertyOptional({ example: '2026-09-25T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amountPaid?: number;
}

export class ResolveReconciliationExceptionDto {
  @ApiProperty({
    enum: [
      ReconciliationResolutionStatus.RESOLVED,
      ReconciliationResolutionStatus.IGNORED,
    ],
  })
  @IsIn([
    ReconciliationResolutionStatus.RESOLVED,
    ReconciliationResolutionStatus.IGNORED,
  ])
  resolutionStatus!: ReconciliationResolutionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectPaymentEvidenceDto {
  @ApiProperty({
    example: 'Receipt is unclear. Please upload a readable copy.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class PaymentActionResponseDto {
  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  message?: string;
}

export class EvidenceVerificationResponseDto {
  @ApiProperty() evidenceId!: string;
  @ApiProperty() paymentStatus!: string;
  @ApiProperty() paymentDate!: Date;
  @ApiProperty() amountPaid!: string;
  @ApiPropertyOptional({ nullable: true }) verificationNote!: string | null;
  @ApiProperty() verificationSource!: string;
}

export class EvidenceRejectionResponseDto {
  @ApiProperty() evidenceId!: string;
  @ApiProperty() verificationIndicator!: string;
  @ApiPropertyOptional({ nullable: true }) reason!: string | null;
  @ApiProperty() replacementAllowed!: boolean;
}

export class CreateDesignatedBankDto {
  @ApiProperty({ example: 'Designated Collection Bank' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  bankName!: string;

  @ApiProperty({ example: 'Lahore Main Branch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  branchName!: string;

  @ApiProperty({ example: 'LHR-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  branchCode!: string;

  @ApiProperty({ example: 'NUKTA ADMISSIONS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  accountTitle!: string;

  @ApiProperty({ example: 'PK00BANK0000000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountNumber!: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class DesignatedBankResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  branchName!: string;

  @ApiProperty()
  branchCode!: string;

  @ApiProperty()
  accountTitle!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiProperty()
  effectiveFrom!: Date;

  @ApiPropertyOptional({ nullable: true })
  effectiveTo!: Date | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Resolved URL for the bank logo, when configured' })
  logoUrl!: string | null;
}

export class PaymentEvidenceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  challanId!: string;

  @ApiProperty({ enum: PaymentEvidenceSource })
  evidenceSource!: PaymentEvidenceSource;

  @ApiProperty()
  fileFormat!: string;

  @ApiProperty()
  verificationIndicator!: string;

  @ApiProperty()
  isCurrent!: boolean;

  @ApiProperty()
  uploadDate!: Date;

  @ApiProperty()
  downloadUrl!: string;
}

export class ProcessingFeeChallanItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  feeTypeCode!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  unitAmount!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;
}

export class ProcessingFeeChallanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  applicantId!: string;

  @ApiProperty()
  challanNumber!: string;

  @ApiProperty()
  issueDate!: Date;

  @ApiProperty()
  dueDate!: Date;

  @ApiProperty()
  applicantName!: string;

  @ApiProperty()
  registrationNumber!: string;

  @ApiProperty()
  intakeSession!: string;

  @ApiProperty()
  programmesAppliedFor!: string;

  @ApiProperty()
  totalAmountPayable!: string;

  @ApiProperty()
  amountInWords!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiProperty()
  latePaymentFlag!: boolean;

  @ApiProperty()
  collectionBankName!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Resolved URL for the designated bank logo' })
  bankLogoUrl!: string | null;

  @ApiProperty()
  collectionBankBranch!: string;

  @ApiProperty()
  collectionBankAccount!: string;

  @ApiProperty()
  branchCode!: string;

  @ApiProperty({ type: [ProcessingFeeChallanItemResponseDto] })
  items!: ProcessingFeeChallanItemResponseDto[];
}

export class ProcessingFeeStatusResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty()
  applicationStatus!: string;

  @ApiProperty()
  paymentStatus!: string;

  @ApiPropertyOptional({
    type: ProcessingFeeChallanResponseDto,
    nullable: true,
  })
  challan!: ProcessingFeeChallanResponseDto | null;
}

export class ProcessingFeePrintResponseDto {
  @ApiProperty({ type: ProcessingFeeChallanResponseDto })
  challan!: ProcessingFeeChallanResponseDto;

  @ApiProperty({
    type: [String],
    example: ['APPLICANT', 'INSTITUTION', 'BANK'],
  })
  copies!: string[];
}

export class ApplicationProcessingFeeResponseDto {
  @ApiProperty() applicantId!: string;
  @ApiProperty() applicationReference!: string;
  @ApiProperty() paymentStatus!: string;
  @ApiPropertyOptional({
    type: ProcessingFeeChallanResponseDto,
    nullable: true,
  })
  challan!: ProcessingFeeChallanResponseDto | null;
  @ApiProperty({ type: [PaymentEvidenceResponseDto] })
  evidence!: PaymentEvidenceResponseDto[];
}

export class OnlinePaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  challanId!: string;

  @ApiProperty({ enum: OnlinePaymentMethod })
  paymentMethod!: OnlinePaymentMethod;

  @ApiProperty()
  transactionReference!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  senderName!: string;

  @ApiProperty({ enum: OnlinePaymentStatus })
  status!: OnlinePaymentStatus;

  @ApiProperty()
  receiptRequired!: boolean;

  @ApiProperty()
  receiptUploaded!: boolean;
}

export class ReconciliationImportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  totalRecords!: number;

  @ApiProperty()
  matchedRecords!: number;

  @ApiProperty()
  exceptionRecords!: number;

  @ApiProperty()
  importStatus!: string;
}

export class BankRecordResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  receiptNo!: string;

  @ApiProperty()
  consumerNo!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  matchStatus!: string;

  @ApiProperty()
  resolutionStatus!: string;

  @ApiPropertyOptional()
  matchedChallanId!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['PROCESSING', 'OFFER'],
    description: 'Which challan table matched: processing fee or post-offer admission fee',
  })
  matchedChallanKind!: 'PROCESSING' | 'OFFER' | null;
}

export class BankReconciliationRecordResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() receiptNo!: string;
  @ApiProperty() consumerNo!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() matchStatus!: string;
  @ApiProperty() resolutionStatus!: string;
  @ApiPropertyOptional({ nullable: true }) matchedChallanId!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    enum: ['PROCESSING', 'OFFER'],
    description: 'Which challan table matched: processing fee or post-offer admission fee',
  })
  matchedChallanKind!: 'PROCESSING' | 'OFFER' | null;
  @ApiPropertyOptional({ nullable: true }) registrationMatch!: boolean | null;
  @ApiPropertyOptional({ nullable: true }) amountMatch!: boolean | null;
  @ApiPropertyOptional({ nullable: true }) exceptionType!: string | null;
}
