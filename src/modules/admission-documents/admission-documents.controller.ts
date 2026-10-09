import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiStandardErrorResponses, ApiTenantHeaders, ApiWrappedCreatedArrayResponse, ApiWrappedCreatedResponse, ApiWrappedOkArrayResponse, ApiWrappedOkResponse, ApiWrappedRawArrayResponse } from '../../common/decorators/api-docs.decorator.js';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { ReqContext, type RequestContext } from '../../common/decorators/request-context.decorator.js';
import { AdmissionDocumentDto, ApplicantRequirementResponseDto, ApplicantRequirementStatusDto, CreateDocumentTypeDto, CreateOfferingRequirementDto, CreateOfferingRequirementsDto, DocumentAuditResponseDto, DocumentCompletenessDto, DocumentTypeResponseDto, LinkedDocumentRequirementDto, LinkAcademicDocumentDto, OfferingRequirementBatchResponseDto, OfferingRequirementResponseDto, RequestResubmissionDto, UpdateOfferingRequirementDto } from './dto/admission-document.dto.js';
import { AdmissionDocumentsService, type AdmissionUpload } from './admission-documents.service.js';

class DocumentTypeUpdateDto extends CreateDocumentTypeDto {}

@ApiTags('Applicant Documents')
@ApiBearerAuth('bearer')
@ApiStandardErrorResponses()
@ApiExtraModels(ApiErrorResponseDto, AdmissionDocumentDto, ApplicantRequirementResponseDto, ApplicantRequirementStatusDto, LinkedDocumentRequirementDto, DocumentCompletenessDto, LinkAcademicDocumentDto)
@Controller('applicant/applications/:applicantId/documents')
export class ApplicantDocumentsController {
  constructor(private readonly service: AdmissionDocumentsService) {}

  @Get('requirements')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Resolve required documents for selected programme offerings' })
  @ApiWrappedOkArrayResponse(ApplicantRequirementResponseDto)
  requirements(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.applicantRequirements(user, id); }

  @Get('completeness')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Get derived document completeness for the application' })
  @ApiWrappedOkResponse(DocumentCompletenessDto)
  completeness(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.completeness(user, id); }

  @Get()
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'List applicant documents and verification status' })
  @ApiWrappedOkArrayResponse(AdmissionDocumentDto)
  list(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.listApplicantDocuments(user, id); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: Number(process.env.ADMISSION_DOCUMENT_MAX_BYTES || 10 * 1024 * 1024) } }))
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file','offeringRequiredDocumentIds'], properties: { file: { type: 'string', format: 'binary' }, offeringRequiredDocumentIds: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', format: 'uuid' }, description: 'Equivalent selected-offering requirements satisfied by this file' }, offeringRequiredDocumentId: { type: 'string', format: 'uuid', deprecated: true, description: 'Legacy single-requirement field' } } } })
  @ApiOperation({ summary: 'Upload one document for one or more equivalent offering requirements', description: 'The file is stored once and shared by the listed requirements. Accepted formats: JPG, JPEG, PNG, GIF, BMP, and PDF. Allowed while the application is in progress or after submit.' })
  @ApiWrappedCreatedArrayResponse(AdmissionDocumentDto)
  upload(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string, @Body() body: { offeringRequiredDocumentIds?: string[] | string; offeringRequiredDocumentId?: string }, @UploadedFile() file?: AdmissionUpload) { return this.service.upload(user, id, this.requirementIds(body), file); }

  @Post('link-academic')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiBody({ type: LinkAcademicDocumentDto, examples: { shareWithRequirements: { summary: 'Use one existing academic file for equivalent requirements', value: { academicDocumentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', offeringRequiredDocumentIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'] } } } })
  @ApiOperation({ summary: 'Link one existing academic document to one or more equivalent offering requirements' })
  @ApiWrappedCreatedArrayResponse(AdmissionDocumentDto)
  linkAcademic(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string, @Body() dto: LinkAcademicDocumentDto) { return this.service.linkAcademic(user, id, dto); }

  @Get([':documentId/file', ':documentId'])
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOperation({ summary: 'Get document metadata and a resolved download URL' })
  @ApiWrappedOkResponse(AdmissionDocumentDto)
  get(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string, @Param('documentId', new ParseUuidPipe('documentId')) documentId: string) { return this.service.getApplicantDocument(user, applicantId, documentId); }

  @Post(':documentId/replace')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: Number(process.env.ADMISSION_DOCUMENT_MAX_BYTES || 10 * 1024 * 1024) } }))
  @ApiParam({ name: 'applicantId', format: 'uuid' }) @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Replace a submitted or returned document; verified documents cannot be replaced' })
  @ApiWrappedRawArrayResponse(AdmissionDocumentDto)
  replace(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string, @Param('documentId', new ParseUuidPipe('documentId')) documentId: string, @UploadedFile() file?: AdmissionUpload) { return this.service.replace(user, applicantId, documentId, file); }

  private requirementIds(body: { offeringRequiredDocumentIds?: string[] | string; offeringRequiredDocumentId?: string }) {
    const values = body.offeringRequiredDocumentIds ?? body.offeringRequiredDocumentId;
    if (!values) return [];
    return [...new Set((Array.isArray(values) ? values : [values]).map((value) => value.trim()).filter(Boolean))];
  }
}

