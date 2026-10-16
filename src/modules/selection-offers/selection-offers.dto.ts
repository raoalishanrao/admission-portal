import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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

export class ListResultImportsQueryDto extends ImportRowQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filter imports for a test session' })
  @IsOptional()
  @IsUUID()
  testSessionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filter imports for an intake' })
  @IsOptional()
  @IsUUID()
  intakeSessionId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Filter imports whose test session is linked to this programme offering',
  })
  @IsOptional()
  @IsUUID()
  programmeOfferingId?: string;

  @ApiPropertyOptional({
    enum: [
      'READY_TO_CONFIRM',
      'VALIDATION_FAILED',
      'CONFIRMED',
      'CANCELLED',
      'SUPERSEDED',
    ],
  })
  @IsOptional()
  @IsIn([
    'READY_TO_CONFIRM',
    'VALIDATION_FAILED',
    'CONFIRMED',
    'CANCELLED',
    'SUPERSEDED',
  ])
  status?: string;
}

export class ListOffersByOfferingQueryDto extends ImportRowQueryDto {
  @ApiPropertyOptional({
    enum: [
      'AUTHORIZED',
      'PUBLISHED',
      'ACCEPTED',
      'DECLINED',
      'EXPIRED',
      'CANCELLED',
    ],
  })
  @IsOptional()
  @IsIn([
    'AUTHORIZED',
    'PUBLISHED',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED',
    'CANCELLED',
  ])
  status?: string;
}

export class ListMeritListsByOfferingQueryDto extends ImportRowQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  testSessionId?: string;

  @ApiPropertyOptional({
    enum: ['DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'CANCELLED'],
  })
  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({
    description:
      'When true, return only the highest list_version matching the filters',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  latestOnly?: boolean;
}

export class ListPublishedResultsByOfferingQueryDto extends ImportRowQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  testSessionId?: string;

  @ApiPropertyOptional({ enum: ['PASS', 'FAIL'] })
  @IsOptional()
  @IsIn(['PASS', 'FAIL'])
  resultStatus?: string;
}
export class GenerateMeritListDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() testSessionId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() programmeOfferingId!: string;
}
export class AllocationPreviewDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() intakeSessionId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() testSessionId!: string;
}
export class AllocationConfirmItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  allocationId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  allocationVersion!: number;
}

export class AllocationConfirmDto {
  @ApiProperty({
    type: [AllocationConfirmItemDto],
    minItems: 1,
    description: 'One or more allocation previews to confirm in a single request',
    example: [
      {
        allocationId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        allocationVersion: 1,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocationConfirmItemDto)
  allocations!: AllocationConfirmItemDto[];
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
