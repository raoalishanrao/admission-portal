import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  MinLength,
  Validate,
} from 'class-validator';
import {
  AtLeastOneOfConstraint,
  IsAfterDate,
} from '../../../common/validators/intake.validators.js';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toDate = ({ value }: { value: unknown }) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  }
  return value;
};

const INTAKE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,99}$/;
const INTAKE_CODE_MESSAGE =
  'intakeCode must be 2–100 chars, start with alphanumeric, and contain only letters, numbers, ".", "_" or "-"';

export class CreateIntakeDto {
  @ApiPropertyOptional({ description: 'Days allowed after offer publication to accept and complete the required fee payment', minimum: 1, maximum: 30, default: 5, example: 5 })
  @IsOptional() @Transform(({ value }) => value == null ? value : Number(value)) @IsInt() @Min(1) @Max(30)
  offerPaymentPeriodDays?: number;

  @ApiPropertyOptional({
    description: 'MANUAL = staff generate merit; AUTO = generate after results publish',
    enum: ['MANUAL', 'AUTO'],
    default: 'MANUAL',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(MANUAL|AUTO)$/)
  meritGenerationMode?: 'MANUAL' | 'AUTO';

  @ApiPropertyOptional({
    description: 'Allowed % variance when verifying offer-fee payment amount',
    minimum: 0,
    maximum: 100,
    default: 0,
  })
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  feeConfirmMarginPercent?: number;

  @ApiPropertyOptional({
    description: 'Extra hours after acceptance deadline before unpaid offer expiry',
    minimum: 0,
    maximum: 168,
    default: 0,
  })
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : Number(value)))
  @IsInt()
  @Min(0)
  @Max(168)
  offerFeeGraceHours?: number;

  @ApiProperty({
    description: 'Human-readable intake name',
    example: 'Fall 2026 Admissions',
    minLength: 3,
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString({ message: 'intakeName must be a string' })
  @IsNotEmpty({ message: 'intakeName is required' })
  @MinLength(3, { message: 'intakeName must be at least 3 characters' })
  @MaxLength(255, { message: 'intakeName must be at most 255 characters' })
  intakeName!: string;

  @ApiProperty({
    description: 'Business/reference code (unique within tenant)',
    example: 'FALL-2026',
    minLength: 2,
    maxLength: 100,
    pattern: INTAKE_CODE_PATTERN.source,
  })
  @Transform(trimString)
  @IsString({ message: 'intakeCode must be a string' })
  @IsNotEmpty({ message: 'intakeCode is required' })
  @MinLength(2, { message: 'intakeCode must be at least 2 characters' })
  @MaxLength(100, { message: 'intakeCode must be at most 100 characters' })
  @Matches(INTAKE_CODE_PATTERN, { message: INTAKE_CODE_MESSAGE })
  intakeCode!: string;

  @ApiProperty({
    description: 'Application window opening datetime (ISO-8601)',
    example: '2026-07-01T00:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  @Transform(toDate)
  @IsDate({ message: 'applicationOpenAt must be a valid ISO-8601 datetime' })
  applicationOpenAt!: Date;

  @ApiProperty({
    description:
      'Application window closing datetime (ISO-8601); must be strictly after applicationOpenAt',
    example: '2026-09-15T23:59:59.000Z',
    type: String,
    format: 'date-time',
  })
  @Transform(toDate)
  @IsDate({ message: 'applicationCloseAt must be a valid ISO-8601 datetime' })
  @IsAfterDate('applicationOpenAt', {
    message: 'applicationCloseAt must be after applicationOpenAt',
  })
  applicationCloseAt!: Date;
}

export class UpdateIntakeDto {
  @ApiPropertyOptional({ description: 'Days allowed after offer publication to accept and complete the required fee payment', minimum: 1, maximum: 30, example: 5 })
  @IsOptional() @Transform(({ value }) => value == null ? value : Number(value)) @IsInt() @Min(1) @Max(30)
  offerPaymentPeriodDays?: number;

  @ApiPropertyOptional({
    description: 'MANUAL = staff generate merit; AUTO = generate after results publish',
    enum: ['MANUAL', 'AUTO'],
  })
  @IsOptional()
  @IsString()
  @Matches(/^(MANUAL|AUTO)$/)
  meritGenerationMode?: 'MANUAL' | 'AUTO';

  @ApiPropertyOptional({
    description: 'Allowed % variance when verifying offer-fee payment amount',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : Number(value)))
  @IsInt()
  @Min(0)
  @Max(100)
  feeConfirmMarginPercent?: number;

  @ApiPropertyOptional({
    description: 'Extra hours after acceptance deadline before unpaid offer expiry',
    minimum: 0,
    maximum: 168,
  })
  @IsOptional()
  @Transform(({ value }) => (value == null ? value : Number(value)))
  @IsInt()
  @Min(0)
  @Max(168)
  offerFeeGraceHours?: number;

  @ApiPropertyOptional({
    description: 'Human-readable intake name',
    example: 'Fall 2026 Admissions (Updated)',
    minLength: 3,
    maxLength: 255,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'intakeName must be a string' })
  @IsNotEmpty({ message: 'intakeName must not be empty' })
  @MinLength(3, { message: 'intakeName must be at least 3 characters' })
  @MaxLength(255, { message: 'intakeName must be at most 255 characters' })
  intakeName?: string;

  @ApiPropertyOptional({
    description: 'Business/reference code (unique within tenant)',
    example: 'FALL-2026-V2',
    minLength: 2,
    maxLength: 100,
    pattern: INTAKE_CODE_PATTERN.source,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'intakeCode must be a string' })
  @IsNotEmpty({ message: 'intakeCode must not be empty' })
  @MinLength(2, { message: 'intakeCode must be at least 2 characters' })
  @MaxLength(100, { message: 'intakeCode must be at most 100 characters' })
  @Matches(INTAKE_CODE_PATTERN, { message: INTAKE_CODE_MESSAGE })
  intakeCode?: string;

  @ApiHideProperty()
  @Allow()
  @Validate(AtLeastOneOfConstraint, [
    'intakeName',
    'intakeCode',
    'offerPaymentPeriodDays',
    'meritGenerationMode',
    'feeConfirmMarginPercent',
    'offerFeeGraceHours',
  ], {
    message: 'At least one intake field is required',
  })
  private readonly _atLeastOne = true;
}

export class ApplicationWindowDto {
  @ApiProperty({
    description: 'Application window opening datetime (ISO-8601)',
    example: '2026-07-01T00:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  @Transform(toDate)
  @IsDate({ message: 'applicationOpenAt must be a valid ISO-8601 datetime' })
  applicationOpenAt!: Date;

  @ApiProperty({
    description:
      'Application window closing datetime (ISO-8601); must be strictly after applicationOpenAt',
    example: '2026-09-15T23:59:59.000Z',
    type: String,
    format: 'date-time',
  })
  @Transform(toDate)
  @IsDate({ message: 'applicationCloseAt must be a valid ISO-8601 datetime' })
  @IsAfterDate('applicationOpenAt', {
    message: 'applicationCloseAt must be after applicationOpenAt',
  })
  applicationCloseAt!: Date;
}
