import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrorResponses, ApiTenantHeaders, ApiWrappedCreatedResponse, ApiWrappedOkArrayResponse, ApiWrappedOkResponse } from '../../common/decorators/api-docs.decorator.js';
import { ReqContext, type RequestContext } from '../../common/decorators/request-context.decorator.js';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { AllocationConfirmDto, AllocationPreviewDto, ConfirmImportDto, GenerateMeritListDto, ImportRowQueryDto, OfferAuthorizationDto, OfferResponseEventDto, ResultImportResponseDto, UploadResultQueryDto } from './selection-offers.dto.js';
import { SelectionOffersService, type UploadedWorkbookFile } from './selection-offers.service.js';

@ApiTags('Selection, Results & Admission Offers')
@ApiBearerAuth('bearer') @ApiTenantHeaders() @ApiStandardErrorResponses()
@ApiExtraModels(ApiErrorResponseDto, ResultImportResponseDto, UploadResultQueryDto, ImportRowQueryDto, GenerateMeritListDto, AllocationPreviewDto, AllocationConfirmDto, OfferAuthorizationDto)
@Controller('admissions')
export class SelectionOffersController {
  constructor(private readonly service: SelectionOffersService) {}

  @Post('entry-test-results/import') @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload and validate an Excel test-result batch', description: 'Requires RESULT worksheet and application_reference, percentage and result_status columns. Import is staged; this does not publish results.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['testSessionId','file'], properties: { testSessionId: { type: 'string', format: 'uuid' }, file: { type: 'string', format: 'binary' } } } })
  @ApiWrappedCreatedResponse(ResultImportResponseDto)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@ReqContext() ctx: RequestContext, @Body() body: UploadResultQueryDto, @UploadedFile() file: UploadedWorkbookFile) { return this.service.upload(ctx, body.testSessionId, file); }

  @Get('entry-test-results/imports/:importId') @ApiOperation({ summary: 'Get staged result import status and counts' }) @ApiWrappedOkResponse(ResultImportResponseDto)
  getImport(@ReqContext() ctx: RequestContext, @Param('importId',new ParseUuidPipe('importId')) id:string){return this.service.getImport(ctx,id);}
  @Get('entry-test-results/imports/:importId/rows') @ApiOperation({ summary: 'Get paginated result-import preview rows and validation errors' })
  importRows(@ReqContext() ctx:RequestContext,@Param('importId',new ParseUuidPipe('importId')) id:string,@Query() q:ImportRowQueryDto){return this.service.importRows(ctx,id,q.page,q.limit);}
  @Get('entry-test-results/imports/:importId/errors') @ApiOperation({ summary: 'Get row-level result import errors' })
  errors(@ReqContext() ctx:RequestContext,@Param('importId',new ParseUuidPipe('importId')) id:string){return this.service.importRows(ctx,id,1,100);}
  @Post('entry-test-results/imports/:importId/confirm') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Atomically confirm a fully valid result import' })
  confirm(@ReqContext() ctx:RequestContext,@Param('importId',new ParseUuidPipe('importId')) id:string,@Body() body:ConfirmImportDto){return this.service.confirmImport(ctx,id,body.correctionReason);}
  @Post('entry-test-results/publish') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Publish confirmed test scores to applicant accounts' })
  publishResults(@ReqContext() ctx:RequestContext,@Body() body:UploadResultQueryDto){return this.service.publishResults(ctx,body.testSessionId);}
  @Get('entry-test-results/:resultId') @ApiOperation({ summary: 'Get a scored result by UUID (admin)' })
  getResult(@ReqContext() ctx:RequestContext,@Param('resultId',new ParseUuidPipe('resultId')) id:string){return this.service.getResult(ctx,id);}

  @Post('merit-lists/generate') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Generate a versioned merit list for one offering' })
  generate(@ReqContext() ctx:RequestContext,@Body() dto:GenerateMeritListDto){return this.service.generateMerit(ctx,dto.testSessionId,dto.programmeOfferingId);}
  @Get('merit-lists/:meritListId') @ApiOperation({ summary: 'Get a merit-list snapshot and paginated candidates' })
  merit(@ReqContext() ctx:RequestContext,@Param('meritListId',new ParseUuidPipe('meritListId')) id:string,@Query() q:ImportRowQueryDto){return this.service.meritDetails(ctx,id,q.page,q.limit);}
  @Post('merit-lists/:meritListId/approve') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Approve a draft merit list' })
  approveMerit(@ReqContext() ctx:RequestContext,@Param('meritListId',new ParseUuidPipe('meritListId')) id:string){return this.service.approveMerit(ctx,id);}
  @Post('merit-lists/:meritListId/publish') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Publish an approved merit list to staff; applicant selection remains hidden until allocation confirms' })
  publishMerit(@ReqContext() ctx:RequestContext,@Param('meritListId',new ParseUuidPipe('meritListId')) id:string){return this.service.publishMerit(ctx,id);}

  @Post('allocations/preview') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Preview coordinated preference and capacity allocation across an intake/session' })
  preview(@ReqContext() ctx:RequestContext,@Body() dto:AllocationPreviewDto){return this.service.previewAllocation(ctx,dto.intakeSessionId,dto.testSessionId);}
  @Post('allocations/confirm') @HttpCode(HttpStatus.OK) @ApiOperation({ summary: 'Confirm an allocation version atomically; requires Idempotency-Key header' })
  confirmAllocation(@ReqContext() ctx:RequestContext,@Body() dto:AllocationConfirmDto,@Headers('idempotency-key') key:string){return this.service.confirmAllocation(ctx,dto.allocationId,dto.allocationVersion,key);}
  @Get('allocations/:allocationId') @ApiOperation({ summary: 'Get an allocation run and status' })
  allocation(@ReqContext() ctx:RequestContext,@Param('allocationId',new ParseUuidPipe('allocationId')) id:string){return this.service.allocation(ctx,id);}
  @Get('allocations/:allocationId/items') @ApiOperation({ summary: 'Get paginated proposed or confirmed applicant allocations' })
  allocationItems(@ReqContext() ctx:RequestContext,@Param('allocationId',new ParseUuidPipe('allocationId')) id:string,@Query() q:ImportRowQueryDto){return this.service.allocationItems(ctx,id,q.page,q.limit);}

  @Post('applications/:applicationId/offer/authorize') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Authorize an offer for an allocated applicant; deadline uses intake payment-period days' })
  authorizeOffer(@ReqContext() ctx:RequestContext,@Param('applicationId',new ParseUuidPipe('applicationId')) id:string,@Body() dto:OfferAuthorizationDto){return this.service.authorizeOffer(ctx,id,dto);}
  @Post('applications/:applicationId/offer/publish') @HttpCode(HttpStatus.OK) @ApiOperation({
    summary: 'Publish an authorized offer to its applicant',
    description:
      'Sets the offer PUBLISHED and auto-generates the admission/offer fee challan when missing. Response includes the offer row plus feeChallan (admission challan payload).',
  })
  publishOffer(@ReqContext() ctx:RequestContext,@Param('applicationId',new ParseUuidPipe('applicationId')) id:string){return this.service.publishOffer(ctx,id);}
  @Get('applications/:applicationId/offer') @ApiOperation({ summary: 'Get an applicant offer as admissions staff' })
  adminOffer(@ReqContext() ctx:RequestContext,@Param('applicationId',new ParseUuidPipe('applicationId')) id:string){this.service.admin(ctx); return this.service.getOffer(ctx,id);}
}

