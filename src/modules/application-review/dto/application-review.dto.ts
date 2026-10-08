import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApplicationStatus } from '../../../common/enums/application-status.enum.js';

export enum ApplicationReviewQueue {
  SUBMITTED = 'SUBMITTED',
  PAID_PROCESSING_FEE = 'PAID_PROCESSING_FEE',
  UNPAID_PROCESSING_FEE = 'UNPAID_PROCESSING_FEE',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  MISSING_FEE = 'MISSING_FEE',
  MISSING_DOCUMENTS = 'MISSING_DOCUMENTS',
  MISSING_FEE_AND_DOCUMENTS = 'MISSING_FEE_AND_DOCUMENTS',
}

export class ApplicationReviewQueryDto {
  @ApiPropertyOptional({ type: Number, example: 1, default: 1, minimum: 1, description: '1-based page number' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;

  @ApiPropertyOptional({ type: Number, example: 20, default: 20, minimum: 1, maximum: 100, description: 'Number of applications per page (maximum 100)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;

  @ApiPropertyOptional({ type: String, example: 'Ali Khan', description: 'Search by applicant name, email, or application reference' })
  @IsOptional() @IsString() @MaxLength(100) search?: string;

  @ApiPropertyOptional({ enum: ApplicationReviewQueue, enumName: 'ApplicationReviewQueue', description: 'Filter by review queue/status' })
  @IsOptional() @IsEnum(ApplicationReviewQueue) queue?: ApplicationReviewQueue;
}

export class ApplicationDecisionDto {
  @ApiProperty({ enum: [ApplicationStatus.APPROVED, ApplicationStatus.REJECTED] })
  @IsIn([ApplicationStatus.APPROVED, ApplicationStatus.REJECTED]) status!: ApplicationStatus.APPROVED | ApplicationStatus.REJECTED;
  @ApiPropertyOptional({ enum: ['NON_PAYMENT_BEYOND_DUE_PERIOD','UNVERIFIED_PAYMENT','INCOMPLETE_DOCUMENT_SET','FAILED_ELIGIBILITY_CRITERIA','OTHER'] })
  @IsOptional() @IsString() @MaxLength(60) reasonCode?: string;
  @ApiPropertyOptional({ example: 'Required supporting document is missing.' })
  @IsOptional() @IsString() @MaxLength(2000) reasonText?: string;
}

export class ApplicationReadinessDto {
  @ApiProperty() paymentVerified!: boolean;
  @ApiProperty() documentsComplete!: boolean;
  @ApiProperty() approvalAllowed!: boolean;
  @ApiProperty({ type: [String] }) unmetPreconditions!: string[];
}

export class ApplicationListPreferenceDto {
  @ApiProperty() id!: string;
  @ApiProperty() preferenceOrder!: number;
  @ApiProperty() programmeOfferingId!: string;
  @ApiPropertyOptional({ nullable: true }) programmeId!: string | null;
  @ApiPropertyOptional({ nullable: true }) programmeCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) programmeName!: string | null;
}

export class ApplicationQueueItemDto {
  @ApiProperty() applicantId!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() applicationReference!: string;
  @ApiProperty() applicantName!: string;
  @ApiProperty() registeredEmail!: string;
  @ApiProperty() intakeName!: string;
  @ApiProperty() status!: string;
  @ApiProperty() paymentStatus!: string;
  @ApiProperty() documentsComplete!: boolean;
  @ApiProperty() approvalAllowed!: boolean;
  @ApiProperty({ type: [String] }) unmetPreconditions!: string[];
  @ApiPropertyOptional({ nullable: true }) statusUpdatedAt!: Date | null;
  @ApiProperty({ type: [ApplicationListPreferenceDto] }) programmePreferences!: ApplicationListPreferenceDto[];
}

export class ApplicationReviewListDto {
  @ApiProperty({ type: [ApplicationQueueItemDto] }) items!: ApplicationQueueItemDto[];
  @ApiProperty({ type: 'object', additionalProperties: true }) meta!: { page: number; limit: number; total: number; totalPages: number };
}

export class ApplicationReviewResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true }) application!: Record<string, unknown>;
  @ApiProperty({ type: 'object', additionalProperties: true }) intake!: Record<string, unknown>;
  @ApiProperty({ type: [Object] }) education!: Record<string, unknown>[];
  @ApiProperty({ type: [Object] }) programmePreferences!: Record<string, unknown>[];
  @ApiProperty({ type: [Object] }) addresses!: Record<string, unknown>[];
  @ApiProperty({ type: [Object] }) contacts!: Record<string, unknown>[];
  @ApiPropertyOptional({ type: 'object', nullable: true, additionalProperties: true }) declaration!: Record<string, unknown> | null;
  @ApiProperty({ type: [Object] }) documents!: Record<string, unknown>[];
  @ApiProperty({ type: 'object', additionalProperties: true }) payment!: Record<string, unknown>;
  @ApiProperty() approvalAllowed!: boolean;
  @ApiProperty({ type: [String] }) unmetPreconditions!: string[];
}

export class ApplicationDecisionResponseDto {
  @ApiProperty() applicantId!: string;
  @ApiProperty() applicationReference!: string;
  @ApiProperty() previousStatus!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) rejectionReasonCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) rejectionReason!: string | null;
  @ApiProperty() statusUpdatedBy!: string;
  @ApiProperty() statusUpdatedAt!: Date;
  @ApiProperty() unchanged!: boolean;
  @ApiPropertyOptional({ nullable: true, description: 'Admit card snapshot generated automatically on APPROVED' })
  admitCard?: Record<string, unknown> | null;
}

export class ApplicationStatusAuditDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicantId!: string;
  @ApiProperty() fromStatus!: string;
  @ApiProperty() toStatus!: string;
  @ApiPropertyOptional({ nullable: true }) reasonCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) reason!: string | null;
  @ApiPropertyOptional({ nullable: true }) actedBy!: string | null;
  @ApiProperty() source!: string;
  @ApiProperty() actedAt!: Date;
}
