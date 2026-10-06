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
  IsOptional,
  IsUUID,
  Min,
  Validate,
} from 'class-validator';
import { PaginationMetaDto } from '../../../common/dto/api-response.dto.js';
import { AcademicDegreeType } from '../../../common/enums/application-completion.enum.js';
import { DegreeLevel } from '../../../common/enums/master-data.enum.js';
import { AtLeastOneOfConstraint } from '../../../common/validators/intake.validators.js';

export class CreateAcademicLevelRequirementDto {
  @ApiProperty({ enum: DegreeLevel, example: DegreeLevel.Bachelor })
  @IsEnum(DegreeLevel)
  degreeLevel!: DegreeLevel;

  @ApiProperty({
    enum: AcademicDegreeType,
    example: AcademicDegreeType.MATRIC,
    description: 'Controlled academic code the applicant must provide',
  })
  @IsEnum(AcademicDegreeType)
  requiredAcademicCode!: AcademicDegreeType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mandatory?: boolean;

  @ApiPropertyOptional({ example: 1, minimum: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number | null;
}

export class UpdateAcademicLevelRequirementDto {
  @ApiPropertyOptional({ enum: DegreeLevel })
  @IsOptional()
  @IsEnum(DegreeLevel)
  degreeLevel?: DegreeLevel;

  @ApiPropertyOptional({ enum: AcademicDegreeType })
  @IsOptional()
  @IsEnum(AcademicDegreeType)
  requiredAcademicCode?: AcademicDegreeType;

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
  sortOrder?: number | null;

  @ApiHideProperty()
  @Allow()
  @Validate(
    AtLeastOneOfConstraint,
    ['degreeLevel', 'requiredAcademicCode', 'mandatory', 'sortOrder'],
    {
      message:
        'At least one of degreeLevel, requiredAcademicCode, mandatory, or sortOrder is required',
    },
  )
  private readonly _atLeastOne = true;
}

export class ListAcademicLevelRequirementsQueryDto {
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

  @ApiPropertyOptional({
    type: Number,
    example: 50,
    minimum: 1,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 50;
}

export class AcademicLevelRequirementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ enum: DegreeLevel })
  degreeLevel!: DegreeLevel;

  @ApiProperty({ enum: AcademicDegreeType })
  requiredAcademicCode!: AcademicDegreeType;

  @ApiProperty()
  mandatory!: boolean;

  @ApiPropertyOptional({ nullable: true })
  sortOrder!: number | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AcademicLevelRequirementListResponseDto {
  @ApiProperty({ type: [AcademicLevelRequirementResponseDto] })
  items!: AcademicLevelRequirementResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class ApplicantRequiredAcademicLevelDto {
  @ApiProperty({ enum: DegreeLevel })
  degreeLevel!: DegreeLevel;

  @ApiProperty({ enum: AcademicDegreeType, isArray: true })
  requiredAcademicCodes!: AcademicDegreeType[];

  @ApiProperty({
    description: 'Codes still missing from the applicant academic step',
    enum: AcademicDegreeType,
    isArray: true,
  })
  missingAcademicCodes!: AcademicDegreeType[];
}

export class ApplicantRequiredAcademicLevelsResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty({ type: [ApplicantRequiredAcademicLevelDto] })
  byDegreeLevel!: ApplicantRequiredAcademicLevelDto[];

  @ApiProperty({
    description: 'Union of mandatory codes across selected programmes',
    enum: AcademicDegreeType,
    isArray: true,
  })
  requiredAcademicCodes!: AcademicDegreeType[];

  @ApiProperty({
    enum: AcademicDegreeType,
    isArray: true,
  })
  missingAcademicCodes!: AcademicDegreeType[];

  @ApiProperty()
  complete!: boolean;
}
