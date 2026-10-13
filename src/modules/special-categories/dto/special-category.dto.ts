import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto.js';
import {
  SpecialCategoryClaimStatus,
  SpecialCategoryCode,
  SpecialCategoryStatus,
} from '../../../common/enums/special-category.enum.js';

export class CreateSpecialCategoryDto {
  @ApiProperty({ enum: SpecialCategoryCode, example: SpecialCategoryCode.HAFIZ_E_QURAN })
  @IsEnum(SpecialCategoryCode)
  code!: SpecialCategoryCode;

  @ApiProperty({ example: 'Hafiz-e-Quran' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ example: 5, description: 'Extra marks added to merit score' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  bonusMarks!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresEvidence?: boolean;

  @ApiPropertyOptional({ enum: SpecialCategoryStatus, default: SpecialCategoryStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SpecialCategoryStatus)
  status?: SpecialCategoryStatus;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSpecialCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  bonusMarks?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresEvidence?: boolean;

  @ApiPropertyOptional({ enum: SpecialCategoryStatus })
  @IsOptional()
  @IsEnum(SpecialCategoryStatus)
  status?: SpecialCategoryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ListSpecialCategoriesQueryDto {
  @ApiPropertyOptional({ enum: SpecialCategoryStatus })
  @IsOptional()
  @IsEnum(SpecialCategoryStatus)
  status?: SpecialCategoryStatus;

  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 50;
}

export class SpecialCategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({ enum: SpecialCategoryCode }) code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() bonusMarks!: number;
  @ApiProperty() stackable!: boolean;
  @ApiProperty() requiresEvidence!: boolean;
  @ApiProperty({ enum: SpecialCategoryStatus }) status!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class SpecialCategoryListResponseDto {
  @ApiProperty({ type: [SpecialCategoryResponseDto] })
  items!: SpecialCategoryResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class SaveSpecialCategoryClaimsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Active special category IDs the applicant claims',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  specialCategoryIds!: string[];
}

export class SetOfferingSpecialCategoriesDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'Special category IDs enabled for this programme offering. Empty clears all.',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  specialCategoryIds!: string[];
}

export class OfferingSpecialCategoriesResponseDto {
  @ApiProperty()
  programmeOfferingId!: string;

  @ApiProperty({ type: [SpecialCategoryResponseDto] })
  items!: SpecialCategoryResponseDto[];
}

export class SpecialCategoryClaimResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() applicantId!: string;
  @ApiProperty() specialCategoryId!: string;
  @ApiProperty() categoryCode!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty() bonusMarks!: number;
  @ApiProperty() requiresEvidence!: boolean;
  @ApiProperty({ enum: SpecialCategoryClaimStatus }) status!: string;
  @ApiPropertyOptional({ nullable: true }) rejectionReason!: string | null;
  @ApiPropertyOptional({ nullable: true }) reviewedAt!: string | null;
}

export class ApplicantSpecialCategoriesResponseDto {
  @ApiProperty({ type: [SpecialCategoryResponseDto] })
  available!: SpecialCategoryResponseDto[];

  @ApiProperty({ type: [SpecialCategoryClaimResponseDto] })
  claims!: SpecialCategoryClaimResponseDto[];

  @ApiProperty({ description: 'Sum of bonus marks from CLAIMED/VERIFIED claims' })
  totalBonusMarks!: number;
}

export class ReviewSpecialCategoryClaimDto {
  @ApiProperty({ enum: [SpecialCategoryClaimStatus.VERIFIED, SpecialCategoryClaimStatus.REJECTED] })
  @IsEnum(SpecialCategoryClaimStatus)
  status!: SpecialCategoryClaimStatus.VERIFIED | SpecialCategoryClaimStatus.REJECTED;

  @ApiPropertyOptional({ description: 'Required when rejecting' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;
}
