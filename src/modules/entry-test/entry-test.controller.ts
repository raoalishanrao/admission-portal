import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiStandardErrorResponses, ApiTenantHeaders, ApiWrappedCreatedResponse, ApiWrappedOkResponse, ApiWrappedRawArrayResponse } from '../../common/decorators/api-docs.decorator.js';
import { ReqContext, type RequestContext } from '../../common/decorators/request-context.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { AdmitCardResponseDto, AttendanceAuditResponseDto, AttendanceQrResponseDto, AttendanceResponseDto, CreateTestCentreDto, EntryTestOutcomeResponseDto, MarkAttendanceDto, RecordOutcomeDto, TestCentreResponseDto, TestSessionDto, TestSessionResponseDto, UpdateTestCentreDto, UpdateTestSessionDto } from './dto/entry-test.dto.js';
import { EntryTestService } from './entry-test.service.js';

@ApiTags('Entry Test Scheduling and Admit Cards')
@ApiBearerAuth('bearer')
@ApiTenantHeaders()
@ApiStandardErrorResponses()
@ApiExtraModels(ApiErrorResponseDto, CreateTestCentreDto, UpdateTestCentreDto, TestCentreResponseDto, TestSessionDto, UpdateTestSessionDto, TestSessionResponseDto, AdmitCardResponseDto, AttendanceResponseDto, AttendanceQrResponseDto, AttendanceAuditResponseDto, EntryTestOutcomeResponseDto, MarkAttendanceDto, RecordOutcomeDto)
@Controller('admissions')
export class EntryTestAdminController {
  constructor(private readonly service: EntryTestService) {}

  @Post('test-centres')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a test centre for a published intake' })
  @ApiWrappedCreatedResponse(TestCentreResponseDto)
  createCentre(@ReqContext() user: RequestContext, @Body() dto: CreateTestCentreDto) { return this.service.createCentre(user, dto); }

  @Get('test-centres')
  @ApiQuery({ name: 'intakeSessionId', required: false, format: 'uuid' })
  @ApiOperation({ summary: 'List test centres, optionally filtered by intake' })
  @ApiWrappedRawArrayResponse(TestCentreResponseDto)
  centres(@ReqContext() user: RequestContext, @Query('intakeSessionId') intakeId?: string) { return this.service.listCentres(user, intakeId); }

