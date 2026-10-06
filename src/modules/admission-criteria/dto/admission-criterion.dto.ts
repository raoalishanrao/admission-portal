import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CriteriaOperator } from '../../../common/enums/criteria-operator.enum.js';
import { AcademicDegreeType } from '../../../common/enums/application-completion.enum.js';
import {
  AtLeastOneOfConstraint,
  IsAfterDate,
} from '../../../common/validators/intake.validators.js';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toIdString = ({ value }: { value: unknown }) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'string') return value.trim();
  return value;
};

const toDateOrNull = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }
  return value;
};

@ValidatorConstraint({ name: 'createAdmissionCriterionItemSource', async: false })
class CreateAdmissionCriterionItemSourceConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateAdmissionCriterionItemDto;
    if (o.generalCriteriaId) return true;
    return (
      typeof o.criteriaTypeId === 'string' &&
      o.criteriaTypeId.length > 0 &&
      typeof o.criteriaRequirement === 'string' &&
      o.criteriaRequirement.trim().length >= 2
    );
  }

  defaultMessage(): string {
    return 'Provide either generalCriteriaId, or criteriaTypeId + criteriaRequirement';
  }
}

/** One criterion definition to attach to every offering in `offeringIds`. */
export class CreateAdmissionCriterionItemDto {
  @ApiPropertyOptional({
    description:
      'Option A: existing general criteria UUID to attach. Mutually exclusive with inline criteria fields.',
    example: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'generalCriteriaId must be a valid UUID' })
  generalCriteriaId?: string;

