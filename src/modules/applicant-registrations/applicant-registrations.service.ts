import {
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AccountStatus,
  ApplicationStatus,
} from '../../common/enums/application-status.enum.js';
import { IntakeStatus } from '../../common/enums/intake-status.enum.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { applicantPortalLink } from '../../common/utils/applicant-portal-url.util.js';
import { assertPasswordStrength } from '../../common/utils/password.util.js';
import { ApplicationEntity } from '../../database/entities/application.entity.js';
import { IntakeEntity } from '../../database/entities/intake.entity.js';
import { IamApplicantRegistrationService } from '../../integrations/base-platform/iam/iam-applicant-registration.service.js';
import {
  EMAIL_SENDER,
  type EmailSender,
} from '../../integrations/email/email-sender.interface.js';
import type {
  RegisterApplicantDto,
  RegistrationResponseDto,
  SetApplicantPasswordDto,
  SetApplicantPasswordResponseDto,
} from './dto/applicant-registration.dto.js';
import {
  buildApplicationReference,
  normalizeEmail,
  resolveIdentityFields,
} from './utils/registration.util.js';

@Injectable()
export class ApplicantRegistrationsService {
  private readonly logger = new Logger(ApplicantRegistrationsService.name);

  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepo: Repository<ApplicationEntity>,
    @InjectRepository(IntakeEntity)
    private readonly intakesRepo: Repository<IntakeEntity>,
    private readonly iamRegistration: IamApplicantRegistrationService,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterApplicantDto): Promise<RegistrationResponseDto> {
    const tenantId = this.defaultTenantId();
    const email = normalizeEmail(dto.registeredEmail);
    let identity: ReturnType<typeof resolveIdentityFields>;
    try {
      identity = resolveIdentityFields({
        cnicNumber: dto.cnicNumber,
        passportNumber: dto.passportNumber,
      });
    } catch (error) {
      throw new BusinessException(
        error instanceof Error
          ? error.message
          : 'Either cnicNumber or passportNumber is required',
        HttpStatus.BAD_REQUEST,
        'INVALID_IDENTITY',
      );
    }

    await this.assertPublishedOpenIntake(tenantId, dto.intakeSessionId);
    await this.assertUniqueForIntake(
      tenantId,
      dto.intakeSessionId,
      email,
      identity.normalizedIdentity,
    );

    // IAM invite with sendEmail:false — portal sends verification email (alumni pattern).
    const onboard = await this.iamRegistration.onboardApplicantMember(
      tenantId,
      {
        email,
        fullName: dto.applicantName,
        isDefault: true,
      },
    );

    const prefix =
      this.config.get<string>('APPLICATION_REFERENCE_PREFIX')?.trim() ||
      'NUKTA';

    const saved = await this.dataSource.transaction(async (manager) => {
      const rows = (await manager.query(
        `SELECT nextval('applications_application_id_seq') AS nextval`,
      )) as Array<{ nextval: string | number }>;
      const applicationId = String(rows[0]?.nextval);
      if (!applicationId || applicationId === 'undefined') {
        throw new BusinessException(
          'Failed to allocate application id',
          HttpStatus.INTERNAL_SERVER_ERROR,
          'APPLICATION_ID_ALLOC_FAILED',
        );
      }

      const entity = manager.create(ApplicationEntity, {
        tenantId,
        applicationId,
        applicationReference: buildApplicationReference(prefix, applicationId),
        intakeId: dto.intakeSessionId,
        applicantName: dto.applicantName.trim(),
        registeredEmail: email,
        normalizedEmail: email,
        cnicNumber: identity.cnicNumber,
        passportNumber: identity.passportNumber,
        normalizedIdentity: identity.normalizedIdentity,
        mobileNumber: dto.mobileNumber,
        applicationStatus: ApplicationStatus.REGISTERED,
        overallCompletion: 0,
        registrationDate: new Date(),
        accountStatus: AccountStatus.ACTIVE,
        iamUserId: onboard.userId ?? null,
      });

      return manager.save(entity);
    });

    let verificationEmailSent = false;
    if (onboard.invitationToken) {
      try {
        const verificationLink = applicantPortalLink('/set-password', {
          token: onboard.invitationToken,
        });
        await this.emailSender.sendVerificationEmail({
          to: email,
          fullName: saved.applicantName,
          verificationLink,
          applicationId: String(saved.applicationId),
          applicationReference: saved.applicationReference,
        });
        verificationEmailSent = true;
      } catch (error) {
        // Alumni pattern: email failure must not roll back registration.
        this.logger.error(
          `VERIFICATION_EMAIL_FAILED reference=${saved.applicationReference}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    this.logger.log(
      `REGISTRATION_OK applicantId=${saved.id} applicationId=${saved.applicationId} iam=${onboard.status} emailSent=${verificationEmailSent}`,
    );

    return {
      applicantId: String(saved.id),
      applicationId: String(saved.applicationId),
      applicationReference: saved.applicationReference,
      intakeSessionId: String(saved.intakeId),
      applicationStatus: saved.applicationStatus,
      overallCompletion: saved.overallCompletion,
      iamOnboardStatus: onboard.status,
      verificationEmailSent,
      invitationToken: onboard.invitationToken,
    };
  }

  async setPassword(
    dto: SetApplicantPasswordDto,
  ): Promise<SetApplicantPasswordResponseDto> {
    const raw = dto.token.trim();
    if (!raw || raw.length < 16) {
      throw new BusinessException(
        'Invalid or expired verification link',
        HttpStatus.BAD_REQUEST,
        'INVALID_TOKEN',
      );
    }
    assertPasswordStrength(dto.password);

    // fullName is already on the IAM invite metadata from registration (applicantName).
    const accepted = await this.iamRegistration.acceptInvitation({
      token: raw,
      password: dto.password,
    });

    let applicantId: string | undefined;
    if (accepted.email) {
      const matchedEmail = normalizeEmail(accepted.email);
      const tenantId = this.defaultTenantId();
      const app = await this.applicationsRepo.findOne({
        where: { tenantId, normalizedEmail: matchedEmail },
        order: { registrationDate: 'DESC' },
      });
      if (app) {
        app.iamUserId = accepted.userId || app.iamUserId;
        await this.applicationsRepo.save(app);
        applicantId = String(app.id);
      }
    }

    this.logger.log(
      `APPLICANT_VERIFIED email=${accepted.email} userId=${accepted.userId} applicantId=${applicantId ?? ''}`,
    );

    return {
      userId: accepted.userId,
      email: accepted.email,
      verified: true,
      applicantId,
    };
  }

  private async assertPublishedOpenIntake(
    tenantId: string,
    intakeId: string,
  ): Promise<IntakeEntity> {
    const intake = await this.intakesRepo.findOne({
      where: { id: intakeId, tenantId },
    });
    if (!intake || intake.status !== IntakeStatus.PUBLISHED) {
      throw new BusinessException(
        'Published intake was not found or is not available for registration',
        HttpStatus.CONFLICT,
        'INTAKE_NOT_AVAILABLE',
      );
    }
    const now = Date.now();
    if (
      now < intake.applicationOpenAt.getTime() ||
      now > intake.applicationCloseAt.getTime()
    ) {
      throw new BusinessException(
        'Application window is closed or not yet open for this intake',
        HttpStatus.CONFLICT,
        'APPLICATION_WINDOW_CLOSED',
      );
    }
    return intake;
  }

  private async assertUniqueForIntake(
    tenantId: string,
    intakeId: string,
    normalizedEmail: string,
    normalizedIdentity: string,
  ): Promise<void> {
    const byEmail = await this.applicationsRepo.findOne({
      where: { tenantId, intakeId, normalizedEmail },
    });
    if (byEmail) {
      throw new ConflictException(
        'Email already registered for this intake — please sign in',
      );
    }
    const byIdentity = await this.applicationsRepo.findOne({
      where: { tenantId, intakeId, normalizedIdentity },
    });
    if (byIdentity) {
      throw new ConflictException(
        'CNIC/passport already registered for this intake',
      );
    }
  }

  private defaultTenantId(): string {
    const raw =
      this.config.get<string>('DEFAULT_TENANT_ID')?.trim() ||
      '00000000-0000-4000-8000-000000000001';
    return raw.replace(/^["']|["']$/g, '');
  }
}
