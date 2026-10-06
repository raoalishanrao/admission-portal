import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto.js';
import { CriteriaOperator } from '../../../common/enums/criteria-operator.enum.js';
import { AcademicDegreeType } from '../../../common/enums/application-completion.enum.js';
import { AtLeastOneOfConstraint } from '../../../common/validators/intake.validators.js';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toIdString = ({ value }: { value: unknown }) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'string') return value.trim();
  return value;
};

const toNumberOrNull = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
};

export class CreateGeneralCriterionDto {
  @ApiProperty({
    description: 'Controlled criteria type UUID (from criteria_types catalogue)',
    example: '22222222-2222-4222-8222-222222222002',
  })
  @Transform(toIdString)
  @IsUUID(undefined, { message: 'criteriaTypeId must be a valid UUID' })
  criteriaTypeId!: string;

  @ApiPropertyOptional({
    description: 'Optional human-readable label',
    example: 'Minimum Percentage',
    maxLength: 150,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  criteriaName?: string | null;

  @ApiProperty({
    description: 'Applicant-facing requirement/value',
    example: 'Minimum 65% marks in FSC',
    minLength: 2,
    maxLength: 2000,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'criteriaRequirement is required' })
  @MinLength(2)
  @MaxLength(2000)
  criteriaRequirement!: string;

  @ApiPropertyOptional({
    enum: CriteriaOperator,
    example: CriteriaOperator.GREATER_THAN_OR_EQUAL,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(CriteriaOperator, {
    message: `criteriaOperator must be one of: ${Object.values(CriteriaOperator).join(', ')}`,
  })
  criteriaOperator?: CriteriaOperator | null;

  @ApiPropertyOptional({
    example: 'PERCENTAGE',
    maxLength: 30,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  criteriaUnit?: string | null;

  @ApiPropertyOptional({
    description:
      'Numeric threshold for eligibility evaluation (e.g. 65 for MIN_PERCENTAGE). Null = display-only.',
    example: 65,
    nullable: true,
  })
  @IsOptional()
  @Transform(toNumberOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  criteriaValue?: number | null;

  @ApiPropertyOptional({
    description: 'Upper bound when criteriaOperator is BETWEEN',
    example: 80,
    nullable: true,
  })
  @IsOptional()
  @Transform(toNumberOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  criteriaValueMax?: number | null;

  @ApiPropertyOptional({
    description:
      'Academic degree_type this rule applies to. Null = use highest overall percentage.',
    enum: AcademicDegreeType,
    example: AcademicDegreeType.FSC,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(AcademicDegreeType)
  appliesToDegreeType?: AcademicDegreeType | null;

  @ApiPropertyOptional({
    description: 'Whether criterion is mandatory (default true)',
    example: true,
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mandatory?: boolean;
}

export class UpdateGeneralCriterionDto {
  @ApiPropertyOptional({
    example: 'Minimum Percentage',
    maxLength: 150,
    nullable: true,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  criteriaName?: string | null;

  @ApiPropertyOptional({
    example: 'Minimum 65% marks in FSC',
    minLength: 2,
    maxLength: 2000,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'criteriaRequirement must not be empty' })
  @MinLength(2)
  @MaxLength(2000)
  criteriaRequirement?: string;

  @ApiPropertyOptional({
    enum: CriteriaOperator,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(CriteriaOperator, {
    message: `criteriaOperator must be one of: ${Object.values(CriteriaOperator).join(', ')}`,
  })
  criteriaOperator?: CriteriaOperator | null;

  @ApiPropertyOptional({ example: 'PERCENTAGE', maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  criteriaUnit?: string | null;

  @ApiPropertyOptional({
    description: 'Numeric threshold for eligibility evaluation',
    example: 65,
    nullable: true,
  })
  @IsOptional()
  @Transform(toNumberOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  criteriaValue?: number | null;

  @ApiPropertyOptional({
    description: 'Upper bound when criteriaOperator is BETWEEN',
    example: 80,
    nullable: true,
  })
  @IsOptional()
  @Transform(toNumberOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  criteriaValueMax?: number | null;

  @ApiPropertyOptional({
    description: 'Academic degree_type this rule applies to',
    enum: AcademicDegreeType,
    example: AcademicDegreeType.FSC,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(AcademicDegreeType)
  appliesToDegreeType?: AcademicDegreeType | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mandatory?: boolean;

  @ApiHideProperty()
  @Allow()
  @Validate(
    AtLeastOneOfConstraint,
    [
      'criteriaName',
      'criteriaRequirement',
      'criteriaOperator',
      'criteriaUnit',
      'criteriaValue',
      'criteriaValueMax',
      'appliesToDegreeType',
      'mandatory',
    ],
    {
      message:
        'At least one of criteriaName, criteriaRequirement, criteriaOperator, criteriaUnit, criteriaValue, criteriaValueMax, appliesToDegreeType, or mandatory is required',
    },
  )
  private readonly _atLeastOne = true;
}

export class ListGeneralCriteriaQueryDto {
  @ApiPropertyOptional({
    type: Number,
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    description: 'Filter by criteria type UUID',
    example: '22222222-2222-4222-8222-222222222002',
  })
  @IsOptional()
  @Transform(toIdString)
  @IsUUID(undefined, { message: 'criteriaTypeId must be a valid UUID' })
  criteriaTypeId?: string;
}

export class GeneralCriterionResponseDto {
  @ApiProperty({ example: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1' })
  id!: string;

  @ApiProperty({ example: '90000000-0000-4000-8000-000000009001' })
  tenantId!: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222002' })
  criteriaTypeId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Minimum Percentage' })
  criteriaName!: string | null;

  @ApiProperty({ example: 'Minimum 65% marks in FSC' })
  criteriaRequirement!: string;

  @ApiPropertyOptional({ enum: CriteriaOperator, nullable: true })
  criteriaOperator!: CriteriaOperator | null;

  @ApiPropertyOptional({ nullable: true, example: 'PERCENTAGE' })
  criteriaUnit!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 65 })
  criteriaValue!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 80 })
  criteriaValueMax!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'FSC', enum: AcademicDegreeType })
  appliesToDegreeType!: AcademicDegreeType | null;

  @ApiProperty({ example: true })
  mandatory!: boolean;
}

export class GeneralCriterionListResponseDto {
  @ApiProperty({ type: [GeneralCriterionResponseDto] })
  items!: GeneralCriterionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