  @ApiPropertyOptional({
    description:
      'Option B: criteria type UUID. Required with criteriaRequirement when generalCriteriaId is not set.',
    example: '22222222-2222-4222-8222-222222222002',
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @Transform(toIdString)
  @IsUUID(undefined, { message: 'criteriaTypeId must be a valid UUID' })
  criteriaTypeId?: string;

  @ApiPropertyOptional({
    description: 'Option B: optional human-readable label',
    example: 'Minimum Percentage',
    maxLength: 150,
    nullable: true,
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  criteriaName?: string | null;

  @ApiPropertyOptional({
    description:
      'Option B: applicant-facing requirement/value. Required when generalCriteriaId is not set.',
    example: 'Minimum 50% overall marks',
    minLength: 2,
    maxLength: 2000,
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({
    message: 'criteriaRequirement is required when generalCriteriaId is not provided',
  })
  @MinLength(2)
  @MaxLength(2000)
  criteriaRequirement?: string;

  @ApiPropertyOptional({
    enum: CriteriaOperator,
    example: CriteriaOperator.GREATER_THAN_OR_EQUAL,
    nullable: true,
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
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
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  criteriaUnit?: string | null;

  @ApiPropertyOptional({
    description:
      'Option B: numeric threshold for eligibility (e.g. 65). Null = display-only.',
    example: 65,
    nullable: true,
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    return value;
  })
  @ValidateIf(
    (o: CreateAdmissionCriterionItemDto, v) =>
      !o.generalCriteriaId && v !== null && v !== undefined,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  criteriaValue?: number | null;

  @ApiPropertyOptional({
    description: 'Option B: upper bound when criteriaOperator is BETWEEN',
    example: 80,
    nullable: true,
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    return value;
  })
  @ValidateIf(
    (o: CreateAdmissionCriterionItemDto, v) =>
      !o.generalCriteriaId && v !== null && v !== undefined,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  criteriaValueMax?: number | null;

  @ApiPropertyOptional({
    description: 'Option B: academic degree_type this rule applies to',
    enum: AcademicDegreeType,
    example: AcademicDegreeType.FSC,
    nullable: true,
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @IsOptional()
  @IsEnum(AcademicDegreeType)
  appliesToDegreeType?: AcademicDegreeType | null;

  @ApiPropertyOptional({
    description: 'Option B: whether criterion is mandatory (default true)',
    example: true,
    default: true,
  })
  @ValidateIf((o: CreateAdmissionCriterionItemDto) => !o.generalCriteriaId)
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({
    description: 'Display/sequence order',
    example: 1,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequenceNo?: number | null;

  @ApiPropertyOptional({
    description: 'Effective from (ISO-8601)',
    example: '2026-07-01T00:00:00.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Transform(toDateOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDate({ message: 'effectiveFrom must be a valid ISO-8601 datetime' })
  effectiveFrom?: Date | null;

  @ApiPropertyOptional({
    description:
      'Effective to (ISO-8601); must be after effectiveFrom when both set',
    example: '2026-09-15T23:59:59.000Z',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Transform(toDateOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDate({ message: 'effectiveTo must be a valid ISO-8601 datetime' })
  @ValidateIf((o) => o.effectiveFrom != null && o.effectiveTo != null)
  @IsAfterDate('effectiveFrom', {
    message: 'effectiveTo must be after effectiveFrom',
  })
  effectiveTo?: Date | null;

  @ApiHideProperty()
  @Allow()
  @Validate(CreateAdmissionCriterionItemSourceConstraint, [], {
    message:
      'Provide either generalCriteriaId, or criteriaTypeId + criteriaRequirement',
  })
  private readonly _source = true;
}

export class CreateAdmissionCriterionDto {
  @ApiProperty({
    description: 'One or more editable offering UUIDs to attach each criterion to',
    type: [String],
    example: [
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    ],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'offeringIds must contain at least one UUID' })
  @ArrayUnique({ message: 'offeringIds must be unique' })
  @IsUUID(undefined, {
    each: true,
    message: 'each offeringId must be a valid UUID',
  })
  offeringIds!: string[];

  @ApiProperty({
    description: 'One or more criteria to attach to every offering in offeringIds',
    type: [CreateAdmissionCriterionItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'criteria must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateAdmissionCriterionItemDto)
  criteria!: CreateAdmissionCriterionItemDto[];
}

export class UpdateAdmissionCriterionDto {
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
    example: 'Minimum 60% overall marks',
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
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    return value;
  })
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
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    return value;
  })
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

  @ApiPropertyOptional({ example: 2, minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sequenceNo?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Transform(toDateOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDate({ message: 'effectiveFrom must be a valid ISO-8601 datetime' })
  effectiveFrom?: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @Transform(toDateOrNull)
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDate({ message: 'effectiveTo must be a valid ISO-8601 datetime' })
  @ValidateIf((o) => o.effectiveFrom != null && o.effectiveTo != null)
  @IsAfterDate('effectiveFrom', {
    message: 'effectiveTo must be after effectiveFrom',
  })
  effectiveTo?: Date | null;

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
      'sequenceNo',
      'effectiveFrom',
      'effectiveTo',
    ],
    {
      message:
        'At least one updatable field is required (criteriaName, criteriaRequirement, criteriaOperator, criteriaUnit, criteriaValue, criteriaValueMax, appliesToDegreeType, mandatory, sequenceNo, effectiveFrom, effectiveTo)',
    },
  )
  private readonly _atLeastOne = true;
}

export class AdmissionCriterionResponseDto {
  @ApiProperty({
    example: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    description: 'Admission criterion ID',
  })
  id!: string;

  @ApiProperty({ example: '90000000-0000-4000-8000-000000009001' })
  tenantId!: string;

  @ApiProperty({ example: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' })
  programmeOfferingId!: string;

  @ApiProperty({ example: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1' })
  generalCriteriaId!: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222001' })
  criteriaTypeId!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Minimum Percentage' })
  criteriaName!: string | null;

  @ApiProperty({ example: 'Minimum 50% overall marks' })
  criteriaRequirement!: string;

  @ApiPropertyOptional({ enum: CriteriaOperator, nullable: true })
  criteriaOperator!: CriteriaOperator | null;

  @ApiPropertyOptional({ nullable: true, example: 'PERCENTAGE' })
  criteriaUnit!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 65 })
  criteriaValue!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 80 })
  criteriaValueMax!: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: AcademicDegreeType.FSC,
    enum: AcademicDegreeType,
  })
  appliesToDegreeType!: AcademicDegreeType | null;

  @ApiProperty({ example: true })
  mandatory!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  sequenceNo!: number | null;

  @ApiPropertyOptional({ nullable: true })
  effectiveFrom!: string | null;

  @ApiPropertyOptional({ nullable: true })
  effectiveTo!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  createdBy!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  updatedBy!: string;
}

export class AdmissionCriterionBatchResponseDto {
  @ApiProperty({ type: [AdmissionCriterionResponseDto] })
  items!: AdmissionCriterionResponseDto[];
}
