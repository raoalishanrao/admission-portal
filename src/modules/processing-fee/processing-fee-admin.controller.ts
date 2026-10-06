import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
  ApiWrappedCreatedResponse,
  ApiWrappedRawArrayResponse,
  ApiWrappedOkResponse,
} from '../../common/decorators/api-docs.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import {
  ApplicationProcessingFeeResponseDto,
  BankReconciliationRecordResponseDto,
  ConfirmOnlinePaymentDto,
  CreateDesignatedBankDto,
  DesignatedBankResponseDto,
  EvidenceRejectionResponseDto,
  EvidenceVerificationResponseDto,
  OnlinePaymentResponseDto,
  PaymentEvidenceResponseDto,
  ProcessingFeeChallanItemResponseDto,
  ProcessingFeeChallanResponseDto,
  ReconciliationImportResponseDto,
  RejectPaymentEvidenceDto,
  ResolveReconciliationExceptionDto,
  VerifyPaymentEvidenceDto,
} from './dto/processing-fee.dto.js';
import {
  ProcessingFeeService,
  type PaymentUpload,
} from './processing-fee.service.js';

@ApiTags('Processing Fee Administration')
@ApiBearerAuth('bearer')
@ApiStandardErrorResponses()
@ApiExtraModels(
  ApiErrorResponseDto,
  ProcessingFeeChallanResponseDto,
  ProcessingFeeChallanItemResponseDto,
  PaymentEvidenceResponseDto,
  VerifyPaymentEvidenceDto,
  RejectPaymentEvidenceDto,
  EvidenceVerificationResponseDto,
  EvidenceRejectionResponseDto,
  ApplicationProcessingFeeResponseDto,
  OnlinePaymentResponseDto,
  DesignatedBankResponseDto,
  CreateDesignatedBankDto,
  ConfirmOnlinePaymentDto,
)
@Controller('admissions')
export class ProcessingFeeAdminController {
  constructor(private readonly service: ProcessingFeeService) {}

  @Get('applications/:applicantId/processing-fee')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'View an application’s processing fee' })
  @ApiWrappedOkResponse(ApplicationProcessingFeeResponseDto)
  applicationPayment(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ) {
    return this.service.applicationPayment(user, applicantId);
  }

  @Get('processing-fee/evidence/pending')
  @ApiOperation({
    summary: 'List payment evidence awaiting manual verification',
  })
  @ApiWrappedRawArrayResponse(PaymentEvidenceResponseDto)
  pendingEvidence(@CurrentUser() user: AuthUser) {
    return this.service.pendingEvidence(user);
  }

  @Post('processing-fee/evidence/:evidenceId/verify')
  @ApiParam({ name: 'evidenceId', format: 'uuid' })
  @ApiOperation({
    summary: 'Manually verify payment evidence',
    description:
      'Verifies current evidence, checks paid amount, records actor/date and updates both challan and application payment state.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiWrappedOkResponse(EvidenceVerificationResponseDto)
  verifyEvidence(
    @CurrentUser() user: AuthUser,
    @Param('evidenceId', new ParseUuidPipe('evidenceId')) id: string,
    @Body() dto: VerifyPaymentEvidenceDto,
  ) {
    return this.service.verifyEvidence(user, id, dto);
  }

  @Post('processing-fee/evidence/:evidenceId/reject')
  @ApiParam({ name: 'evidenceId', format: 'uuid' })
  @ApiOperation({ summary: 'Reject payment evidence and request replacement' })
  @HttpCode(HttpStatus.OK)
  @ApiWrappedOkResponse(EvidenceRejectionResponseDto)
  rejectEvidence(
    @CurrentUser() user: AuthUser,
    @Param('evidenceId', new ParseUuidPipe('evidenceId')) id: string,
    @Body() dto: RejectPaymentEvidenceDto,
  ) {
    return this.service.rejectEvidence(user, id, dto.reason);
  }

  @Get('processing-fee/challans/:challanId/items')
  @ApiParam({ name: 'challanId', format: 'uuid' })
  @ApiOperation({ summary: 'Get an itemised fee breakdown' })
  @ApiWrappedRawArrayResponse(ProcessingFeeChallanItemResponseDto)
  challanItems(
    @CurrentUser() user: AuthUser,
    @Param('challanId', new ParseUuidPipe('challanId')) id: string,
  ) {
    return this.service.challanItems(user, id);
  }

  @Get('processing-fee/challans/:challanId/payments')
  @ApiParam({ name: 'challanId', format: 'uuid' })
  @ApiOperation({ summary: 'List online payment history for a challan' })
  @ApiWrappedRawArrayResponse(OnlinePaymentResponseDto)
  challanPayments(
    @CurrentUser() user: AuthUser,
    @Param('challanId', new ParseUuidPipe('challanId')) id: string,
  ) {
    return this.service.challanPayments(user, id);
  }

  @Get('processing-fee/banks')
  @ApiOperation({ summary: 'List currently active designated banks' })
  @ApiWrappedRawArrayResponse(DesignatedBankResponseDto)
  listBanks(@CurrentUser() user: AuthUser) {
    return this.service.listBanks(user);
  }

  @Post('processing-fee/banks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a designated bank configuration',
    description:
      'Bank details are snapshotted onto newly generated challans; updates do not alter existing challans.',
  })
  @ApiWrappedCreatedResponse(DesignatedBankResponseDto)
  createBank(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDesignatedBankDto,
  ) {
    return this.service.createBank(user, dto);
  }

  @Post('processing-fee/banks/:bankId/logo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  @ApiParam({ name: 'bankId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'Upload or replace the designated bank logo',
    description: 'Accepts JPEG, PNG, or WEBP images up to 2 MB. The response includes a resolved logoUrl.',
  })
  @ApiWrappedOkResponse(DesignatedBankResponseDto)
  uploadBankLogo(
    @CurrentUser() user: AuthUser,
    @Param('bankId', new ParseUuidPipe('bankId')) id: string,
    @UploadedFile() file?: PaymentUpload,
  ) {
    return this.service.uploadBankLogo(user, id, file);
  }

  @Put('processing-fee/banks/:bankId')
  @ApiParam({ name: 'bankId', format: 'uuid' })
  @ApiOperation({
    summary: 'Update designated bank configuration for future challans',
  })
  @ApiWrappedOkResponse(DesignatedBankResponseDto)
  updateBank(
    @CurrentUser() user: AuthUser,
    @Param('bankId', new ParseUuidPipe('bankId')) id: string,
    @Body() dto: CreateDesignatedBankDto,
  ) {
    return this.service.updateBank(user, id, dto);
  }

  @Post('processing-fee/banks/:bankId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'bankId', format: 'uuid' })
  @ApiOperation({ summary: 'Activate designated bank configuration' })
  @ApiWrappedOkResponse(DesignatedBankResponseDto)
  activateBank(
    @CurrentUser() user: AuthUser,
    @Param('bankId', new ParseUuidPipe('bankId')) id: string,
  ) {
    return this.service.setBankActive(user, id, true);
  }

  @Post('processing-fee/banks/:bankId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'bankId', format: 'uuid' })
  @ApiOperation({
    summary: 'Deactivate bank configuration for future challans',
  })
  @ApiWrappedOkResponse(DesignatedBankResponseDto)
  deactivateBank(
    @CurrentUser() user: AuthUser,
    @Param('bankId', new ParseUuidPipe('bankId')) id: string,
  ) {
    return this.service.setBankActive(user, id, false);
  }

  @Post('processing-fee/payments/confirmation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive authenticated online payment confirmation',
    description:
      'Uses the tenant-scoped transaction reference to apply provider confirmation idempotently. Requires a trusted payment-provider/system IAM role.',
  })
  @ApiWrappedOkResponse(OnlinePaymentResponseDto)
  confirmPayment(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmOnlinePaymentDto,
  ) {
    return this.service.confirmOnlinePayment(user, dto);
  }
}

