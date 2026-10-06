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
import {
  CreateMeritFormulaTemplateDto,
  ListMeritFormulaTemplatesQueryDto,
  MeritFormulaTemplateListResponseDto,
  MeritFormulaTemplateResponseDto,
  OfferingMeritFormulaResponseDto,
  UpdateMeritFormulaTemplateDto,
  UpsertOfferingMeritFormulaDto,
} from './dto/merit-formula.dto.js';
import { MeritFormulasService } from './merit-formulas.service.js';

@ApiTags('Merit Formulas')
@ApiBearerAuth('bearer')
@ApiExtraModels(
  MeritFormulaTemplateResponseDto,
  MeritFormulaTemplateListResponseDto,
  CreateMeritFormulaTemplateDto,
  UpdateMeritFormulaTemplateDto,
  OfferingMeritFormulaResponseDto,
  UpsertOfferingMeritFormulaDto,
  ApiErrorResponseDto,
)
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@Controller('admissions')
export class MeritFormulasController {
  constructor(private readonly service: MeritFormulasService) {}

  @Post('merit-formula-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a merit formula template',
    description:
      'Degree-level default/reusable weight formula. Component weights must sum to 100 ' +
      '(e.g. Bachelor: MATRIC 10 + FSC 45 + ENTRY_TEST 45).',
  })
  @ApiWrappedCreatedResponse(
    MeritFormulaTemplateResponseDto,
    'Merit formula template created',
  )
  createTemplate(
    @ReqContext() ctx: RequestContext,
    @Body() dto: CreateMeritFormulaTemplateDto,
  ): Promise<MeritFormulaTemplateResponseDto> {
    return this.service.createTemplate(ctx, dto);
  }

  @Get('merit-formula-templates')
  @ApiOperation({ summary: 'List merit formula templates' })
  @ApiWrappedOkArrayResponse(
    MeritFormulaTemplateResponseDto,
    'Merit formula templates',
  )
  listTemplates(
    @ReqContext() ctx: RequestContext,
    @Query() query: ListMeritFormulaTemplatesQueryDto,
  ): Promise<MeritFormulaTemplateListResponseDto> {
    return this.service.listTemplates(ctx, query);
  }

  @Get('merit-formula-templates/:templateId')
  @ApiOperation({ summary: 'Get merit formula template by id' })
  @ApiParam({ name: 'templateId', format: 'uuid' })
  @ApiWrappedOkResponse(
    MeritFormulaTemplateResponseDto,
    'Merit formula template',
  )
  getTemplate(
    @ReqContext() ctx: RequestContext,
    @Param('templateId', new ParseUuidPipe('templateId')) templateId: string,
  ): Promise<MeritFormulaTemplateResponseDto> {
    return this.service.getTemplate(ctx, templateId);
  }

  @Put('merit-formula-templates/:templateId')
  @ApiOperation({
    summary: 'Update merit formula template',
    description: 'When components are sent, they replace the full set and must sum to 100.',
  })
  @ApiParam({ name: 'templateId', format: 'uuid' })
  @ApiWrappedOkResponse(
    MeritFormulaTemplateResponseDto,
    'Merit formula template updated',
  )
  updateTemplate(
    @ReqContext() ctx: RequestContext,
    @Param('templateId', new ParseUuidPipe('templateId')) templateId: string,
    @Body() dto: UpdateMeritFormulaTemplateDto,
  ): Promise<MeritFormulaTemplateResponseDto> {
    return this.service.updateTemplate(ctx, templateId, dto);
  }

  @Delete('merit-formula-templates/:templateId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete merit formula template' })
  @ApiParam({ name: 'templateId', format: 'uuid' })
  @ApiWrappedOkResponse(
    MeritFormulaTemplateResponseDto,
    'Merit formula template deleted',
  )
  deleteTemplate(
    @ReqContext() ctx: RequestContext,
    @Param('templateId', new ParseUuidPipe('templateId')) templateId: string,
  ): Promise<MeritFormulaTemplateResponseDto> {
    return this.service.deleteTemplate(ctx, templateId);
  }

  @Put('offerings/:offeringId/merit-formula')
  @ApiOperation({
    summary: 'Create or replace offering merit formula',
    description:
      'Attach custom weights or clone from templateId / degree-level default. ' +
      'Weights must sum to 100.',
  })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiWrappedOkResponse(
    OfferingMeritFormulaResponseDto,
    'Offering merit formula saved',
  )
  upsertOfferingFormula(
    @ReqContext() ctx: RequestContext,
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
    @Body() dto: UpsertOfferingMeritFormulaDto,
  ): Promise<OfferingMeritFormulaResponseDto> {
    return this.service.upsertOfferingFormula(ctx, offeringId, dto);
  }

  @Get('offerings/:offeringId/merit-formula')
  @ApiOperation({
    summary: 'Get effective merit formula for an offering',
    description:
      'Returns offering override when present; otherwise the ACTIVE default template for the programme degree_level. ' +
      'resolvedFromTemplate=true means no offering override exists yet.',
  })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  @ApiWrappedOkResponse(
    OfferingMeritFormulaResponseDto,
    'Effective merit formula',
  )
  getOfferingFormula(
    @ReqContext() ctx: RequestContext,
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
  ): Promise<OfferingMeritFormulaResponseDto> {
    return this.service.getOfferingFormula(ctx, offeringId);
  }

  @Delete('offerings/:offeringId/merit-formula')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove offering merit formula override',
    description: 'Falls back to the degree-level default template on next resolve.',
  })
  @ApiParam({ name: 'offeringId', format: 'uuid' })
  removeOfferingFormula(
    @ReqContext() ctx: RequestContext,
    @Param('offeringId', new ParseUuidPipe('offeringId')) offeringId: string,
  ): Promise<{ deleted: boolean; programmeOfferingId: string }> {
    return this.service.deleteOfferingFormula(ctx, offeringId);
  }
}
