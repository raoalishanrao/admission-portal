import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DegreeLevel } from '../../../common/enums/master-data.enum.js';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto.js';

export class CreateDocumentTypeDto {
  @ApiProperty({ example: 'NOC' }) @IsString() @MaxLength(60) code!: string;
  @ApiProperty({ example: 'No Objection Certificate' }) @IsString() @MaxLength(150) name!: string;
  @ApiProperty({ example: 'SUPPORTING' }) @IsString() @MaxLength(40) category!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}
export class CreateOfferingRequirementDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() documentTypeId!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() mandatory?: boolean;
  @ApiPropertyOptional({ example: 'TRANSFER_CASE', nullable: true }) @IsOptional() @IsString() @MaxLength(60) conditionCode?: string | null;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}
export class CreateOfferingRequirementsDto {
  @ApiProperty({ type: [String], format: 'uuid', minItems: 1 })
  @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID(undefined, { each: true })
  offeringIds!: string[];

  @ApiProperty({ type: [CreateOfferingRequirementDto], minItems: 1 })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateOfferingRequirementDto)
  requirements!: CreateOfferingRequirementDto[];
}
export class UpdateOfferingRequirementDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mandatory?: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(60) conditionCode?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class LinkAcademicDocumentDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Equivalent selected-offering requirements covered by this one file' }) @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayUnique() @IsUUID(undefined, { each: true }) offeringRequiredDocumentIds?: string[];
  @ApiPropertyOptional({ format: 'uuid', deprecated: true, description: 'Legacy single-requirement form; prefer offeringRequiredDocumentIds' }) @IsOptional() @IsUUID() offeringRequiredDocumentId?: string;
  @ApiProperty({ format: 'uuid', description: 'UUID of the existing academic document' }) @IsUUID() academicDocumentId!: string;
}
export class RequestResubmissionDto {
  @ApiProperty({ example: 'The scan is not legible.' }) @IsString() @MaxLength(2000) reason!: string;
}
export class LinkedDocumentRequirementDto {
  @ApiProperty({ format: 'uuid' }) applicantDocumentId!: string;
  @ApiProperty({ format: 'uuid' }) offeringRequiredDocumentId!: string;
  @ApiProperty({ format: 'uuid' }) programmeOfferingId!: string;
  @ApiProperty({ enum: ['NOT_SUBMITTED', 'SUBMITTED', 'RESUBMISSION_REQUIRED', 'VERIFIED'] }) status!: string;
}
export class ApplicantRequirementStatusDto {
  @ApiProperty({ format: 'uuid' }) offeringRequiredDocumentId!: string;
  @ApiProperty({ format: 'uuid' }) programmeOfferingId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) applicantDocumentId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) documentFileId?: string | null;
  @ApiProperty() mandatory!: boolean;
  @ApiPropertyOptional({ nullable: true }) conditionCode!: string | null;
  @ApiProperty({ enum: ['NOT_SUBMITTED', 'SUBMITTED', 'RESUBMISSION_REQUIRED', 'VERIFIED'] }) status!: string;
}
export class AdmissionDocumentDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Shared uploaded file referenced by one or more offering requirements' }) documentFileId?: string | null;
  @ApiProperty() applicantId!: string;
  @ApiProperty() programmeOfferingId!: string;
  @ApiProperty() offeringRequiredDocumentId!: string;
  @ApiProperty() documentTypeId!: string;
  @ApiProperty() documentTypeCode!: string;
  @ApiProperty() documentTypeName!: string;
  @ApiProperty() mandatory!: boolean;
  @ApiPropertyOptional({ nullable: true }) conditionCode!: string | null;
  @ApiProperty() sourceModule!: string;
  @ApiPropertyOptional({ nullable: true }) sourceDocumentId!: string | null;
  @ApiPropertyOptional({ nullable: true }) fileReference!: string | null;
  @ApiPropertyOptional({ nullable: true }) downloadUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) fileName!: string | null;
  @ApiPropertyOptional({ nullable: true }) mimeType!: string | null;
  @ApiPropertyOptional({ nullable: true }) fileSizeBytes!: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) resubmissionReason!: string | null;
  @ApiPropertyOptional({ nullable: true }) submittedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) verifiedAt!: Date | null;
  @ApiPropertyOptional({ type: [LinkedDocumentRequirementDto], description: 'All offering requirements using this shared file' }) linkedRequirements?: LinkedDocumentRequirementDto[];
}
export class DocumentTypeResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() active!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
export class OfferingRequirementResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) programmeOfferingId!: string;
  @ApiProperty({ format: 'uuid' }) documentTypeId!: string;
  @ApiProperty() mandatory!: boolean;
  @ApiPropertyOptional({ nullable: true }) conditionCode!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() active!: boolean;
  @ApiPropertyOptional({ enum: ['MANUAL', 'DEGREE_LEVEL'], default: 'MANUAL' })
  source?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  sourceDegreeLevelRequirementId?: string | null;
  @ApiProperty({ type: DocumentTypeResponseDto }) documentType!: DocumentTypeResponseDto;
}

