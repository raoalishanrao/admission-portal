import {
  Body,
  Controller,
  Delete,
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
  ApiWrappedOkArrayResponse,
  ApiWrappedOkResponse,
} from '../../common/decorators/api-docs.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { ApiErrorResponseDto } from '../../common/dto/api-response.dto.js';
import { AcademicDocumentType } from '../../common/enums/application-completion.enum.js';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import { ApplicantApplicationsService } from './applicant-applications.service.js';
import type { UploadedFileInput } from './applicant-applications.service.js';
import {
  ApplicantRequiredAcademicLevelsResponseDto,
} from '../academic-level-requirements/dto/academic-level-requirement.dto.js';
import {
  AcademicDocumentResponseDto,
  AcademicStepResponseDto,
  ApplicationAddressResponseDto,
  ApplicationContactResponseDto,
  CreateAcademicDto,
  CreateAddressesDto,
  CreateContactsDto,
  CreateDeclarationDto,
  CreateProgrammeDto,
  CreateProfileDto,
  DeclarationStepResponseDto,
  OfferingDeclarationForApplicantDto,
  ProgrammeStepResponseDto,
  ProfilePhotographResponseDto,
  ProfileStepResponseDto,
  SubmitApplicationResponseDto,
  UpdateAcademicDto,
  UpdateAddressesDto,
  UpdateContactsDto,
  UpdateDeclarationDto,
  UpdateProgrammeDto,
  UpdateProfileDto,
} from './dto/applicant-application.dto.js';

@ApiTags('Applicants Applications')
@ApiBearerAuth()
@ApiExtraModels(
  AcademicStepResponseDto,
  AcademicDocumentResponseDto,
  ProfilePhotographResponseDto,
  CreateAcademicDto,
  UpdateAcademicDto,
  CreateProgrammeDto,
  UpdateProgrammeDto,
  CreateProfileDto,
  UpdateProfileDto,
  CreateAddressesDto,
  UpdateAddressesDto,
  CreateContactsDto,
  UpdateContactsDto,
  CreateDeclarationDto,
  UpdateDeclarationDto,
  ProgrammeStepResponseDto,
  ProfilePhotographResponseDto,
  ProfileStepResponseDto,
  OfferingDeclarationForApplicantDto,
  ApplicationAddressResponseDto,
  ApplicationContactResponseDto,
  DeclarationStepResponseDto,
  SubmitApplicationResponseDto,
  ApplicantRequiredAcademicLevelsResponseDto,
  ApiErrorResponseDto,
)
@ApiStandardErrorResponses()
@ApiParam({ name: 'applicantId', description: 'Application UUID (applicant_id)' })
@Controller('applicants/applications/:applicantId')
export class ApplicantApplicationsController {
  constructor(
    private readonly applicationsService: ApplicantApplicationsService,
  ) {}

  @Get('academic')
  @ApiOperation({
    summary: 'Get academic information and documents',
    description:
      'Academic documents are linked via academicInformationId → application_academic_documents. ' +
      'degreeType must be a controlled code: MATRIC, FSC, BACHELOR, MASTER, DOCTORATE.',
  })
  @ApiWrappedOkResponse(AcademicStepResponseDto, 'Academic step')
  getAcademic(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<AcademicStepResponseDto> {
    return this.applicationsService.getAcademic(user, applicantId);
  }

  @Get('academic/required-levels')
  @ApiOperation({
    summary: 'Get required academic levels for selected programmes',
    description:
      'Resolves programme degree_level (Bachelor/Master/Doctorate) to configured required ' +
      'academic codes (e.g. Bachelor → MATRIC + FSC) and reports any missing rows.',
  })
  @ApiWrappedOkResponse(
    ApplicantRequiredAcademicLevelsResponseDto,
    'Required academic levels',
  )
  getRequiredAcademicLevels(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<ApplicantRequiredAcademicLevelsResponseDto> {
    return this.applicationsService.getRequiredAcademicLevels(user, applicantId);
  }

  @Post('academic')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or append academic information',
    description:
      'One record per degreeType code (MATRIC, FSC, …). First call creates the academic step; ' +
      'later calls append additional unique degree types. Use PUT to edit existing rows. ' +
      'If programmes are already selected, mandatory academic levels must be present after save.',
  })
  @ApiWrappedCreatedResponse(AcademicStepResponseDto, 'Academic records created')
  createAcademic(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: CreateAcademicDto,
  ): Promise<AcademicStepResponseDto> {
    return this.applicationsService.createAcademic(user, applicantId, dto);
  }

