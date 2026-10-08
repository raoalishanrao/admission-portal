import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrorResponses, ApiTenantHeaders, ApiWrappedOkArrayResponse, ApiWrappedOkResponse } from '../../common/decorators/api-docs.decorator.js';
import { ReqContext, type RequestContext } from '../../common/decorators/request-context.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { ApplicationDecisionDto, ApplicationDecisionResponseDto, ApplicationListPreferenceDto, ApplicationQueueItemDto, ApplicationReviewListDto, ApplicationReviewQueryDto, ApplicationReviewResponseDto, ApplicationReviewSummaryDto, ApplicationStatusAuditDto } from './dto/application-review.dto.js';
import { ApplicationReviewService } from './application-review.service.js';

@ApiTags('Application Review and Decision')
@ApiBearerAuth('bearer')
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@ApiExtraModels(ApiErrorResponseDto, ApplicationReviewQueryDto, ApplicationListPreferenceDto, ApplicationQueueItemDto, ApplicationReviewListDto, ApplicationReviewSummaryDto, ApplicationReviewResponseDto, ApplicationDecisionDto, ApplicationDecisionResponseDto, ApplicationStatusAuditDto)
@Controller('admissions/applications')
export class ApplicationReviewController {
  constructor(private readonly service: ApplicationReviewService) {}

  @Get()
  @ApiOperation({ summary: 'List the admissions application review queue', description: 'Search and page submitted, approved, and rejected applications. Queue segments include unpaid fee and document exceptions.' })
  @ApiWrappedOkResponse(ApplicationReviewListDto)
  list(@ReqContext() ctx: RequestContext, @Query() query: ApplicationReviewQueryDto) { return this.service.list(ctx, query); }

  @Get('summary')
  @ApiOperation({
    summary: 'Get application review dashboard card counts',
    description:
      'Returns totals for Total Submitted, Paid/Unpaid Processing Fee, Missing Documents, and Missing Fee & Documents. Use GET /admissions/applications?queue=… to list each segment.',
  })
  @ApiWrappedOkResponse(ApplicationReviewSummaryDto)
  summary(@ReqContext() ctx: RequestContext) {
    return this.service.summary(ctx);
  }

  @Get(':applicantId/status-history')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Get application status decision history' })
  @ApiWrappedOkArrayResponse(ApplicationStatusAuditDto)
  history(@ReqContext() ctx: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.history(ctx, id); }

  @Get(':applicantId')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Review complete application details and decision readiness', description: 'Includes applicant profile, education and academic files, programme preferences, addresses, contacts, declaration, F004 documents, and F003 payment/evidence.' })
  @ApiWrappedOkResponse(ApplicationReviewResponseDto)
  review(@ReqContext() ctx: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.review(ctx, id); }

  @Patch(':applicantId/status')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Approve or reject a submitted application', description: 'Approval requires verified processing fee and a complete verified document set. On approval, an admit card is generated automatically from the matching published test session. Rejection requires a valid reason code and text. Final decisions cannot be overwritten.' })
  @ApiWrappedOkResponse(ApplicationDecisionResponseDto)
  decide(@ReqContext() ctx: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string, @Body() dto: ApplicationDecisionDto) { return this.service.decide(ctx, id, dto); }
}
