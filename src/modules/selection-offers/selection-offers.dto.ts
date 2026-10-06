import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UploadResultQueryDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() testSessionId!: string;
}
export class ResultImportResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() status!: string;
  @ApiProperty() totalRows!: number;
  @ApiProperty() validRows!: number;
  @ApiProperty() invalidRows!: number;
}
export class ImportRowQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class GenerateMeritListDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() testSessionId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() programmeOfferingId!: string;
}
export class AllocationPreviewDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() intakeSessionId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() testSessionId!: string;
}
export class AllocationConfirmDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() allocationId!: string;
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) allocationVersion!: number;
}
export class ConfirmImportDto {
  @ApiPropertyOptional({ description: 'Required only when this import explicitly replaces an existing confirmed result', maxLength: 2000 }) @IsOptional() @IsString() @MaxLength(2000) correctionReason?: string;
}
export class OfferAuthorizationDto {
  @ApiProperty({ enum: ['CONDITIONAL', 'UNCONDITIONAL'] }) @IsIn(['CONDITIONAL', 'UNCONDITIONAL']) offerType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) offerConditions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) feePaymentInstructions?: string;
  @ApiProperty({ description: 'Private generated offer-document reference' }) @IsString() @MaxLength(1000) offerLetterDocument!: string;
}
export class OfferResponseEventDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() eventId!: string;
  @ApiProperty({ minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) eventVersion!: number;
  @ApiProperty({ enum: ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'OFFER_EXPIRED'] }) @IsIn(['OFFER_ACCEPTED', 'OFFER_DECLINED', 'OFFER_EXPIRED']) eventType!: string;
  @ApiProperty({ format: 'date-time' }) @IsString() occurredAt!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() offerId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() applicationRecordId!: string;
  @ApiProperty({ enum: ['ACCEPTED', 'DECLINED', 'EXPIRED'] }) @IsIn(['ACCEPTED', 'DECLINED', 'EXPIRED']) responseStatus!: string;
}
