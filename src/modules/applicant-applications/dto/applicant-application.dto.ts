import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  AcademicDegreeType,
  AcademicDocumentType,
  ApplicationAddressType,
  ApplicationContactType,
  QualificationLevel,
} from '../../../common/enums/application-completion.enum.js';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Treat empty / Swagger placeholder "string" as omitted optional fields. */
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'string') return undefined;
  return trimmed;
};

/* ── Academic ─────────────────────────────────────────────────────── */

export class AcademicRecordFieldsDto {
  @ApiProperty({
    enum: AcademicDegreeType,
    example: AcademicDegreeType.FSC,
    description:
      'Controlled academic code. Bachelor programmes typically require MATRIC + FSC.',
  })
  @IsEnum(AcademicDegreeType)
  degreeType!: AcademicDegreeType;

  @ApiProperty({ example: 'BISE-LHR-2025-001234', description: 'Board/institution roll number' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  rollNumber!: string;

  @ApiProperty({ example: 'FSC Pre-Engineering' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  qualificationName!: string;

  @ApiProperty({ example: 'Board of Intermediate & Secondary Education Lahore' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  boardOrInstitution!: string;

  @ApiProperty({ example: '2025' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  passingYear!: string;

  @ApiProperty({ example: '1st' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  division!: string;

  @ApiProperty({ example: 'A' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  grade!: string;

  @ApiProperty({ example: '875' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  marksOrGpaObtained!: string;

  @ApiProperty({ example: '1100' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  marksOrGpaTotal!: string;

  @ApiProperty({ example: 79.55 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentage!: number;
}

/** POST body — create new academic records (no ids). */
export class CreateAcademicDto {
  @ApiProperty({ type: [AcademicRecordFieldsDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AcademicRecordFieldsDto)
  records!: AcademicRecordFieldsDto[];
}

export class UpdateAcademicRecordDto extends AcademicRecordFieldsDto {
  @ApiProperty({ description: 'Existing academic record UUID' })
  @IsUUID('4')
  id!: string;
}

/** PUT body — update existing academic records (ids required). */
export class UpdateAcademicDto {
  @ApiProperty({ type: [UpdateAcademicRecordDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateAcademicRecordDto)
  records!: UpdateAcademicRecordDto[];
}

export class CreateAcademicDocumentDto {
  @ApiProperty({ enum: AcademicDocumentType })
  @IsEnum(AcademicDocumentType)
  documentType!: AcademicDocumentType;
}

export class ProfilePhotographResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty({ description: 'Durable storage URL saved on the application' })
  profilePhotograph!: string;

  @ApiProperty({ description: 'Immediately usable download URL (may be signed)' })
  downloadUrl!: string;
}

export class AcademicDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  academicInformationId!: string;

  @ApiProperty({ enum: AcademicDocumentType })
  documentType!: AcademicDocumentType;

  @ApiProperty({
    description: 'Durable storage URL (private bucket — do not open directly)',
  })
  fileReference!: string;

  @ApiProperty({
    description: 'Signed URL for browser access (expires; use this to view/download)',
  })
  downloadUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  originalFileName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mimeType!: string | null;

  @ApiPropertyOptional({ nullable: true })
  fileSize!: number | null;

  @ApiProperty()
  uploadedAt!: Date;

  @ApiProperty()
  verificationStatus!: string;
}

export class AcademicRecordResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: AcademicDegreeType })
  degreeType!: AcademicDegreeType;

  @ApiPropertyOptional({ nullable: true })
  rollNumber!: string | null;

  @ApiProperty()
  qualificationName!: string;

  @ApiProperty()
  boardOrInstitution!: string;

  @ApiProperty()
  passingYear!: string;

  @ApiProperty()
  division!: string;

  @ApiProperty()
  grade!: string;

  @ApiProperty()
  marksOrGpaObtained!: string;

  @ApiProperty()
  marksOrGpaTotal!: string;

  @ApiProperty()
  percentage!: number;

  @ApiProperty({ type: [AcademicDocumentResponseDto] })
  documents!: AcademicDocumentResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AcademicStepResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty()
  academicStepSaved!: boolean;

  @ApiProperty()
  overallCompletion!: number;

  @ApiProperty({ type: [AcademicRecordResponseDto] })
  records!: AcademicRecordResponseDto[];
}

/* ── Programme ────────────────────────────────────────────────────── */

export class ProgrammeOptionDto {
  @ApiProperty({ description: 'Published programme offering UUID' })
  @IsUUID('4')
  programmeOfferingId!: string;

  @ApiProperty({
    description:
      'Preference order starting at 1 (max from APPLICATION_MAX_PROGRAMME_PREFERENCES)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  preferenceOrder!: number;
}

export class CreateProgrammeDto {
  @ApiProperty({ enum: QualificationLevel })
  @IsEnum(QualificationLevel)
  qualificationLevel!: QualificationLevel;

  @ApiProperty({
    type: [ProgrammeOptionDto],
    description:
      'Preference 1 is mandatory. Additional preferences allowed up to APPLICATION_MAX_PROGRAMME_PREFERENCES (default 2).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProgrammeOptionDto)
  options!: ProgrammeOptionDto[];
}

export class UpdateProgrammeDto extends CreateProgrammeDto {}

export class ProgrammeOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  programmeOfferingId!: string;

  @ApiProperty()
  preferenceOrder!: number;
}

export class ProgrammeStepResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty()
  intakeSessionId!: string;

  @ApiPropertyOptional({ enum: QualificationLevel, nullable: true })
  qualificationLevel!: QualificationLevel | null;

  @ApiPropertyOptional({ nullable: true })
  appliedDate!: Date | null;

  @ApiProperty()
  stepSaved!: boolean;

  @ApiPropertyOptional({ nullable: true })
  savedAt!: Date | null;

  @ApiProperty({ type: [ProgrammeOptionResponseDto] })
  options!: ProgrammeOptionResponseDto[];

  @ApiProperty()
  programmeStepSaved!: boolean;

  @ApiProperty()
  overallCompletion!: number;
}

/* ── Addresses ────────────────────────────────────────────────────── */

export class AddressFieldsDto {
  @ApiProperty({ enum: ApplicationAddressType })
  @IsEnum(ApplicationAddressType)
  addressType!: ApplicationAddressType;

  @ApiProperty({ example: 'House 25, Street 12, Johar Town' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiProperty({ example: 'PK' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  countryId!: string;

  @ApiProperty({ example: 'PK-PB' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  provinceId!: string;

  @ApiProperty({ example: 'PK-PB-LHE' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cityId!: string;

  @ApiPropertyOptional({ example: '54782' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSameAsPrimary?: boolean;
}

export class CreateAddressesDto {
  @ApiProperty({ type: [AddressFieldsDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddressFieldsDto)
  addresses!: AddressFieldsDto[];
}

export class UpdateAddressDto extends AddressFieldsDto {
  @ApiProperty()
  @IsUUID('4')
  id!: string;
}

export class UpdateAddressesDto {
  @ApiProperty({ type: [UpdateAddressDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateAddressDto)
  addresses!: UpdateAddressDto[];
}

export class ApplicationAddressResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ApplicationAddressType })
  addressType!: ApplicationAddressType;

  @ApiProperty()
  addressLine1!: string;

  @ApiPropertyOptional({ nullable: true })
  addressLine2!: string | null;

  @ApiProperty()
  countryId!: string;

  @ApiProperty()
  provinceId!: string;

  @ApiProperty()
  cityId!: string;

  @ApiPropertyOptional({ nullable: true })
  postalCode!: string | null;

  @ApiProperty()
  isSameAsPrimary!: boolean;
}

/* ── Contacts ─────────────────────────────────────────────────────── */

/** Swagger / docs example — includes required EMERGENCY contact. */
export const CONTACTS_REQUEST_EXAMPLE = {
  contacts: [
    {
      contactType: 'PARENT',
      name: 'Muhammad Aslam',
      identityDocumentNumber: '35202-7654321-1',
      relationship: 'FATHER',
      occupation: 'Business',
      mobileNumber: '+923007654321',
    },
    {
      contactType: 'EMERGENCY',
      name: 'Ali Khan',
      relationship: 'BROTHER',
      mobileNumber: '+923001112233',
    },
  ],
};

export class ContactFieldsDto {
  @ApiProperty({ enum: ApplicationContactType, example: 'PARENT' })
  @IsEnum(ApplicationContactType)
  contactType!: ApplicationContactType;

  @ApiProperty({ example: 'Muhammad Aslam' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: '35202-7654321-1' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  identityDocumentNumber?: string;

  @ApiProperty({ example: 'FATHER' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  relationship!: string;

  @ApiPropertyOptional({ example: 'Business' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @ApiProperty({ example: '+923007654321' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  mobileNumber!: string;

  @ApiPropertyOptional({ example: '042-1234567' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @ApiPropertyOptional({ example: 'aslam.ahmed@example.com' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'House 25, Street 12, Johar Town, Lahore' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  addressLine?: string;
}

export class CreateContactsDto {
  @ApiProperty({
    type: [ContactFieldsDto],
    example: CONTACTS_REQUEST_EXAMPLE.contacts,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContactFieldsDto)
  contacts!: ContactFieldsDto[];
}

export class UpdateContactDto extends ContactFieldsDto {
  @ApiProperty()
  @IsUUID('4')
  id!: string;
}

export class UpdateContactsDto {
  @ApiProperty({ type: [UpdateContactDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateContactDto)
  contacts!: UpdateContactDto[];
}

export class ApplicationContactResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ApplicationContactType })
  contactType!: ApplicationContactType;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  identityDocumentNumber!: string | null;

  @ApiProperty()
  relationship!: string;

  @ApiPropertyOptional({ nullable: true })
  occupation!: string | null;

  @ApiProperty()
  mobileNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  telephone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressLine!: string | null;
}

/* ── Profile ──────────────────────────────────────────────────────── */

export class ProfileFieldsDto {
  @ApiProperty({ example: 'Muhammad Ahmed' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  applicantName!: string;

  @ApiProperty({ example: 'MALE' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  gender!: string;

  @ApiProperty({ example: 'SINGLE' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  maritalStatus!: string;

  @ApiProperty({ example: '2005-04-12' })
  @IsDateString()
  dateOfBirth!: string;

  @ApiProperty({ example: '+923001234567' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  mobileNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  telephone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  profilePhotograph?: string;

  @ApiProperty({ example: 'PK' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  primaryNationalityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10)
  secondaryNationalityId?: string;

  @ApiPropertyOptional({ example: 'PK-PB-LHE' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  domicileId?: string;

  @ApiProperty()
  @IsBoolean()
  disabilityDeclared!: boolean;

  @ApiPropertyOptional({ example: 'FRIEND' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(50)
  referralSource?: string;
}

export class CreateProfileDto extends ProfileFieldsDto {}

export class UpdateProfileDto extends ProfileFieldsDto {}

export class ProfileStepResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty()
  applicantName!: string;

  @ApiPropertyOptional({ nullable: true })
  gender!: string | null;

  @ApiPropertyOptional({ nullable: true })
  maritalStatus!: string | null;

  @ApiPropertyOptional({ nullable: true })
  dateOfBirth!: string | null;

  @ApiProperty()
  mobileNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  telephone!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Durable profile photo URL on applications.profile_photograph (linked via applicant id)',
  })
  profilePhotograph!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed URL for viewing the profile photograph',
  })
  profilePhotographDownloadUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  primaryNationalityId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  secondaryNationalityId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  domicileId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  disabilityDeclared!: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  referralSource!: string | null;

  @ApiProperty({
    type: [ApplicationAddressResponseDto],
    description: 'Loaded from application_addresses (separate addresses APIs)',
  })
  addresses!: ApplicationAddressResponseDto[];

  @ApiProperty({
    type: [ApplicationContactResponseDto],
    description: 'Loaded from application_contacts (separate contacts APIs)',
  })
  contacts!: ApplicationContactResponseDto[];

  @ApiProperty()
  profileStepSaved!: boolean;

  @ApiProperty()
  overallCompletion!: number;
}

/* ── Declaration / Submit ─────────────────────────────────────────── */

export class OfferingDeclarationForApplicantDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  programmeOfferingId!: string;

  @ApiProperty()
  declarationTypeId!: string;

  @ApiProperty()
  declarationText!: string;

  @ApiProperty()
  version!: string;
}

export class CreateDeclarationDto {
  @ApiProperty({
    description:
      'Must be true — applicant accepts the offering declaration text(s) listed by GET .../declaration/texts',
  })
  @IsBoolean()
  declarationAccepted!: boolean;

  @ApiPropertyOptional({
    type: [String],
    description:
      'IDs of ACTIVE offering_declarations for the selected programme offerings that the applicant accepts. May be empty when no offering declarations apply.',
    example: ['cccccccc-cccc-4ccc-8ccc-ccccccccccc1'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  acceptedOfferingDeclarationIds?: string[];

  @ApiProperty()
  @IsBoolean()
  disciplinaryIssueDeclared!: boolean;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateDeclarationDto) => o.disciplinaryIssueDeclared === true)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  disciplinaryIssueDetails?: string;
}

export class UpdateDeclarationDto extends CreateDeclarationDto {}

export class DeclarationStepResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty()
  declarationAccepted!: boolean;

  @ApiPropertyOptional({ nullable: true })
  declarationAcceptanceDate!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  declarationVersion!: string | null;

  @ApiProperty({ type: [String] })
  acceptedOfferingDeclarationIds!: string[];

  @ApiProperty()
  disciplinaryIssueDeclared!: boolean;

  @ApiPropertyOptional({ nullable: true })
  disciplinaryIssueDetails!: string | null;

  @ApiPropertyOptional({ nullable: true })
  submissionDate!: Date | null;

  @ApiProperty()
  declarationStepSaved!: boolean;

  @ApiProperty()
  overallCompletion!: number;

  @ApiProperty()
  applicationStatus!: string;
}

export class SubmitApplicationResponseDto {
  @ApiProperty()
  applicantId!: string;

  @ApiProperty()
  applicationStatus!: string;

  @ApiProperty()
  overallCompletion!: number;

  @ApiProperty()
  submissionDate!: Date;
}
