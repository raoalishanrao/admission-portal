import { ApiProperty, ApiPropertyOptional, ApiHideProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
} from 'class-validator';
import { AtLeastOneOfConstraint } from '../../../common/validators/intake.validators.js';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto.js';
import { OfferingStatus } from '../../../common/enums/offering-status.enum.js';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const toIdString = ({ value }: { value: unknown }) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'string') return value.trim();
  return value;
};

export class CreateOfferingDto {
  @ApiProperty({
    description: 'Programme UUID to associate with the intake',
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  })
  @Transform(toIdString)
  @IsUUID(undefined, { message: 'programmeId must be a valid UUID' })
  programmeId!: string;

  @ApiPropertyOptional({ description: 'Maximum admission seats for this offering; required before merit allocation', minimum: 1, example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  seatCapacity?: number | null;

  @ApiProperty({
    description: 'Applicant-facing offering description',
    example: 'BS Computer Science â€” Fall 2026 admission offering.',
    minLength: 10,
    maxLength: 5000,
  })
  @Transform(trimString)
  @IsString({ message: 'publishedDescription must be a string' })
  @IsNotEmpty({ message: 'publishedDescription is required' })
  @MinLength(10, {
    message: 'publishedDescription must be at least 10 characters',
  })
  @MaxLength(5000, {
    message: 'publishedDescription must be at most 5000 characters',
  })
  publishedDescription!: string;

  @ApiPropertyOptional({
    description: 'Applicant-facing display order',
    example: 1,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'displayOrder must be an integer' })
  @Min(0, { message: 'displayOrder must be at least 0' })
  displayOrder?: number | null;
}

export class UpdateOfferingDto {
  @ApiPropertyOptional({ description: 'Maximum admission seats for this offering; set before merit allocation', minimum: 1, example: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  seatCapacity?: number | null;
  @ApiPropertyOptional({
    description: 'Applicant-facing offering description',
    example: 'Updated offering description for applicants.',
    minLength: 10,
    maxLength: 5000,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'publishedDescription must be a string' })
  @IsNotEmpty({ message: 'publishedDescription must not be empty' })
  @MinLength(10, {
    message: 'publishedDescription must be at least 10 characters',
  })
  @MaxLength(5000, {
    message: 'publishedDescription must be at most 5000 characters',
  })
  publishedDescription?: string;

  @ApiPropertyOptional({
    description: 'Applicant-facing display order',
    example: 2,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'displayOrder must be an integer' })
  @Min(0, { message: 'displayOrder must be at least 0' })
  displayOrder?: number | null;

  @ApiHideProperty()
  @Allow()
  @Validate(AtLeastOneOfConstraint, ['publishedDescription', 'displayOrder', 'seatCapacity'], {
    message: 'At least one offering field is required',
  })
  private readonly _atLeastOne = true;
}

export class ListOfferingsQueryDto {
  @ApiPropertyOptional({
    type: Number,
    example: 1,
    minimum: 1,
    default: 1,
    description: 'Page number (1-based)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must be at most 100' })
  limit = 20;
}

export class OfferingResponseDto {
  @ApiProperty({ example: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' })
  id!: string;

  @ApiProperty({ example: '90000000-0000-4000-8000-000000009001' })
  tenantId!: string;

  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  intakeId!: string;

  @ApiProperty({ example: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' })
  programmeId!: string;

  @ApiProperty({ enum: OfferingStatus, example: OfferingStatus.DRAFT })
  offeringStatus!: OfferingStatus;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  displayOrder!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 60, description: 'Published seat capacity used for merit allocation' })
  seatCapacity!: number | null;

  @ApiProperty({
    example: 'BS Computer Science â€” Fall 2026 admission offering.',
  })
  publishedDescription!: string;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  createdBy!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' })
  updatedBy!: string;
}

export class OfferingListResponseDto {
  @ApiProperty({ type: [OfferingResponseDto] })
  items!: OfferingResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
