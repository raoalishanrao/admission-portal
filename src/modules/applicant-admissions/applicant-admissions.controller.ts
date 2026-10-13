import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardErrorResponses,
  ApiTenantHeaders,
  ApiWrappedCreatedResponse,
  ApiWrappedOkArrayResponse,
  ApiWrappedOkResponse,
} from '../../common/decorators/api-docs.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  ReqContext,
  resolveDefaultTenantId,
  type RequestContext,
} from '../../common/decorators/request-context.decorator.js';
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
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { ApplicantAdmissionsService } from './applicant-admissions.service.js';
import {
  ApplicantCriterionDto,
  ApplicantDeclarationDto,
  ApplicantFeeDto,
  ApplicantIntakeDto,
  ApplicantIntakeListDto,
  ApplicantListQueryDto,
  ApplicantOfferingDto,
  ApplicantOfferingListDto,
  StartApplicationResponseDto,
} from './dto/applicant-admissions.dto.js';

@ApiTags('Applicant Admissions')
@ApiExtraModels(
  ApplicantIntakeDto,
  ApplicantIntakeListDto,
  ApplicantOfferingDto,
  ApplicantOfferingListDto,
  ApplicantCriterionDto,
  ApplicantFeeDto,
  ApplicantDeclarationDto,
  StartApplicationResponseDto,
  LookupOptionDto,
  DegreeLevelListResponseDto,
  AcademicDegreeTypeListResponseDto,
  ApiErrorResponseDto,
)
@ApiStandardErrorResponses()
@Controller('applicant/admissions')
export class ApplicantAdmissionsController {
  constructor(
    private readonly applicantAdmissionsService: ApplicantAdmissionsService,
  ) {}

  private publicContext(): RequestContext {
    return {
      tenantId: resolveDefaultTenantId(),
      userId: '00000000-0000-4000-8000-000000000000',
    };
  }

  @Public()
  @Get('degree-levels')
  @ApiOperation({
    summary: 'List programme degree levels',
    description:
      'Same canonical values as admin GET /admissions/degree-levels. ' +
      'Use `code` (Bachelor | Master | Doctorate) when filtering/displaying programmes.',
  })
  @ApiWrappedOkArrayResponse(LookupOptionDto, 'Degree levels')
  listDegreeLevels(): DegreeLevelListResponseDto {
    return lookupListResponse(DEGREE_LEVEL_OPTIONS);
  }

  @Public()
  @Get('academic-degree-types')
  @ApiOperation({
    summary: 'List academic degree type codes',
    description:
      'Same values as admin GET /admissions/academic-degree-types. ' +
      'Use for academic history forms (MATRIC | FSC | BACHELOR | MASTER | DOCTORATE).',
  })
  @ApiWrappedOkArrayResponse(LookupOptionDto, 'Academic degree types')
  listAcademicDegreeTypes(): AcademicDegreeTypeListResponseDto {
    return lookupListResponse(ACADEMIC_DEGREE_TYPE_OPTIONS);
  }

  @Public()
  @Get('intakes')
  @ApiOperation({
    summary: 'List visible published intakes',
    description:
      'Returns PUBLISHED intakes for DEFAULT_TENANT_ID that are still valid.',
  })
  @ApiWrappedOkArrayResponse(ApplicantIntakeDto, 'Published intakes')
  listIntakes(
    @Query() query: ApplicantListQueryDto,
  ): Promise<ApplicantIntakeListDto> {
    return this.applicantAdmissionsService.listIntakes(
      this.publicContext(),
      query,
    );
  }

  @Public()
  @Get('intakes/:intakeId')
  @ApiOperation({ summary: 'Get published intake details' })
  @ApiParam({ name: 'intakeId', description: 'Intake UUID' })
  @ApiWrappedOkResponse(ApplicantIntakeDto, 'Published intake')
  getIntake(
    @Param('intakeId', new ParseUuidPipe('intakeId')) intakeId: string,
  ): Promise<ApplicantIntakeDto> {
    return this.applicantAdmissionsService.getIntake(
      this.publicContext(),
      intakeId,
    );
  }

  @Public()
  @Get('intakes/:intakeId/programmes')
  @ApiOperation({ summary: 'List available programme offerings' })
  @ApiParam({ name: 'intakeId', description: 'Intake UUID' })
  @ApiWrappedOkArrayResponse(ApplicantOfferingDto, 'Programme offerings')
  listProgrammes(
    @Param('intakeId', new ParseUuidPipe('intakeId')) intakeId: string,
    @Query() query: ApplicantListQueryDto,
  ): Promise<ApplicantOfferingListDto> {
    return this.applicantAdmissionsService.listProgrammes(
      this.publicContext(),
      intakeId,
      query,
    );
  }

  @Public()
  @Get('offerings/:offeringId')
  @ApiOperation({ summary: 'Get programme/offering details' })
  @ApiParam({ name: 'offeringId', description: 'Offering UUID' })
  @ApiWrappedOkResponse(ApplicantOfferingDto, 'Offering details')
  getOffering(
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
  ): Promise<ApplicantOfferingDto> {
    return this.applicantAdmissionsService.getOffering(
      this.publicContext(),
      offeringId,
    );
  }

  @Public()
  @Get('offerings/:offeringId/criteria')
  @ApiOperation({ summary: 'Get applicant-facing criteria' })
  @ApiParam({ name: 'offeringId', description: 'Offering UUID' })
  @ApiWrappedOkArrayResponse(ApplicantCriterionDto, 'Criteria')
  getCriteria(
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
  ): Promise<ApplicantCriterionDto[]> {
    return this.applicantAdmissionsService.getCriteria(
      this.publicContext(),
      offeringId,
    );
  }

  @Public()
  @Get('offerings/:offeringId/fees')
  @ApiOperation({ summary: 'Get applicable fee information' })
  @ApiParam({ name: 'offeringId', description: 'Offering UUID' })
  @ApiWrappedOkArrayResponse(ApplicantFeeDto, 'Fees')
  getFees(
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
  ): Promise<ApplicantFeeDto[]> {
    return this.applicantAdmissionsService.getFees(
      this.publicContext(),
      offeringId,
    );
  }

  @Public()
  @Get('offerings/:offeringId/declarations')
  @ApiOperation({
    summary: 'Get offering declaration / terms texts',
    description:
      'Public browse of ACTIVE, currently effective offering declarations for display before registration. ' +
      'Acceptance still happens later via authenticated applicants/applications/.../declaration.',
  })
  @ApiParam({ name: 'offeringId', description: 'Offering UUID' })
  @ApiWrappedOkArrayResponse(ApplicantDeclarationDto, 'Declarations')
  getDeclarations(
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
  ): Promise<ApplicantDeclarationDto[]> {
    return this.applicantAdmissionsService.getDeclarations(
      this.publicContext(),
      offeringId,
    );
  }

  @Post('offerings/:offeringId/start-application')
  @HttpCode(HttpStatus.CREATED)
  @ApiTenantHeaders()
  @ApiOperation({
    summary: 'Start/handoff to ADM-F001',
    description:
      'Requires Bearer JWT. Uses DEFAULT_TENANT_ID and JWT user id for the ADM-F001 handoff.',
  })
  @ApiParam({ name: 'offeringId', description: 'Offering UUID' })
  @ApiWrappedCreatedResponse(StartApplicationResponseDto, 'Application handoff')
  startApplication(
    @ReqContext() ctx: RequestContext,
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
  ): Promise<StartApplicationResponseDto> {
    return this.applicantAdmissionsService.startApplication(ctx, offeringId);
  }
}