@ApiTags('Admission Document Administration')
@ApiBearerAuth('bearer')
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@ApiExtraModels(ApiErrorResponseDto, AdmissionDocumentDto, DocumentTypeResponseDto, OfferingRequirementResponseDto, OfferingRequirementBatchResponseDto, DocumentAuditResponseDto, CreateDocumentTypeDto, CreateOfferingRequirementDto, CreateOfferingRequirementsDto, UpdateOfferingRequirementDto, RequestResubmissionDto)
@Controller('admissions')
export class AdmissionDocumentsAdminController {
  constructor(private readonly service: AdmissionDocumentsService) {}

  @Get('document-types') @ApiOperation({ summary: 'List admission document types' }) @ApiWrappedOkArrayResponse(DocumentTypeResponseDto)
  listTypes(@ReqContext() user: RequestContext) { return this.service.listTypes(user); }
  @Post('document-types') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Create a document type' }) @ApiWrappedCreatedResponse(DocumentTypeResponseDto)
  createType(@ReqContext() user: RequestContext, @Body() dto: CreateDocumentTypeDto) { return this.service.createType(user, dto); }
  @Put('document-types/:documentTypeId') @ApiParam({ name: 'documentTypeId', format: 'uuid' }) @ApiOperation({ summary: 'Update a document type' }) @ApiWrappedOkResponse(DocumentTypeResponseDto)
  updateType(@ReqContext() user: RequestContext, @Param('documentTypeId', new ParseUuidPipe('documentTypeId')) id: string, @Body() dto: DocumentTypeUpdateDto) { return this.service.updateType(user, id, dto); }

