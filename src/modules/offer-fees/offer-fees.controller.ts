import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardErrorResponses,
  ApiTenantHeaders,
  ApiWrappedCreatedResponse,
  ApiWrappedOkResponse,
} from '../../common/decorators/api-docs.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import {
  ReqContext,
  type RequestContext,
} from '../../common/decorators/request-context.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import {
  ExpireUnpaidOffersDto,
  ExpireUnpaidOffersResponseDto,
  OfferFeeChallanResponseDto,
  OfferFeeEvidenceResponseDto,
  SeatReleaseRunResponseDto,
  VerifyOfferFeeEvidenceDto,
  VerifyOfferFeeEvidenceResponseDto,
} from './dto/offer-fee.dto.js';
import { OfferFeesService } from './offer-fees.service.js';

@ApiTags('Offer Fee (Admission Challan)')
@ApiBearerAuth('bearer')
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@ApiExtraModels(
  ApiErrorResponseDto,
  OfferFeeChallanResponseDto,
  OfferFeeEvidenceResponseDto,
  VerifyOfferFeeEvidenceDto,
  VerifyOfferFeeEvidenceResponseDto,
  ExpireUnpaidOffersDto,
  ExpireUnpaidOffersResponseDto,
  SeatReleaseRunResponseDto,
)
@Controller('admissions/offer-fees')
export class OfferFeesAdminController {
  constructor(private readonly service: OfferFeesService) {}

  @Get('offers/:offerId/challan')
  @ApiOperation({
    summary: 'Get admission/offer fee challan for an offer',
    description:
      'Returns the post-offer admission challan (tuition and related fee types). Processing/application fees are on the earlier processing-fee challan.',
  })
  @ApiParam({ name: 'offerId', format: 'uuid' })
  @ApiWrappedOkResponse(OfferFeeChallanResponseDto)
  getByOffer(
    @ReqContext() ctx: RequestContext,
    @Param('offerId', new ParseUuidPipe('offerId')) offerId: string,
  ) {
    return this.service.getChallanByOffer(ctx, offerId);
  }

  @Post('offers/:offerId/challan/generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate (or return existing) admission fee challan for a published offer',
    description:
      'Idempotent. Prefer publishing the offer (which auto-generates the challan); use this to regenerate or backfill.',
  })
  @ApiParam({ name: 'offerId', format: 'uuid' })
  @ApiWrappedCreatedResponse(OfferFeeChallanResponseDto)
  generate(
    @ReqContext() ctx: RequestContext,
    @Param('offerId', new ParseUuidPipe('offerId')) offerId: string,
  ) {
    return this.service.generateForExistingOffer(ctx, offerId);
  }

  @Post('evidences/:evidenceId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify or reject offer-fee payment evidence',
    description:
      'Uses intake feeConfirmMarginPercent when comparing amountPaid (or amountClaimed) to the challan total. VERIFIED marks the offer ACCEPTED; REJECTED returns the challan to UNPAID.',
  })
  @ApiParam({ name: 'evidenceId', format: 'uuid' })
  @ApiWrappedOkResponse(VerifyOfferFeeEvidenceResponseDto)
  verify(
    @ReqContext() ctx: RequestContext,
    @Param('evidenceId', new ParseUuidPipe('evidenceId')) evidenceId: string,
    @Body() dto: VerifyOfferFeeEvidenceDto,
  ) {
    return this.service.verifyEvidence(ctx, evidenceId, dto);
  }

  @Post('expire-unpaid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Expire unpaid published offers past deadline (+ grace) and optionally promote waitlist',
    description:
      'Manual counterpart of the hourly scheduler. Expires PUBLISHED offers whose acceptance_deadline + offerFeeGraceHours has passed and whose challan is not VERIFIED / LATE_PAYMENT_VERIFIED. When promoteWaitlist is true, promotes the next WAITING candidate and publishes a new offer with challan.',
  })
  @ApiWrappedOkResponse(ExpireUnpaidOffersResponseDto)
  expire(
    @ReqContext() ctx: RequestContext,
    @Body() dto: ExpireUnpaidOffersDto,
  ) {
    return this.service.expireUnpaidAndPromote(ctx, dto);
  }
}

@ApiTags('Applicant Offer Fee')
@ApiBearerAuth('bearer')
@ApiStandardErrorResponses()
@ApiExtraModels(OfferFeeChallanResponseDto, OfferFeeEvidenceResponseDto)
@Controller('applicant/applications/:applicantId/offer-fee')
export class ApplicantOfferFeeController {
  constructor(private readonly service: OfferFeesService) {}

  @Get('challan')
  @ApiOperation({
    summary: 'Get the admission/offer fee challan for this application',
    description:
      'Requires a published offer with a generated challan. Applicant must own the application.',
  })
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiWrappedOkResponse(OfferFeeChallanResponseDto)
  getChallan(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ) {
    return this.service.getChallanForApplicant(user, applicantId);
  }

  @Post('evidence')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload bank receipt / payment evidence for offer fee',
    description:
      'Multipart upload (max 10 MB). Sets challan status to EVIDENCE_SUBMITTED. Replaces any current unverified evidence.',
  })
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Bank receipt image or PDF, max 10 MB',
        },
        amountClaimed: {
          type: 'number',
          description: 'Optional amount claimed on the receipt',
        },
      },
    },
  })
  @ApiWrappedCreatedResponse(OfferFeeEvidenceResponseDto)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadEvidence(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string },
    @Body('amountClaimed') amountClaimed?: string,
  ) {
    const amount =
      amountClaimed != null && amountClaimed !== ''
        ? Number(amountClaimed)
        : undefined;
    return this.service.uploadEvidence(
      user,
      applicantId,
      file,
      Number.isFinite(amount) ? amount : undefined,
    );
  }
}
