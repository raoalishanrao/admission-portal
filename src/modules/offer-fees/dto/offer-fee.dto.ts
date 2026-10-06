import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { OfferFeeStatus } from '../../../common/enums/offer-fee.enum.js';
import { PaymentEvidenceVerificationIndicator } from '../../../common/enums/processing-fee.enum.js';

export class OfferFeeChallanItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() feeTypeCode!: string;
  @ApiProperty() description!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty() unitAmount!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
}

export class OfferFeeChallanResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() offerId!: string;
  @ApiProperty() applicantId!: string;
  @ApiProperty() programmeOfferingId!: string;
  @ApiProperty() challanNumber!: string;
  @ApiProperty() issueDate!: string;
  @ApiProperty() dueDate!: string;
  @ApiProperty() collectionBankName!: string;
  @ApiProperty() collectionBankBranch!: string;
  @ApiProperty() collectionBankAccount!: string;
  @ApiProperty() branchCode!: string;
  @ApiPropertyOptional({ nullable: true }) institutionCode!: string | null;
  @ApiProperty() applicantName!: string;
  @ApiProperty() applicantContactNumber!: string;
  @ApiProperty() registrationNumber!: string;
  @ApiProperty() intakeSession!: string;
  @ApiProperty() programmeName!: string;
  @ApiProperty() totalAmountPayable!: string;
  @ApiProperty() amountInWords!: string;
  @ApiProperty({ enum: OfferFeeStatus }) paymentStatus!: OfferFeeStatus;
  @ApiPropertyOptional({ nullable: true }) paymentDate!: string | null;
  @ApiPropertyOptional({ nullable: true }) amountPaid!: string | null;
  @ApiProperty() latePaymentFlag!: boolean;
  @ApiPropertyOptional({ type: [OfferFeeChallanItemResponseDto] })
  items?: OfferFeeChallanItemResponseDto[];
}

export class OfferFeeEvidenceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() challanId!: string;
  @ApiProperty() fileFormat!: string;
  @ApiProperty() evidenceSource!: string;
  @ApiPropertyOptional({ nullable: true }) amountClaimed!: string | null;
  @ApiProperty({ enum: PaymentEvidenceVerificationIndicator })
  verificationIndicator!: string;
  @ApiProperty() uploadDate!: string;
  @ApiPropertyOptional({ nullable: true }) downloadUrl!: string | null;
}

/** Result of admin verify/reject on offer-fee evidence (not the evidence row itself). */
export class VerifyOfferFeeEvidenceResponseDto {
  @ApiProperty() evidenceId!: string;

  @ApiProperty({ enum: OfferFeeStatus })
  paymentStatus!: OfferFeeStatus;

  @ApiPropertyOptional({
    description: 'Present when verification succeeded (not on reject)',
  })
  challanId?: string;

  @ApiPropertyOptional({
    description: 'Recorded paid amount when verification succeeded',
  })
  amountPaid?: string;

  @ApiPropertyOptional({
    description: 'True when paid after due date or forceLate was set',
  })
  latePaymentFlag?: boolean;
}

export class VerifyOfferFeeEvidenceDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] })
  @IsEnum(PaymentEvidenceVerificationIndicator)
  verificationIndicator!:
    | PaymentEvidenceVerificationIndicator.VERIFIED
    | PaymentEvidenceVerificationIndicator.REJECTED;

  @ApiPropertyOptional({ description: 'Amount recorded as paid' })
  @IsOptional()
  @Transform(({ value }) => (value == null || value === '' ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;

  @ApiPropertyOptional({
    description: 'Treat as late payment even if within due date',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceLate?: boolean;
}

export class ExpireUnpaidOffersDto {
  @ApiPropertyOptional({
    description: 'Limit to one intake; omit to process all intakes for the tenant',
  })
  @IsOptional()
  @IsUUID()
  intakeSessionId?: string;

  @ApiPropertyOptional({
    description: 'When true, promote next WAITING candidate into a new published offer',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  promoteWaitlist?: boolean;
}

export class SeatReleaseRunResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() programmeOfferingId!: string;
  @ApiProperty({ enum: ['OFFER_EXPIRED', 'FEE_UNPAID', 'MANUAL'] })
  triggerType!: string;
  @ApiProperty() seatsFreed!: number;
  @ApiProperty() promotedCount!: number;
  @ApiPropertyOptional({ nullable: true }) expiredOfferId!: string | null;
  @ApiPropertyOptional({ nullable: true }) promotedApplicationId!: string | null;
  @ApiPropertyOptional({ nullable: true }) newOfferId!: string | null;
}

export class ExpireUnpaidOffersResponseDto {
  @ApiProperty({ description: 'Number of published offers expired in this run' })
  expiredCount!: number;

  @ApiProperty({
    description: 'Total waitlist promotions across all seat-release runs',
  })
  promotedCount!: number;

  @ApiProperty({ type: [SeatReleaseRunResponseDto] })
  runs!: SeatReleaseRunResponseDto[];
}
