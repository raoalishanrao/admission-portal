import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
} from 'class-validator';
import { AtLeastOneOfConstraint } from '../../../common/validators/intake.validators.js';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return typeof value === 'string' ? value.trim() : value;
};

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Pakistani mobile: +92XXXXXXXXXX or 03XXXXXXXXX */
const MOBILE_PATTERN = /^(?:\+92|0)3\d{9}$/;
const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;

export class RegisterApplicantDto {
  @ApiProperty({
    description: 'Published intake UUID',
    example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  })
  @Transform(trimString)
  @IsUUID(undefined, { message: 'intakeSessionId must be a valid UUID' })
  intakeSessionId!: string;

  @ApiProperty({ example: 'Muhammad Ahmed', minLength: 2, maxLength: 150 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  applicantName!: string;

  @ApiProperty({ example: 'muhammad.ahmed@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(255)
  registeredEmail!: string;

  @ApiPropertyOptional({
    description: 'Pakistani CNIC (#####-#######-#). Optional if passportNumber is provided.',
    example: '35202-1234567-1',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @Matches(CNIC_PATTERN, {
    message: 'cnicNumber must match #####-#######-#',
  })
  cnicNumber?: string;

  @ApiPropertyOptional({
    description: 'Passport number. Optional if cnicNumber is provided.',
    example: 'AB1234567',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  passportNumber?: string;

  @ApiHideProperty()
  @Allow()
  @Validate(AtLeastOneOfConstraint, ['cnicNumber', 'passportNumber'], {
    message: 'Either cnicNumber or passportNumber is required',
  })
  private readonly _identityCheck = true;

  @ApiProperty({
    example: '+923001234567',
    description: 'Mobile in +923XXXXXXXXX or 03XXXXXXXXX format',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/[\s-]/g, '') : value,
  )
  @IsString()
  @Matches(MOBILE_PATTERN, {
    message:
      'mobileNumber must be a valid Pakistani mobile (+923XXXXXXXXX or 03XXXXXXXXX)',
  })
  mobileNumber!: string;
}

export class SetApplicantPasswordDto {
  @ApiProperty({
    description: 'IAM invitation token from the verification email link',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    description:
      'Plain password (8–128 chars, at least one uppercase letter and one number)',
    example: 'Welcome1',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must include at least 1 uppercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must include at least 1 number',
  })
  @Matches(/[A-Za-z]/, {
    message: 'Password must include letters',
  })
  password!: string;
}

export class RegistrationResponseDto {
  @ApiProperty({ description: 'Applicant ID (applications.id)' })
  applicantId!: string;

  @ApiProperty({ description: 'Business application ID', example: '1000001' })
  applicationId!: string;

  @ApiProperty({ example: 'NUKTA-1000001' })
  applicationReference!: string;

  @ApiProperty()
  intakeSessionId!: string;

  @ApiProperty({ example: 'REGISTERED' })
  applicationStatus!: string;

  @ApiProperty({ example: 0 })
  overallCompletion!: number;

  @ApiProperty({
    description: 'IAM onboard status (INVITED | ACCESS_GRANTED)',
  })
  iamOnboardStatus!: string;

  @ApiProperty({
    description: 'Whether the verification email was dispatched successfully',
  })
  verificationEmailSent!: boolean;

  @ApiPropertyOptional({
    description:
      'IAM invitation token when returned by onboard. Lets the client set a password in the same session without waiting for email.',
  })
  invitationToken?: string;
}

export class SetApplicantPasswordResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    example: true,
    description: 'Account verified and password set via IAM accept-invitation',
  })
  verified!: boolean;

  @ApiPropertyOptional({
    description: 'Bound applicant_id when an application row was matched',
  })
  applicantId?: string;
}
