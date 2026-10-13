import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import {
  ReqContext,
  type RequestContext,
} from '../../common/decorators/request-context.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { AdmissionDocumentsService } from '../admission-documents/admission-documents.service.js';
import {
  CreateOfferingDto,
  ListOfferingsQueryDto,
  OfferingListResponseDto,
  OfferingResponseDto,
  UpdateOfferingDto,
} from './dto/offering.dto.js';
import { ProgrammeOfferingsService } from './programme-offerings.service.js';

@ApiTags('Programme Offering')
@ApiExtraModels(
  OfferingResponseDto,
  OfferingListResponseDto,
  CreateOfferingDto,
  UpdateOfferingDto,
  ApiErrorResponseDto,
)
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@Controller('admissions')
export class ProgrammeOfferingsController {
  constructor(
    private readonly programmeOfferingsService: ProgrammeOfferingsService,
    private readonly admissionDocuments: AdmissionDocumentsService,
  ) {}

  @Post('intakes/:intakeId/offerings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Associate a programme offering with an intake',
    description:
      'Links an ACTIVE programme to an editable intake. Offering is created in DRAFT status. ' +
      'Active degree-level document templates for the programme degree are applied automatically.',
  })
  @ApiParam({
    name: 'intakeId',
    description: 'Intake UUID',
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  })
  @ApiWrappedCreatedResponse(OfferingResponseDto, 'Offering created')
  async createForIntake(
    @ReqContext() ctx: RequestContext,
    @Param('intakeId', new ParseUuidPipe('intakeId')) intakeId: string,
    @Body() dto: CreateOfferingDto,
  ): Promise<OfferingResponseDto> {
    const offering = await this.programmeOfferingsService.createForIntake(
      ctx,
      intakeId,
      dto,
    );
    await this.admissionDocuments.applyDegreeLevelTemplatesToOffering(
      ctx.tenantId,
      offering.id,
      ctx.userId,
    );
    return offering;
  }

  @Get('intakes/:intakeId/offerings')
  @ApiOperation({
    summary: 'List offerings associated with an intake',
    description: 'Returns a paginated list of programme offerings for the intake.',
  })
  @ApiParam({
    name: 'intakeId',
    description: 'Intake UUID',
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  })
  @ApiWrappedOkArrayResponse(OfferingResponseDto, 'Offering list')
  listForIntake(
    @ReqContext() ctx: RequestContext,
    @Param('intakeId', new ParseUuidPipe('intakeId')) intakeId: string,
    @Query() query: ListOfferingsQueryDto,
  ): Promise<OfferingListResponseDto> {
    return this.programmeOfferingsService.listForIntake(ctx, intakeId, query);
  }

  @Patch('offerings/:offeringId')
  @ApiOperation({
    summary: 'Update applicant-facing offering information',
    description:
      'Updates published description and/or display order. At least one field is required. ' +
      'Allowed only while intake and offering remain editable.',
  })
  @ApiParam({
    name: 'offeringId',
    description: 'Offering UUID',
    example: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  })
  @ApiWrappedOkResponse(OfferingResponseDto, 'Offering updated')
  update(
    @ReqContext() ctx: RequestContext,
    @Param('offeringId', new ParseUuidPipe('offeringId'))
    offeringId: string,
    @Body() dto: UpdateOfferingDto,
  ): Promise<OfferingResponseDto> {
    return this.programmeOfferingsService.update(ctx, offeringId, dto);
  }
}
