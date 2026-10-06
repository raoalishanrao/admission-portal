import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntakeStatus } from '../../../common/enums/intake-status.enum.js';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto.js';

export class IntakeResponseDto {
  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', description: 'Intake ID' })
  id!: string;

  @ApiProperty({ example: '90000000-0000-4000-8000-000000009001' })
  tenantId!: string;

  @ApiProperty({ example: 'Fall 2026 Admissions' })
  intakeName!: string;

  @ApiProperty({ example: 'FALL-2026' })
  intakeCode!: string;

  @ApiProperty({ enum: IntakeStatus, example: IntakeStatus.DRAFT })
  status!: IntakeStatus;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  applicationOpenAt!: string;

  @ApiProperty({ example: '2026-09-15T23:59:59.000Z' })
  applicationCloseAt!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 30, description: 'Offer acceptance and required-fee payment period in days' })
  offerPaymentPeriodDays!: number;

  @ApiProperty({ enum: ['MANUAL', 'AUTO'], example: 'MANUAL' })
  meritGenerationMode!: string;

  @ApiProperty({ example: 0, description: 'Allowed % variance when verifying offer-fee payment' })
  feeConfirmMarginPercent!: number;

  @ApiProperty({ example: 0, description: 'Grace hours after acceptance deadline before unpaid expiry' })
  offerFeeGraceHours!: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  publishedAt!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  publishedBy!: string | null;

  @ApiProperty({
    example: 3,
    description: 'Number of programmes (offerings) configured on this intake',
  })
  programmesCount!: number;

  @ApiProperty({ example: '2026-06-01T11:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  createdBy!: string;

  @ApiProperty({ example: '2026-06-01T11:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  updatedBy!: string;
}

/** Tenant-wide intake counts for dashboard summary cards. */
export class IntakeStatusSummaryDto {
  @ApiProperty({ example: 8, description: 'Total intakes for the tenant' })
  total!: number;

  @ApiProperty({ example: 2 })
  draft!: number;

  @ApiProperty({ example: 0, description: 'CONFIGURED intakes' })
  configured!: number;

  @ApiProperty({ example: 1 })
  underReview!: number;

  @ApiProperty({ example: 4 })
  published!: number;

  @ApiProperty({ example: 1 })
  closed!: number;
}

export class IntakeListResponseDto {
  @ApiProperty({ type: [IntakeResponseDto] })
  items!: IntakeResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
