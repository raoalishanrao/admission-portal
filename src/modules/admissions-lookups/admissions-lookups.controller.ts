import { Controller, Get } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiStandardErrorResponses,
  ApiTenantHeaders,
  ApiWrappedOkArrayResponse,
} from '../../common/decorators/api-docs.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import {
  AcademicDegreeTypeListResponseDto,
  DegreeLevelListResponseDto,
  LookupOptionDto,
} from '../../common/lookups/admissions-lookup.dto.js';
import {
  ACADEMIC_DEGREE_TYPE_OPTIONS,
  DEGREE_LEVEL_OPTIONS,
  lookupListResponse,
} from '../../common/lookups/admissions-lookups.js';

@ApiTags('Admissions Lookups')
@ApiExtraModels(
  LookupOptionDto,
  DegreeLevelListResponseDto,
  AcademicDegreeTypeListResponseDto,
  ApiErrorResponseDto,
)
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@Controller('admissions')
export class AdmissionsLookupsController {
  @Get('degree-levels')
  @ApiOperation({
    summary: 'List programme degree levels',
    description:
      'Canonical values for programmes, merit formulas, and academic-level requirements. ' +
      'Use `code` everywhere (Bachelor | Master | Doctorate). Same contract as applicant admissions.',
  })
  @ApiWrappedOkArrayResponse(LookupOptionDto, 'Degree levels')
  listDegreeLevels(): DegreeLevelListResponseDto {
    return lookupListResponse(DEGREE_LEVEL_OPTIONS);
  }

  @Get('academic-degree-types')
  @ApiOperation({
    summary: 'List academic degree type codes',
    description:
      'Codes for applicant academic history rows and academic-level requirement rules ' +
      '(MATRIC | FSC | BACHELOR | MASTER | DOCTORATE). Not the same as programme degreeLevel.',
  })
  @ApiWrappedOkArrayResponse(LookupOptionDto, 'Academic degree types')
  listAcademicDegreeTypes(): AcademicDegreeTypeListResponseDto {
    return lookupListResponse(ACADEMIC_DEGREE_TYPE_OPTIONS);
  }
}
