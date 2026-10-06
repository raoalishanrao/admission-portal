import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto.js';
import { DegreeLevel } from '../../../common/enums/master-data.enum.js';
import {
  MeritFormulaStatus,
  MeritScoreSourceType,
} from '../../../common/enums/merit-formula.enum.js';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class MeritFormulaComponentInputDto {
  @ApiProperty({ enum: MeritScoreSourceType, example: MeritScoreSourceType.FSC })
  @IsEnum(MeritScoreSourceType)
  sourceType!: MeritScoreSourceType;

  @ApiProperty({ example: 45, minimum: 0.01, maximum: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  weight!: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number | null;
}

export class CreateMeritFormulaTemplateDto {
  @ApiProperty({ enum: DegreeLevel, example: DegreeLevel.Bachelor })
  @IsEnum(DegreeLevel)
  degreeLevel!: DegreeLevel;

  @ApiProperty({ example: 'Undergraduate standard', maxLength: 150 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Mark as the default template for this degree level',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    type: [MeritFormulaComponentInputDto],
    description: 'Component weights must sum to 100',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MeritFormulaComponentInputDto)
  components!: MeritFormulaComponentInputDto[];
}

export class UpdateMeritFormulaTemplateDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ enum: MeritFormulaStatus })
  @IsOptional()
  @IsEnum(MeritFormulaStatus)
  status?: MeritFormulaStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    type: [MeritFormulaComponentInputDto],
    description: 'When provided, replaces all components; weights must sum to 100',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MeritFormulaComponentInputDto)
  components?: MeritFormulaComponentInputDto[];
}

export class ListMeritFormulaTemplatesQueryDto {
  @ApiPropertyOptional({ enum: DegreeLevel })
  @IsOptional()
  @IsEnum(DegreeLevel)
  degreeLevel?: DegreeLevel;

  @ApiPropertyOptional({ enum: MeritFormulaStatus })
  @IsOptional()
  @IsEnum(MeritFormulaStatus)
  status?: MeritFormulaStatus;

  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 50, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class MeritFormulaComponentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: MeritScoreSourceType })
  sourceType!: MeritScoreSourceType;

  @ApiProperty({ example: 45 })
  weight!: number;

  @ApiPropertyOptional({ nullable: true })
  sortOrder!: number | null;
}

export class MeritFormulaTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ enum: DegreeLevel })
  degreeLevel!: DegreeLevel;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: MeritFormulaStatus })
  status!: MeritFormulaStatus;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty({ type: [MeritFormulaComponentResponseDto] })
  components!: MeritFormulaComponentResponseDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class MeritFormulaTemplateListResponseDto {
  @ApiProperty({ type: [MeritFormulaTemplateResponseDto] })
  items!: MeritFormulaTemplateResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class UpsertOfferingMeritFormulaDto {
  @ApiPropertyOptional({
    description:
      'Clone components from this template. Ignored when components[] is provided.',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(150)
  name?: string | null;

  @ApiPropertyOptional({
    type: [MeritFormulaComponentInputDto],
    description:
      'Custom weights for this offering (must sum to 100). If omitted, components are copied from templateId or the default template for the offering programme degree level.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MeritFormulaComponentInputDto)
  components?: MeritFormulaComponentInputDto[];
}

export class OfferingMeritFormulaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  programmeOfferingId!: string;

  @ApiPropertyOptional({ nullable: true })
  templateId!: string | null;

  @ApiProperty({ enum: DegreeLevel })
  degreeLevel!: DegreeLevel;

  @ApiPropertyOptional({ nullable: true })
  name!: string | null;

  @ApiProperty({ type: [MeritFormulaComponentResponseDto] })
  components!: MeritFormulaComponentResponseDto[];

  @ApiProperty({
    description: 'true when returned from a degree-level default template (no offering override)',
  })
  resolvedFromTemplate!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
