import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateTestCentreDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() intakeSessionId!: string;
  @ApiProperty({ example: 'Main Campus Test Centre' }) @IsString() @IsNotEmpty() @MaxLength(200) centreName!: string;
  @ApiProperty({ example: '1 University Road, Lahore' }) @IsString() @IsNotEmpty() @MaxLength(500) location!: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateTestCentreDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) centreName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) location?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class TestSessionDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() testCentreId!: string;
  @ApiProperty({ type: [String], format: 'uuid', description: 'One or more active programmes offered in the intake attached to this centre.', example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'] }) @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID(undefined, { each: true }) programmeIds!: string[];
  @ApiProperty({ example: '2026-11-20', format: 'date' }) @IsDateString() testDate!: string;
  @ApiProperty({ example: '08:00:00', format: 'time' }) @IsString() reportingTime!: string;
  @ApiProperty({ example: '09:00:00', format: 'time' }) @IsString() testTime!: string;
  @ApiProperty({ example: 'Hall A' }) @IsString() @IsNotEmpty() @MaxLength(100) room!: string;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1) @Max(100000) capacity?: number;
  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'], default: 'DRAFT' }) @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED']) status?: string;
}
export class UpdateTestSessionDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID() testCentreId?: string;
  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Replace the programme associations for this session.' }) @IsOptional() @IsArray() @ArrayNotEmpty() @ArrayUnique() @IsUUID(undefined, { each: true }) programmeIds?: string[];
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() testDate?: string;
  @ApiPropertyOptional({ format: 'time' }) @IsOptional() @IsString() reportingTime?: string;
  @ApiPropertyOptional({ format: 'time' }) @IsOptional() @IsString() testTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) room?: string;
  @ApiPropertyOptional({ nullable: true, minimum: 1 }) @IsOptional() @IsInt() @Min(1) @Max(100000) capacity?: number | null;
  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED'] }) @IsOptional() @IsIn(['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED']) status?: string;
}
export class MarkAttendanceDto {
  @ApiProperty({ enum: ['PRESENT', 'ABSENT'] }) @IsIn(['PRESENT', 'ABSENT']) attendanceStatus!: 'PRESENT' | 'ABSENT';
  @ApiPropertyOptional({ description: 'Must be true for PRESENT; false on identity failure.' }) @IsOptional() @IsBoolean() identityVerified?: boolean;
  @ApiPropertyOptional({ maxLength: 500, description: 'Required when identityVerified is false.' }) @ValidateIf((dto: MarkAttendanceDto) => dto.identityVerified === false) @IsString() @IsNotEmpty() @MaxLength(500) verificationFailureReason?: string;
}
export class RecordOutcomeDto {
  @ApiProperty({ example: 'PASS', description: 'Institution-defined outcome category.' }) @IsString() @IsNotEmpty() @MaxLength(50) outcomeStatus!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) outcomeDetails?: string;
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() outcomeDate?: string;
}
export class TestCentreResponseDto extends CreateTestCentreDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
export class TestSessionResponseDto extends TestSessionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) tenantId!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
export class AdmitCardResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() applicantName!: string;
  @ApiProperty() fatherGuardianName!: string;
  @ApiProperty() gender!: string;
  @ApiProperty() intakeSession!: string;
  @ApiProperty() programmeOptions!: Array<{ preferenceOrder: number; programmeId: string; programmeCode: string; programmeName: string }>;
  @ApiProperty() testVenue!: string;
  @ApiProperty() testDate!: string;
  @ApiProperty() reportingTime!: string;
  @ApiProperty() testTime!: string;
  @ApiProperty() room!: string;
  @ApiProperty() issueDate!: string;
  @ApiProperty() instructions!: string;
  @ApiProperty() status!: string;
  @ApiProperty() qrUrl!: string;
  @ApiProperty() publishedAt!: Date;
}
export class AttendanceResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty() attendanceStatus!: string;
  @ApiPropertyOptional({ nullable: true }) identityVerified!: boolean | null;
  @ApiPropertyOptional({ nullable: true }) verificationFailureReason!: string | null;
  @ApiProperty() scanCount!: number;
  @ApiPropertyOptional({ nullable: true }) firstScannedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) lastScannedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) markedBy!: string | null;
  @ApiPropertyOptional({ nullable: true }) markedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) resultAwaitedAt!: Date | null;
}

export class AttendanceQrResponseDto {
  @ApiProperty({ example: 'SCANNED', enum: ['SCANNED', 'ALREADY_ATTENDED'] }) scanStatus!: string;
  @ApiProperty({ type: AdmitCardResponseDto }) card!: AdmitCardResponseDto;
  @ApiProperty({ type: AttendanceResponseDto, nullable: true }) attendance!: AttendanceResponseDto | null;
}

export class AttendanceScanAuditDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['SCANNED', 'ALREADY_ATTENDED', 'INVALID', 'EXPIRED'] }) scanStatus!: string;
  @ApiProperty() scannedAt!: Date;
  @ApiProperty({ format: 'uuid' }) scannedBy!: string;
  @ApiPropertyOptional({ nullable: true }) ipAddress!: string | null;
  @ApiPropertyOptional({ nullable: true }) userAgent!: string | null;
}

export class AttendanceDecisionAuditDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ nullable: true }) fromStatus!: string | null;
  @ApiProperty() toStatus!: string;
  @ApiPropertyOptional({ nullable: true }) identityVerified!: boolean | null;
  @ApiPropertyOptional({ nullable: true }) reason!: string | null;
  @ApiProperty() actedAt!: Date;
  @ApiProperty({ format: 'uuid' }) actedBy!: string;
}

export class AttendanceAuditResponseDto {
  @ApiPropertyOptional({ type: AttendanceResponseDto, nullable: true }) attendance!: AttendanceResponseDto | null;
  @ApiProperty({ type: [AttendanceScanAuditDto] }) scans!: AttendanceScanAuditDto[];
  @ApiProperty({ type: [AttendanceDecisionAuditDto] }) decisions!: AttendanceDecisionAuditDto[];
  @ApiPropertyOptional() applicationId?: string;
}

export class EntryTestOutcomeResponseDto extends RecordOutcomeDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) applicantId!: string;
  @ApiProperty() applicationId!: string;
  @ApiProperty({ format: 'uuid' }) attendanceId!: string;
  @ApiProperty({ format: 'uuid' }) recordedBy!: string;
  @ApiProperty() recordedAt!: Date;
}
