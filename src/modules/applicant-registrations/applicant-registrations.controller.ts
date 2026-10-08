import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardErrorResponses,
  ApiWrappedCreatedResponse,
  ApiWrappedOkArrayResponse,
} from '../../common/decorators/api-docs.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { ApplicantRegistrationsService } from './applicant-registrations.service.js';
import {
  ApplicantOwnedApplicationDto,
  RegisterApplicantDto,
  RegistrationResponseDto,
  SetApplicantPasswordDto,
  SetApplicantPasswordResponseDto,
} from './dto/applicant-registration.dto.js';

@ApiTags('Applicant Registration')
@ApiExtraModels(
  RegisterApplicantDto,
  RegistrationResponseDto,
  SetApplicantPasswordDto,
  SetApplicantPasswordResponseDto,
  ApplicantOwnedApplicationDto,
  ApiErrorResponseDto,
)
@ApiStandardErrorResponses()
@Controller('applicants/applications')
export class ApplicantRegistrationsController {
  constructor(
    private readonly registrationsService: ApplicantRegistrationsService,
  ) {}

  @Public()
  @Post('registrations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a prospective applicant',
    description:
      'Creates one `applications` row for a published intake, onboards the email in Base IAM ' +
      '(invitation; IAM does not send mail), then emails a verification link. ' +
      'Complete verification with `POST /applicants/applications/auth/set-password`.',
  })
  @ApiBody({
    type: RegisterApplicantDto,
    examples: {
      withCnic: {
        summary: 'Register with CNIC (passport optional)',
        value: {
          intakeSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          applicantName: 'Muhammad Ahmed',
          registeredEmail: 'muhammad.ahmed@example.com',
          cnicNumber: '35202-1234567-1',
          mobileNumber: '+923001234567',
        },
      },
      withPassport: {
        summary: 'Register with passport (CNIC optional)',
        value: {
          intakeSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          applicantName: 'John Smith',
          registeredEmail: 'john.smith@example.com',
          passportNumber: 'AB1234567',
          mobileNumber: '+923001234567',
        },
      },
    },
  })
  @ApiWrappedCreatedResponse(RegistrationResponseDto, 'Applicant registered')
  register(
    @Body() dto: RegisterApplicantDto,
  ): Promise<RegistrationResponseDto> {
    return this.registrationsService.register(dto);
  }

  @Public()
  @Post('auth/set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify account and set password',
    description:
      'Accepts the IAM invitation token from the verification email, sets the password, ' +
      'and binds `iam_user_id` on the application. Name comes from registration (IAM invite metadata) — not required here.',
  })
  @ApiBody({
    type: SetApplicantPasswordDto,
    examples: {
      default: {
        value: {
          token: 'invitation-token-from-email',
          password: 'Welcome1',
        },
      },
    },
  })
  @ApiWrappedCreatedResponse(
    SetApplicantPasswordResponseDto,
    'Account verified and password set',
  )
  setPassword(
    @Body() dto: SetApplicantPasswordDto,
  ): Promise<SetApplicantPasswordResponseDto> {
    return this.registrationsService.setPassword(dto);
  }
}

@ApiTags('Applicant Registration')
@ApiBearerAuth('bearer')
@ApiExtraModels(ApplicantOwnedApplicationDto, ApiErrorResponseDto)
@ApiStandardErrorResponses()
@Controller('applicants/me')
export class ApplicantMeController {
  constructor(
    private readonly registrationsService: ApplicantRegistrationsService,
  ) {}

  @Get('applications')
  @ApiOperation({
    summary: 'List applications owned by the signed-in applicant',
    description:
      'Returns applications bound to the current IAM user. Used by My Application after login.',
  })
  @ApiWrappedOkArrayResponse(ApplicantOwnedApplicationDto)
  listMine(@CurrentUser() user: AuthUser): Promise<ApplicantOwnedApplicationDto[]> {
    return this.registrationsService.listMine(user);
  }
}