  @Patch('test-centres/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Update or deactivate a test centre; centres are not hard-deleted' })
  @ApiWrappedOkResponse(TestCentreResponseDto)
  updateCentre(@ReqContext() user: RequestContext, @Param('id', new ParseUuidPipe('id')) id: string, @Body() dto: UpdateTestCentreDto) { return this.service.updateCentre(user, id, dto); }

  @Post('test-sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a test session' })
  @ApiWrappedCreatedResponse(TestSessionResponseDto)
  createSession(@ReqContext() user: RequestContext, @Body() dto: TestSessionDto) { return this.service.createSession(user, dto); }

  @Get('test-sessions')
  @ApiQuery({ name: 'testCentreId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'programmeId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'intakeSessionId', required: false, format: 'uuid' })
  @ApiOperation({ summary: 'List and filter test sessions' })
  @ApiWrappedRawArrayResponse(TestSessionResponseDto)
  sessions(@ReqContext() user: RequestContext, @Query('testCentreId') testCentreId?: string, @Query('programmeId') programmeId?: string, @Query('intakeSessionId') intakeSessionId?: string) { return this.service.listSessions(user, { testCentreId, programmeId, intakeSessionId }); }

  @Patch('test-sessions/:id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Update or publish a session; schedule changes supersede existing card snapshots' })
  @ApiWrappedOkResponse(TestSessionResponseDto)
  updateSession(@ReqContext() user: RequestContext, @Param('id', new ParseUuidPipe('id')) id: string, @Body() dto: UpdateTestSessionDto) { return this.service.updateSession(user, id, dto); }

  @Post('applications/:applicantId/admit-card/generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Generate and publish the idempotent admit-card snapshot for an approved applicant' })
  @ApiWrappedCreatedResponse(AdmitCardResponseDto)
  generateCard(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.generateAdmitCard(user, id); }

  @Get('applications/:applicantId/admit-card')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Retrieve an applicant admit card as authorized staff' })
  @ApiWrappedOkResponse(AdmitCardResponseDto)
  adminCard(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.adminAdmitCard(user, id); }

  @Get('applications/:applicantId/admit-card/print')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Get print-ready admit-card snapshot data and QR URL for the portal print view' })
  @ApiWrappedOkResponse(AdmitCardResponseDto)
  printCard(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.printableCard(user, id); }

  @Get('attendance/qr/:qrToken')
  @ApiParam({ name: 'qrToken', description: 'Opaque, unguessable QR token' })
  @ApiOperation({ summary: 'Resolve an admit-card QR token for the authenticated attendance page' })
  @ApiWrappedOkResponse(AttendanceQrResponseDto)
  resolveQr(@ReqContext() user: RequestContext, @Param('qrToken') token: string) { return this.service.resolveQr(user, token); }

  @Post('attendance/qr/:qrToken/scan')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'qrToken', description: 'Opaque, unguessable QR token' })
  @ApiOperation({ summary: 'Audit a valid, invalid, expired, or repeat QR scan and load the attendance page' })
  @ApiWrappedOkResponse(AttendanceQrResponseDto)
  scanQr(@ReqContext() user: RequestContext, @Param('qrToken') token: string, @Req() request: Request) { return this.service.scanQr(user, token, { ip: request.ip, userAgent: request.get('user-agent') }); }

  @Post('applications/:applicantId/attendance')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Mark the scanned applicant PRESENT or ABSENT after staff identity verification' })
  @ApiWrappedOkResponse(AttendanceResponseDto)
  markAttendance(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string, @Body() dto: MarkAttendanceDto) { return this.service.markAttendance(user, id, dto); }

  @Get('applications/:applicantId/attendance/audit')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'View attendance decision history and all QR scan audit events for an applicant' })
  @ApiWrappedOkResponse(AttendanceAuditResponseDto)
  attendanceAudit(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.attendanceAudit(user, id); }

  @Post('applications/:applicantId/result-awaited')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Mark verified PRESENT attendance as Result Awaited without changing application status' })
  @ApiWrappedOkResponse(AttendanceResponseDto)
  resultAwaited(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.resultAwaited(user, id); }

  @Post('applications/:applicantId/entry-test-outcome')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Record an institution-defined entry-test outcome after Result Awaited' })
  @ApiWrappedCreatedResponse(EntryTestOutcomeResponseDto)
  recordOutcome(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string, @Body() dto: RecordOutcomeDto) { return this.service.recordOutcome(user, id, dto); }

  @Get('applications/:applicantId/entry-test-outcome')
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'Retrieve the applicant entry-test outcome' })
  @ApiWrappedOkResponse(EntryTestOutcomeResponseDto)
  outcome(@ReqContext() user: RequestContext, @Param('applicantId', new ParseUuidPipe('applicantId')) id: string) { return this.service.getOutcome(user, id); }
}

@ApiTags('Applicant Admit Card')
@ApiBearerAuth('bearer')
@ApiStandardErrorResponses()
@ApiExtraModels(ApiErrorResponseDto, AdmitCardResponseDto)
@Controller('applicant/applications/:applicantId/admit-card')
export class ApplicantAdmitCardController {
  constructor(private readonly service: EntryTestService) {}
  @Get()
  @ApiParam({ name: 'applicantId', format: 'uuid' })
  @ApiOperation({ summary: 'View the signed-in applicant’s admit card after approval' })
  @ApiWrappedOkResponse(AdmitCardResponseDto)
  get(@CurrentUser() user: AuthUser, @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string) { return this.service.applicantAdmitCard(user, applicantId); }
}