  @Get('offerings/:offeringId/required-documents') @ApiParam({ name: 'offeringId', format: 'uuid' }) @ApiOperation({ summary: 'List document requirements configured for an offering' }) @ApiWrappedOkArrayResponse(OfferingRequirementResponseDto)
  listRequirements(@ReqContext() user: RequestContext, @Param('offeringId', new ParseUuidPipe('offeringId')) id: string) { return this.service.listRequirements(user, id); }
  @Post('offerings/required-documents') @HttpCode(HttpStatus.CREATED) @ApiOperation({ summary: 'Configure one or more document requirements on one or more offerings', description: 'Each item in requirements is attached to every editable offering in offeringIds.' })
  @ApiBody({ type: CreateOfferingRequirementsDto, examples: { attachRequirements: { summary: 'Attach the same required documents to multiple offerings', value: { offeringIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'], requirements: [{ documentTypeId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', mandatory: true, sortOrder: 1 }, { documentTypeId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', mandatory: false, conditionCode: 'TRANSFER_CASE', sortOrder: 2 }] } } } })
  @ApiWrappedCreatedResponse(OfferingRequirementBatchResponseDto)
  createRequirements(@ReqContext() user: RequestContext, @Body() dto: CreateOfferingRequirementsDto) { return this.service.createRequirementsForOfferings(user, dto); }
  @Put('required-documents/:requirementId') @ApiParam({ name: 'requirementId', format: 'uuid' }) @ApiOperation({ summary: 'Update an offering document requirement' }) @ApiWrappedOkResponse(OfferingRequirementResponseDto)
  updateRequirement(@ReqContext() user: RequestContext, @Param('requirementId', new ParseUuidPipe('requirementId')) id: string, @Body() dto: UpdateOfferingRequirementDto) { return this.service.updateRequirement(user, id, dto); }
  @Delete('required-documents/:requirementId') @ApiParam({ name: 'requirementId', format: 'uuid' }) @ApiOperation({ summary: 'Remove an unused offering document requirement' })
  deleteRequirement(@ReqContext() user: RequestContext, @Param('requirementId', new ParseUuidPipe('requirementId')) id: string) { return this.service.deleteRequirement(user, id); }

  @Get('applications/:applicantId/documents') @ApiParam({ name: 'applicantId', format: 'uuid' }) @ApiOperation({ summary: 'Review an application’s document set' }) @ApiWrappedOkArrayResponse(AdmissionDocumentDto)
  applicationDocuments(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.staffApplicationDocuments(user, id); }
  @Get('documents/pending') @ApiOperation({ summary: 'List submitted documents awaiting verification' }) @ApiWrappedOkArrayResponse(AdmissionDocumentDto)
  pending(@ReqContext() user: RequestContext) { return this.service.pending(user); }
  @Get('documents/exceptions') @ApiOperation({ summary: 'List submitted and resubmission-required document exceptions' }) @ApiWrappedOkArrayResponse(AdmissionDocumentDto)
  exceptions(@ReqContext() user: RequestContext) { return this.service.exceptions(user); }
  @Post('documents/:documentId/verify') @HttpCode(HttpStatus.OK) @ApiParam({ name: 'documentId', format: 'uuid' }) @ApiOperation({ summary: 'Verify a shared applicant document for every linked offering requirement' }) @ApiWrappedRawArrayResponse(AdmissionDocumentDto)
  verify(@ReqContext() user: RequestContext, @Param('documentId', new ParseUuidPipe('documentId')) id: string) { return this.service.verify(user, id); }
  @Post('documents/:documentId/request-resubmission') @HttpCode(HttpStatus.OK) @ApiParam({ name: 'documentId', format: 'uuid' }) @ApiOperation({ summary: 'Return a shared applicant document for replacement across every linked offering requirement' }) @ApiWrappedRawArrayResponse(AdmissionDocumentDto)
  requestResubmission(@ReqContext() user: RequestContext, @Param('documentId', new ParseUuidPipe('documentId')) id: string, @Body() dto: RequestResubmissionDto) { return this.service.requestResubmission(user, id, dto); }
  @Get('documents/:documentId/audit') @ApiParam({ name: 'documentId', format: 'uuid' }) @ApiOperation({ summary: 'Get document action audit history' }) @ApiWrappedOkArrayResponse(DocumentAuditResponseDto)
  audit(@ReqContext() user: RequestContext, @Param('documentId', new ParseUuidPipe('documentId')) id: string) { return this.service.auditHistory(user, id); }
  @Get('documents/:documentId/versions') @ApiParam({ name: 'documentId', format: 'uuid' }) @ApiOperation({ summary: 'Get replacement actions for this document' }) @ApiWrappedOkArrayResponse(DocumentAuditResponseDto)
  versions(@ReqContext() user: RequestContext, @Param('documentId', new ParseUuidPipe('documentId')) id: string) { return this.service.auditHistory(user, id); }

}
