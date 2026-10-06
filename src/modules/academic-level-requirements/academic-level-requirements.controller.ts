import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import {
  ReqContext,
  type RequestContext,
} from '../../common/decorators/request-context.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { AcademicLevelRequirementsService } from './academic-level-requirements.service.js';
import {
  AcademicLevelRequirementListResponseDto,
  AcademicLevelRequirementResponseDto,
  CreateAcademicLevelRequirementDto,
  ListAcademicLevelRequirementsQueryDto,
  UpdateAcademicLevelRequirementDto,
} from './dto/academic-level-requirement.dto.js';

@ApiTags('Academic Level Requirements')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  AcademicLevelRequirementResponseDto,
  AcademicLevelRequirementListResponseDto,
  CreateAcademicLevelRequirementDto,
  UpdateAcademicLevelRequirementDto,
  ApiErrorResponseDto,
)
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@Controller('admissions/academic-level-requirements')
export class AcademicLevelRequirementsController {
  constructor(private readonly service: AcademicLevelRequirementsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an academic level requirement',
    description:
      'Configures which academic degree_type codes are required for a programme degree_level ' +
      '(e.g. Bachelor → MATRIC + FSC).',
  })
  @ApiWrappedCreatedResponse(
    AcademicLevelRequirementResponseDto,
    'Academic level requirement created',
  )
  create(
    @ReqContext() ctx: RequestContext,
    @Body() dto: CreateAcademicLevelRequirementDto,
  ): Promise<AcademicLevelRequirementResponseDto> {
    return this.service.create(ctx, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List academic level requirements',
    description:
      'Returns configurable required academic codes by programme degree level.',
  })
  @ApiWrappedOkArrayResponse(
    AcademicLevelRequirementResponseDto,
    'Academic level requirements',
  )
  list(
    @ReqContext() ctx: RequestContext,
    @Query() query: ListAcademicLevelRequirementsQueryDto,
  ): Promise<AcademicLevelRequirementListResponseDto> {
    return this.service.list(ctx, query);
  }

  @Get(':requirementId')
  @ApiOperation({ summary: 'Get academic level requirement by id' })
  @ApiParam({ name: 'requirementId', description: 'Requirement UUID' })
  @ApiWrappedOkResponse(
    AcademicLevelRequirementResponseDto,
    'Academic level requirement',
  )
  getById(
    @ReqContext() ctx: RequestContext,
    @Param('requirementId', new ParseUuidPipe('requirementId'))
    requirementId: string,
  ): Promise<AcademicLevelRequirementResponseDto> {
    return this.service.getById(ctx, requirementId);
  }

  @Put(':requirementId')
  @ApiOperation({ summary: 'Update academic level requirement' })
  @ApiParam({ name: 'requirementId', description: 'Requirement UUID' })
  @ApiWrappedOkResponse(
    AcademicLevelRequirementResponseDto,
    'Academic level requirement updated',
  )
  update(
    @ReqContext() ctx: RequestContext,
    @Param('requirementId', new ParseUuidPipe('requirementId'))
    requirementId: string,
    @Body() dto: UpdateAcademicLevelRequirementDto,
  ): Promise<AcademicLevelRequirementResponseDto> {
    return this.service.update(ctx, requirementId, dto);
  }

  @Delete(':requirementId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete academic level requirement' })
  @ApiParam({ name: 'requirementId', description: 'Requirement UUID' })
  @ApiWrappedOkResponse(
    AcademicLevelRequirementResponseDto,
    'Academic level requirement deleted',
  )
  remove(
    @ReqContext() ctx: RequestContext,
    @Param('requirementId', new ParseUuidPipe('requirementId'))
    requirementId: string,
  ): Promise<AcademicLevelRequirementResponseDto> {
    return this.service.remove(ctx, requirementId);
  }
}