@ApiTags('Bank Reconciliation')
@ApiBearerAuth('bearer')
@ApiStandardErrorResponses()
@ApiExtraModels(
  ApiErrorResponseDto,
  ReconciliationImportResponseDto,
  BankReconciliationRecordResponseDto,
  ResolveReconciliationExceptionDto,
)
@Controller('admissions/processing-fee/reconciliation')
export class BankReconciliationController {
  constructor(private readonly service: ProcessingFeeService) {}

  @Post('imports')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Daily bank CSV feed, max 20 MB.',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Import and reconcile bank CSV',
    description:
      'Stores the original file and each source row. ReceiptNo is matched against challan_number on both processing-fee challans and offer-fee (admission) challans; matchedChallanKind is PROCESSING or OFFER. ConsumerNo is checked against registration_number, and Amount against the challan total. Successful matches auto-verify the corresponding challan. Mismatches and duplicates remain in the exception queue.',
  })
  @ApiWrappedCreatedResponse(ReconciliationImportResponseDto)
  importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: PaymentUpload,
  ) {
    return this.service.importBankCsv(user, file);
  }

  @Get('imports/:importId')
  @ApiParam({ name: 'importId', format: 'uuid' })
  @ApiOperation({ summary: 'Get bank import summary' })
  @ApiWrappedOkResponse(ReconciliationImportResponseDto)
  getImport(
    @CurrentUser() user: AuthUser,
    @Param('importId', new ParseUuidPipe('importId')) id: string,
  ) {
    return this.service.getImport(user, id);
  }

  @Get('imports/:importId/records')
  @ApiParam({ name: 'importId', format: 'uuid' })
  @ApiOperation({
    summary: 'List source records and reconciliation outcomes for an import',
  })
  @ApiWrappedRawArrayResponse(BankReconciliationRecordResponseDto)
  records(
    @CurrentUser() user: AuthUser,
    @Param('importId', new ParseUuidPipe('importId')) id: string,
  ) {
    return this.service.importRecords(user, id);
  }

  @Get('exceptions')
  @ApiOperation({ summary: 'List unresolved reconciliation exceptions' })
  @ApiWrappedRawArrayResponse(BankReconciliationRecordResponseDto)
  exceptions(@CurrentUser() user: AuthUser) {
    return this.service.exceptionQueue(user);
  }

  @Post('exceptions/:recordId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'recordId', format: 'uuid' })
  @ApiOperation({ summary: 'Resolve a reconciliation exception' })
  @ApiWrappedOkResponse(BankReconciliationRecordResponseDto)
  resolve(
    @CurrentUser() user: AuthUser,
    @Param('recordId', new ParseUuidPipe('recordId')) id: string,
    @Body() dto: ResolveReconciliationExceptionDto,
  ) {
    return this.service.resolveException(user, id, dto);
  }
}