export class CreateDegreeLevelRequiredDocumentDto {
  @ApiProperty({ enum: DegreeLevel, example: DegreeLevel.Bachelor })
  @IsEnum(DegreeLevel)
  degreeLevel!: DegreeLevel;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  documentTypeId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({ example: 'TRANSFER_CASE', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  conditionCode?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateDegreeLevelRequiredDocumentDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  conditionCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListDegreeLevelRequiredDocumentsQueryDto {
  @ApiPropertyOptional({ enum: DegreeLevel })
  @IsOptional()
  @IsEnum(DegreeLevel)
  degreeLevel?: DegreeLevel;

  @ApiPropertyOptional({ type: Number, example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, example: 50, minimum: 1, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 50;
}

export class DegreeLevelRequiredDocumentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({ enum: DegreeLevel }) degreeLevel!: DegreeLevel;
  @ApiProperty({ format: 'uuid' }) documentTypeId!: string;
  @ApiProperty() mandatory!: boolean;
  @ApiPropertyOptional({ nullable: true }) conditionCode!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() active!: boolean;
  @ApiPropertyOptional({ type: DocumentTypeResponseDto, nullable: true })
  documentType!: DocumentTypeResponseDto | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class DegreeLevelRequiredDocumentListResponseDto {
  @ApiProperty({ type: [DegreeLevelRequiredDocumentResponseDto] })
  items!: DegreeLevelRequiredDocumentResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class ApplyDegreeLevelDocumentsDto {
  @ApiPropertyOptional({
    enum: DegreeLevel,
    description: 'Apply active templates for this degree level to all matching offerings',
  })
  @IsOptional()
  @IsEnum(DegreeLevel)
  degreeLevel?: DegreeLevel;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Optional: limit apply to these offerings (still filtered by programme degree level)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  offeringIds?: string[];
}

export class ApplyDegreeLevelDocumentsResultDto {
  @ApiProperty({ enum: DegreeLevel }) degreeLevel!: DegreeLevel;
  @ApiProperty() offeringsTouched!: number;
  @ApiProperty() created!: number;
  @ApiProperty() updated!: number;
  @ApiProperty() skipped!: number;
}
export class OfferingRequirementBatchResponseDto {
  @ApiProperty({ type: [OfferingRequirementResponseDto] }) items!: OfferingRequirementResponseDto[];
}
export class DocumentAuditResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) applicantDocumentId!: string;
  @ApiProperty() action!: string;
  @ApiPropertyOptional({ nullable: true }) fromStatus!: string | null;
  @ApiProperty() toStatus!: string;
  @ApiPropertyOptional({ nullable: true }) reason!: string | null;
  @ApiProperty({ format: 'uuid' }) actedBy!: string;
  @ApiProperty() actedAt!: Date;
}
export class ApplicantRequirementResponseDto {
  @ApiProperty({ format: 'uuid' }) applicantId!: string;
  @ApiProperty({ format: 'uuid' }) programmeOfferingId!: string;
  @ApiProperty({ format: 'uuid' }) offeringRequiredDocumentId!: string;
  @ApiProperty({ type: [String], format: 'uuid', description: 'Equivalent requirement IDs covered by one upload item' }) offeringRequiredDocumentIds!: string[];
  @ApiProperty({ type: [String], format: 'uuid' }) programmeOfferingIds!: string[];
  @ApiProperty({ format: 'uuid' }) documentTypeId!: string;
  @ApiProperty() documentTypeCode!: string;
  @ApiProperty() documentTypeName!: string;
  @ApiProperty() mandatory!: boolean;
  @ApiPropertyOptional({ nullable: true }) conditionCode!: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ type: AdmissionDocumentDto, nullable: true }) document!: AdmissionDocumentDto | null;
  @ApiProperty({ type: [ApplicantRequirementStatusDto], description: 'Status remains tracked independently for each offering requirement' }) requirementStatuses!: ApplicantRequirementStatusDto[];
}
export class DocumentCompletenessDto {
  @ApiProperty() applicantId!: string;
  @ApiProperty() complete!: boolean;
  @ApiProperty() requiredCount!: number;
  @ApiProperty() verifiedCount!: number;
  @ApiProperty({ type: [ApplicantRequirementResponseDto] }) requirements!: ApplicantRequirementResponseDto[];
}