@ApiTags('Applicant Results & Offer') @ApiBearerAuth('bearer') @ApiStandardErrorResponses()
@Controller('applicant')
export class ApplicantSelectionController {
  constructor(private readonly service:SelectionOffersService){}
  @Get('results') @ApiOperation({summary:'View the signed-in applicant’s published test results'})
  results(@ReqContext() ctx:RequestContext,@CurrentUser() user:AuthUser){return this.service.applicantResults(ctx,user.userId);}
  @Get('offer') @ApiOperation({summary:'View the signed-in applicant’s published admission offer'})
  offer(@ReqContext() ctx:RequestContext,@CurrentUser() user:AuthUser){return this.service.applicantOffer(ctx,user.userId);}
}

@ApiTags('F008 Internal Offer Events') @Controller('internal/admissions/offers')
export class OfferEventsController {
  constructor(private readonly service:SelectionOffersService){}
  @Post('events') @HttpCode(HttpStatus.OK) @ApiOperation({summary:'Receive an authenticated versioned F008 offer response event'})
  async event(@ReqContext() ctx:RequestContext,@Headers('x-f008-integration-key') key:string,@Body() dto:OfferResponseEventDto){if(!process.env.F008_INTEGRATION_KEY||key!==process.env.F008_INTEGRATION_KEY)throw new UnauthorizedException('Authenticated F008 integration key required');return this.service.receiveOfferEvent(ctx,dto);}
}