  @Put('academic')
  @ApiOperation({
    summary: 'Update academic information',
    description:
      'Updates existing academic rows by id. degreeType codes must remain unique per application.',
  })
  @ApiWrappedOkResponse(AcademicStepResponseDto, 'Academic records updated')
  updateAcademic(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: UpdateAcademicDto,
  ): Promise<AcademicStepResponseDto> {
    return this.applicationsService.updateAcademic(user, applicantId, dto);
  }

  @Post('academic/:academicInformationId/documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload academic document',
    description:
      'Multipart upload to Backblaze B2 (or local storage). Field `file` + `documentType`. ' +
      'Response includes `downloadUrl` (signed) for immediate viewing; do not open `fileReference` directly on a private bucket.',
  })
  @ApiParam({ name: 'academicInformationId', description: 'Academic record UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentType: {
          type: 'string',
          enum: Object.values(AcademicDocumentType),
        },
      },
    },
  })
  @ApiWrappedCreatedResponse(
    AcademicDocumentResponseDto,
    'Academic document uploaded',
  )
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Param('academicInformationId', new ParseUuidPipe('academicInformationId'))
    academicInformationId: string,
    @UploadedFile() file: UploadedFileInput,
    @Body('documentType') documentType: AcademicDocumentType,
  ): Promise<AcademicDocumentResponseDto> {
    return this.applicationsService.uploadAcademicDocument(
      user,
      applicantId,
      academicInformationId,
      documentType,
      file,
    );
  }

  @Get('academic/:academicInformationId/documents/:documentId')
  @ApiOperation({
    summary: 'Get academic document with a fresh signed download URL',
  })
  @ApiParam({ name: 'academicInformationId', description: 'Academic record UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiWrappedOkResponse(AcademicDocumentResponseDto, 'Academic document')
  getDocument(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Param('academicInformationId', new ParseUuidPipe('academicInformationId'))
    academicInformationId: string,
    @Param('documentId', new ParseUuidPipe('documentId')) documentId: string,
  ): Promise<AcademicDocumentResponseDto> {
    return this.applicationsService.getAcademicDocument(
      user,
      applicantId,
      academicInformationId,
      documentId,
    );
  }

  @Delete('academic/:academicInformationId/documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove academic document before submission' })
  @ApiParam({ name: 'academicInformationId', description: 'Academic record UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  async deleteDocument(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Param('academicInformationId', new ParseUuidPipe('academicInformationId'))
    academicInformationId: string,
    @Param('documentId', new ParseUuidPipe('documentId')) documentId: string,
  ): Promise<{ deleted: true; id: string }> {
    await this.applicationsService.deleteAcademicDocument(
      user,
      applicantId,
      academicInformationId,
      documentId,
    );
    return { deleted: true, id: documentId };
  }

  @Get('programme')
  @ApiOperation({ summary: 'Get programme selection and preferences' })
  @ApiWrappedOkResponse(ProgrammeStepResponseDto, 'Programme step')
  getProgramme(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<ProgrammeStepResponseDto> {
    return this.applicationsService.getProgramme(user, applicantId);
  }

  @Post('programme')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create programme selection and preferences',
    description:
      'Preference 1 required. Max preferences from APPLICATION_MAX_PROGRAMME_PREFERENCES (default 2, min 2). ' +
      'Required academic levels are validated on the Academic step and at submit, not here.',
  })
  @ApiWrappedCreatedResponse(ProgrammeStepResponseDto, 'Programme created')
  createProgramme(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: CreateProgrammeDto,
  ): Promise<ProgrammeStepResponseDto> {
    return this.applicationsService.createProgramme(user, applicantId, dto);
  }

  @Put('programme')
  @ApiOperation({
    summary: 'Update programme selection and preferences',
    description:
      'Required academic levels are validated on the Academic step and at submit, not here.',
  })
  @ApiWrappedOkResponse(ProgrammeStepResponseDto, 'Programme updated')
  updateProgramme(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: UpdateProgrammeDto,
  ): Promise<ProgrammeStepResponseDto> {
    return this.applicationsService.updateProgramme(user, applicantId, dto);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get personal profile (+ linked addresses/contacts)',
    description:
      'Profile fields live on applications. Addresses/contacts are separate tables/APIs; GET includes them for convenience. Photograph: POST .../profile/photograph → applications.profile_photograph.',
  })
  @ApiWrappedOkResponse(ProfileStepResponseDto, 'Profile step')
  getProfile(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<ProfileStepResponseDto> {
    return this.applicationsService.getProfile(user, applicantId);
  }

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create personal profile fields',
    description:
      'Body is personal fields only. Save PRIMARY address (/addresses) and EMERGENCY contact (/contacts) first.',
  })
  @ApiWrappedCreatedResponse(ProfileStepResponseDto, 'Profile created')
  createProfile(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: CreateProfileDto,
  ): Promise<ProfileStepResponseDto> {
    return this.applicationsService.createProfile(user, applicantId, dto);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update personal profile fields' })
  @ApiWrappedOkResponse(ProfileStepResponseDto, 'Profile updated')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileStepResponseDto> {
    return this.applicationsService.updateProfile(user, applicantId, dto);
  }

  @Post('profile/photograph')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload profile photograph',
    description:
      'Multipart image upload (JPEG/PNG/WEBP, max 5MB) to Backblaze B2. Updates `profilePhotograph` on the application.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiWrappedCreatedResponse(
    ProfilePhotographResponseDto,
    'Profile photograph uploaded',
  )
  @UseInterceptors(FileInterceptor('file'))
  uploadPhotograph(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @UploadedFile() file: UploadedFileInput,
  ): Promise<ProfilePhotographResponseDto> {
    return this.applicationsService.uploadProfilePhotograph(
      user,
      applicantId,
      file,
    );
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Get application addresses' })
  @ApiWrappedOkArrayResponse(ApplicationAddressResponseDto, 'Addresses')
  getAddresses(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<ApplicationAddressResponseDto[]> {
    return this.applicationsService.getAddresses(user, applicantId);
  }

  @Post('addresses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create application addresses' })
  @ApiWrappedCreatedResponse(ApplicationAddressResponseDto, 'Addresses created')
  createAddresses(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: CreateAddressesDto,
  ): Promise<ApplicationAddressResponseDto[]> {
    return this.applicationsService.createAddresses(user, applicantId, dto);
  }

  @Put('addresses')
  @ApiOperation({ summary: 'Update application addresses' })
  @ApiWrappedOkArrayResponse(ApplicationAddressResponseDto, 'Addresses updated')
  updateAddresses(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: UpdateAddressesDto,
  ): Promise<ApplicationAddressResponseDto[]> {
    return this.applicationsService.updateAddresses(user, applicantId, dto);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Get parent/guardian/emergency contacts' })
  @ApiWrappedOkArrayResponse(ApplicationContactResponseDto, 'Contacts')
  getContacts(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<ApplicationContactResponseDto[]> {
    return this.applicationsService.getContacts(user, applicantId);
  }

  @Post('contacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create parent/guardian/emergency contacts',
    description:
      'Create one or more contacts. Profile completion requires both a PARENT/GUARDIAN and an EMERGENCY contact (blood relation other than FATHER/GUARDIAN). Example body shows the required pair.',
  })
  @ApiBody({
    type: CreateContactsDto,
    examples: {
      parentAndEmergency: {
        summary: 'Parent + emergency (required before profile complete)',
        value: {
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
        },
      },
    },
  })
  @ApiWrappedCreatedResponse(ApplicationContactResponseDto, 'Contacts created')
  createContacts(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: CreateContactsDto,
  ): Promise<ApplicationContactResponseDto[]> {
    return this.applicationsService.createContacts(user, applicantId, dto);
  }

  @Put('contacts')
  @ApiOperation({ summary: 'Update parent/guardian/emergency contacts' })
  @ApiBody({
    type: UpdateContactsDto,
    examples: {
      updateBoth: {
        summary: 'Update contacts by id',
        value: {
          contacts: [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
              contactType: 'PARENT',
              name: 'Muhammad Aslam',
              identityDocumentNumber: '35202-7654321-1',
              relationship: 'FATHER',
              occupation: 'Business',
              mobileNumber: '+923007654321',
            },
            {
              id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
              contactType: 'EMERGENCY',
              name: 'Ali Khan',
              relationship: 'BROTHER',
              mobileNumber: '+923001112233',
            },
          ],
        },
      },
    },
  })
  @ApiWrappedOkArrayResponse(ApplicationContactResponseDto, 'Contacts updated')
  updateContacts(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: UpdateContactsDto,
  ): Promise<ApplicationContactResponseDto[]> {
    return this.applicationsService.updateContacts(user, applicantId, dto);
  }

  @Get('declaration/texts')
  @ApiOperation({
    summary: 'List offering declaration texts to accept',
    description:
      'Returns ACTIVE offering_declarations for the programmes the applicant selected. ' +
      'Applicant accepts those IDs via POST/PUT declaration (not free-text).',
  })
  @ApiWrappedOkArrayResponse(
    OfferingDeclarationForApplicantDto,
    'Offering declarations',
  )
  listDeclarationTexts(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<OfferingDeclarationForApplicantDto[]> {
    return this.applicationsService.listOfferingDeclarationsForApplicant(
      user,
      applicantId,
    );
  }

  @Get('declaration')
  @ApiOperation({ summary: 'Get declaration acceptance state' })
  @ApiWrappedOkResponse(DeclarationStepResponseDto, 'Declaration step')
  getDeclaration(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<DeclarationStepResponseDto> {
    return this.applicationsService.getDeclaration(user, applicantId);
  }

  @Post('declaration')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Accept offering declarations',
    description:
      'Accept all applicable IDs from GET .../declaration/texts and save the disciplinary disclosure. Test-centre assignment is determined from the applicant’s intake and first programme preference when an admit card is generated.',
  })
  @ApiWrappedCreatedResponse(DeclarationStepResponseDto, 'Declaration created')
  createDeclaration(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: CreateDeclarationDto,
  ): Promise<DeclarationStepResponseDto> {
    return this.applicationsService.createDeclaration(user, applicantId, dto);
  }

  @Put('declaration')
  @ApiOperation({ summary: 'Update declaration acceptance' })
  @ApiWrappedOkResponse(DeclarationStepResponseDto, 'Declaration updated')
  updateDeclaration(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
    @Body() dto: UpdateDeclarationDto,
  ): Promise<DeclarationStepResponseDto> {
    return this.applicationsService.updateDeclaration(user, applicantId, dto);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit completed application',
    description:
      'Requires academic, programme and profile steps to be complete. If selected programmes have active offering declarations, the applicant must save the declaration step and accept all of them. When no active offering declarations apply, that step may be omitted. Blocks submission if mandatory structured offering criteria (criteriaValue) are not met by academic marks.',
  })
  @ApiWrappedOkResponse(SubmitApplicationResponseDto, 'Application submitted')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('applicantId', new ParseUuidPipe('applicantId')) applicantId: string,
  ): Promise<SubmitApplicationResponseDto> {
    return this.applicationsService.submit(user, applicantId);
  }
}
