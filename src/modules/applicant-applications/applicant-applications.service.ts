import { ForbiddenException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import {
  AcademicDegreeType,
  AcademicDocumentType,
  AcademicDocumentVerificationStatus,
  ApplicationAddressType,
  ApplicationContactType,
} from '../../common/enums/application-completion.enum.js';
import { ApplicationStatus } from '../../common/enums/application-status.enum.js';
import { CriteriaOperator } from '../../common/enums/criteria-operator.enum.js';
import { DeclarationStatus } from '../../common/enums/declaration-status.enum.js';
import { DegreeLevel } from '../../common/enums/master-data.enum.js';
import { OfferingStatus } from '../../common/enums/offering-status.enum.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { AdmissionCriterionEntity } from '../../database/entities/admission-criterion.entity.js';
import { ApplicationAcademicDocumentEntity } from '../../database/entities/application-academic-document.entity.js';
import { ApplicationAcademicInformationEntity } from '../../database/entities/application-academic-information.entity.js';
import { ApplicationAddressEntity } from '../../database/entities/application-address.entity.js';
import { ApplicationContactEntity } from '../../database/entities/application-contact.entity.js';
import { ApplicationDeclarationEntity } from '../../database/entities/application-declaration.entity.js';
import { ApplicationProgrammeOptionEntity } from '../../database/entities/application-programme-options.entity.js';
import { ApplicationProgrammeSelectionEntity } from '../../database/entities/application-programme-selection.entity.js';
import { ApplicationEntity } from '../../database/entities/application.entity.js';
import { GeneralCriterionEntity } from '../../database/entities/general-criterion.entity.js';
import { OfferingDeclarationEntity } from '../../database/entities/offering-declaration.entity.js';
import { ProgrammeEntity } from '../../database/entities/programme.entity.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../integrations/storage/object-storage.interface.js';
import { AcademicLevelRequirementsService } from '../academic-level-requirements/academic-level-requirements.service.js';
import type {
  ApplicantRequiredAcademicLevelsResponseDto,
} from '../academic-level-requirements/dto/academic-level-requirement.dto.js';
import type {
  AcademicDocumentResponseDto,
  AcademicRecordResponseDto,
  AcademicStepResponseDto,
  AddressFieldsDto,
  ApplicationAddressResponseDto,
  ApplicationContactResponseDto,
  ContactFieldsDto,
  CreateAcademicDto,
  CreateAddressesDto,
  CreateContactsDto,
  CreateDeclarationDto,
  CreateProgrammeDto,
  CreateProfileDto,
  DeclarationStepResponseDto,
  OfferingDeclarationForApplicantDto,
  ProgrammeStepResponseDto,
  ProfileFieldsDto,
  ProfilePhotographResponseDto,
  ProfileStepResponseDto,
  SubmitApplicationResponseDto,
  UpdateAcademicDto,
  UpdateAddressDto,
  UpdateAddressesDto,
  UpdateContactDto,
  UpdateContactsDto,
  UpdateDeclarationDto,
  UpdateProgrammeDto,
  UpdateProfileDto,
} from './dto/applicant-application.dto.js';

export type UploadedFileInput = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const BLOOD_RELATIONS = new Set([
  'MOTHER',
  'BROTHER',
  'SISTER',
  'UNCLE',
  'AUNT',
  'GRANDFATHER',
  'GRANDMOTHER',
  'COUSIN',
]);

const BLOCKED_EMERGENCY_RELATIONS = new Set(['FATHER', 'GUARDIAN']);

const PROFILE_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ACADEMIC_DOC_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class ApplicantApplicationsService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly applicationsRepo: Repository<ApplicationEntity>,
    @InjectRepository(ApplicationAcademicInformationEntity)
    private readonly academicInfoRepo: Repository<ApplicationAcademicInformationEntity>,
    @InjectRepository(ApplicationAcademicDocumentEntity)
    private readonly academicDocsRepo: Repository<ApplicationAcademicDocumentEntity>,
    @InjectRepository(ApplicationProgrammeSelectionEntity)
    private readonly programmeSelectionRepo: Repository<ApplicationProgrammeSelectionEntity>,
    @InjectRepository(ApplicationProgrammeOptionEntity)
    private readonly programmeOptionsRepo: Repository<ApplicationProgrammeOptionEntity>,
    @InjectRepository(ApplicationAddressEntity)
    private readonly addressesRepo: Repository<ApplicationAddressEntity>,
    @InjectRepository(ApplicationContactEntity)
    private readonly contactsRepo: Repository<ApplicationContactEntity>,
    @InjectRepository(ApplicationDeclarationEntity)
    private readonly declarationsRepo: Repository<ApplicationDeclarationEntity>,
    @InjectRepository(ProgrammeOfferingEntity)
    private readonly offeringsRepo: Repository<ProgrammeOfferingEntity>,
    @InjectRepository(ProgrammeEntity)
    private readonly programmesRepo: Repository<ProgrammeEntity>,
    @InjectRepository(OfferingDeclarationEntity)
    private readonly offeringDeclarationsRepo: Repository<OfferingDeclarationEntity>,
    @InjectRepository(AdmissionCriterionEntity)
    private readonly admissionCriteriaRepo: Repository<AdmissionCriterionEntity>,
    @InjectRepository(GeneralCriterionEntity)
    private readonly generalCriteriaRepo: Repository<GeneralCriterionEntity>,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: ObjectStorage,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly academicLevelRequirements: AcademicLevelRequirementsService,
  ) {}

  private maxProgrammePreferences(): number {
    const raw = Number(
      this.config.get<string>('APPLICATION_MAX_PROGRAMME_PREFERENCES') ?? '2',
    );
    if (!Number.isFinite(raw) || raw < 2) return 2;
    return Math.min(Math.trunc(raw), 20);
  }
  /* ── Academic ──────────────────────────────────────────────────── */

  async getAcademic(
    user: AuthUser,
    applicantId: string,
  ): Promise<AcademicStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    const records = await this.academicInfoRepo.find({
      where: { applicantId, tenantId: app.tenantId },
      relations: { documents: true },
      order: { createdAt: 'ASC' },
    });
    return {
      applicantId,
      academicStepSaved: app.academicStepSaved,
      overallCompletion: app.overallCompletion,
      records: await Promise.all(
        records.map((r) => this.toAcademicRecord(r)),
      ),
    };
  }

  async createAcademic(
    user: AuthUser,
    applicantId: string,
    dto: CreateAcademicDto,
  ): Promise<AcademicStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertUniqueDegreeTypesInPayload(dto.records.map((r) => r.degreeType));

    const existingCount = await this.academicInfoRepo.count({
      where: { applicantId, tenantId: app.tenantId },
    });
    if (existingCount > 0) {
      throw new BusinessException(
        'Academic records already exist; use PUT to update',
        HttpStatus.CONFLICT,
        'ACADEMIC_ALREADY_EXISTS',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const infoRepo = manager.getRepository(
        ApplicationAcademicInformationEntity,
      );
      const appsRepo = manager.getRepository(ApplicationEntity);

      await infoRepo.save(
        dto.records.map((record) =>
          infoRepo.create({
            tenantId: app.tenantId,
            applicantId,
            ...this.mapAcademicFields(record),
          }),
        ),
      );

      await appsRepo.update(applicantId, {
        academicStepSaved: true,
        applicationStatus: this.inProgressStatus(app),
        overallCompletion: this.completionPercent({
          ...app,
          academicStepSaved: true,
        }),
      });
    });

    if (app.programmeStepSaved) {
      await this.assertRequiredAcademicLevels(app, applicantId);
      await this.assertEligibilityMet(
        { ...app, academicStepSaved: true },
        applicantId,
      );
    }

    return this.getAcademic(user, applicantId);
  }

  async updateAcademic(
    user: AuthUser,
    applicantId: string,
    dto: UpdateAcademicDto,
  ): Promise<AcademicStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertUniqueDegreeTypesInPayload(dto.records.map((r) => r.degreeType));

    const ids = dto.records.map((r) => r.id);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessException(
        'Duplicate academic record ids in request',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_ACADEMIC_ID',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const infoRepo = manager.getRepository(
        ApplicationAcademicInformationEntity,
      );
      const appsRepo = manager.getRepository(ApplicationEntity);

      const existing = await infoRepo.find({
        where: { id: In(ids), applicantId, tenantId: app.tenantId },
      });
      if (existing.length !== ids.length) {
        const found = new Set(existing.map((e) => e.id));
        const missing = ids.find((id) => !found.has(id));
        throw new BusinessException(
          `Academic record ${missing} not found`,
          HttpStatus.NOT_FOUND,
          'ACADEMIC_RECORD_NOT_FOUND',
        );
      }

      const byId = new Map(existing.map((e) => [e.id, e]));
      for (const record of dto.records) {
        const row = byId.get(record.id)!;
        Object.assign(row, this.mapAcademicFields(record));
        await infoRepo.save(row);
      }

      // Ensure no duplicate degree_type across all rows for this applicant.
      const allRows = await infoRepo.find({
        where: { applicantId, tenantId: app.tenantId },
      });
      this.assertUniqueDegreeTypesInPayload(allRows.map((r) => r.degreeType));

      await appsRepo.update(applicantId, {
        academicStepSaved: true,
        applicationStatus: this.inProgressStatus(app),
        overallCompletion: this.completionPercent({
          ...app,
          academicStepSaved: true,
        }),
      });
    });

    if (app.programmeStepSaved) {
      await this.assertRequiredAcademicLevels(app, applicantId);
      await this.assertEligibilityMet(
        { ...app, academicStepSaved: true },
        applicantId,
      );
    }

    return this.getAcademic(user, applicantId);
  }

  async uploadProfilePhotograph(
    user: AuthUser,
    applicantId: string,
    file: UploadedFileInput | undefined,
  ): Promise<ProfilePhotographResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertProfileImage(file);

    const stored = await this.objectStorage.upload({
      buffer: file!.buffer,
      mimeType: file!.mimetype,
      folder: `admissions/profile-photos/${applicantId}`,
      fileName: file!.originalname,
    });

    if (app.profilePhotograph) {
      await this.safeDeleteStored(app.profilePhotograph);
    }

    await this.applicationsRepo.update(applicantId, {
      profilePhotograph: stored.publicUrl,
    });

    return {
      applicantId,
      profilePhotograph: stored.publicUrl,
      downloadUrl: stored.downloadUrl,
    };
  }

  async uploadAcademicDocument(
    user: AuthUser,
    applicantId: string,
    academicInformationId: string,
    documentType: AcademicDocumentType,
    file: UploadedFileInput | undefined,
  ): Promise<AcademicDocumentResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertAcademicDocument(file);

    if (!Object.values(AcademicDocumentType).includes(documentType)) {
      throw new BusinessException(
        'Invalid documentType',
        HttpStatus.BAD_REQUEST,
        'INVALID_DOCUMENT_TYPE',
      );
    }

    const info = await this.academicInfoRepo.findOne({
      where: { id: academicInformationId, applicantId, tenantId: app.tenantId },
    });
    if (!info) {
      throw new NotFoundException('Academic information record not found');
    }

    const stored = await this.objectStorage.upload({
      buffer: file!.buffer,
      mimeType: file!.mimetype,
      folder: `admissions/academic/${applicantId}/${academicInformationId}`,
      fileName: file!.originalname,
    });

    const saved = await this.academicDocsRepo.save(
      this.academicDocsRepo.create({
        tenantId: app.tenantId,
        applicantId,
        academicInformationId,
        documentType,
        fileReference: stored.publicUrl,
        originalFileName: file!.originalname,
        mimeType: file!.mimetype,
        fileSize: file!.size,
        uploadedAt: new Date(),
        verificationStatus: AcademicDocumentVerificationStatus.UNVERIFIED,
      }),
    );
    return this.toAcademicDocument(saved, stored.downloadUrl);
  }

  async getAcademicDocument(
    user: AuthUser,
    applicantId: string,
    academicInformationId: string,
    documentId: string,
  ): Promise<AcademicDocumentResponseDto> {
    await this.requireOwnedEditable(user, applicantId, false);
    const doc = await this.academicDocsRepo.findOne({
      where: {
        id: documentId,
        applicantId,
        academicInformationId,
      },
    });
    if (!doc) {
      throw new NotFoundException('Academic document not found');
    }
    return this.toAcademicDocument(doc);
  }

  async deleteAcademicDocument(
    user: AuthUser,
    applicantId: string,
    academicInformationId: string,
    documentId: string,
  ): Promise<void> {
    await this.requireOwnedEditable(user, applicantId);
    const doc = await this.academicDocsRepo.findOne({
      where: {
        id: documentId,
        applicantId,
        academicInformationId,
      },
    });
    if (!doc) {
      throw new NotFoundException('Academic document not found');
    }
    await this.safeDeleteStored(doc.fileReference);
    await this.academicDocsRepo.remove(doc);
  }

  private assertProfileImage(file: UploadedFileInput | undefined): void {
    if (!file) {
      throw new BusinessException(
        'Image file is required',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
      );
    }
    if (!PROFILE_IMAGE_TYPES.has(file.mimetype)) {
      throw new BusinessException(
        'Only JPEG, PNG, or WEBP images are allowed',
        HttpStatus.BAD_REQUEST,
        'INVALID_IMAGE_TYPE',
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BusinessException(
        'Image must be 5MB or smaller',
        HttpStatus.BAD_REQUEST,
        'FILE_TOO_LARGE',
      );
    }
  }

  private assertAcademicDocument(file: UploadedFileInput | undefined): void {
    if (!file) {
      throw new BusinessException(
        'Document file is required',
        HttpStatus.BAD_REQUEST,
        'FILE_REQUIRED',
      );
    }
    if (!ACADEMIC_DOC_TYPES.has(file.mimetype)) {
      throw new BusinessException(
        'Only PDF, JPEG, PNG, or WEBP documents are allowed',
        HttpStatus.BAD_REQUEST,
        'INVALID_DOCUMENT_TYPE',
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BusinessException(
        'Document must be 10MB or smaller',
        HttpStatus.BAD_REQUEST,
        'FILE_TOO_LARGE',
      );
    }
  }

  private async safeDeleteStored(publicUrlOrKey: string): Promise<void> {
    try {
      await this.objectStorage.delete(publicUrlOrKey);
    } catch {
      // best-effort cleanup
    }
  }

  /* ── Programme ─────────────────────────────────────────────────── */

  async getProgramme(
    user: AuthUser,
    applicantId: string,
  ): Promise<ProgrammeStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    const selection = await this.programmeSelectionRepo.findOne({
      where: { applicantId, tenantId: app.tenantId },
    });
    const options = await this.programmeOptionsRepo.find({
      where: { applicantId, tenantId: app.tenantId },
      order: { preferenceOrder: 'ASC' },
    });

    return {
      applicantId,
      intakeSessionId: selection?.intakeSessionId ?? app.intakeId,
      qualificationLevel: selection?.qualificationLevel ?? null,
      appliedDate: selection?.appliedDate ?? null,
      stepSaved: selection?.stepSaved ?? false,
      savedAt: selection?.savedAt ?? null,
      options: options.map((o) => ({
        id: o.id,
        programmeOfferingId: o.programmeOfferingId,
        preferenceOrder: o.preferenceOrder,
      })),
      programmeStepSaved: app.programmeStepSaved,
      overallCompletion: app.overallCompletion,
    };
  }

  async createProgramme(
    user: AuthUser,
    applicantId: string,
    dto: CreateProgrammeDto,
  ): Promise<ProgrammeStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    const existing = await this.programmeSelectionRepo.findOne({
      where: { applicantId },
    });
    if (existing) {
      throw new BusinessException(
        'Programme selection already exists; use PUT to update',
        HttpStatus.CONFLICT,
        'PROGRAMME_ALREADY_EXISTS',
      );
    }
    await this.persistProgramme(app, applicantId, dto);
    return this.getProgramme(user, applicantId);
  }

  async updateProgramme(
    user: AuthUser,
    applicantId: string,
    dto: UpdateProgrammeDto,
  ): Promise<ProgrammeStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    const existing = await this.programmeSelectionRepo.findOne({
      where: { applicantId },
    });
    if (!existing) {
      throw new BusinessException(
        'Programme selection not found; use POST to create',
        HttpStatus.NOT_FOUND,
        'PROGRAMME_NOT_FOUND',
      );
    }
    await this.persistProgramme(app, applicantId, dto);
    return this.getProgramme(user, applicantId);
  }

  /* ── Addresses ─────────────────────────────────────────────────── */

  async getAddresses(
    user: AuthUser,
    applicantId: string,
  ): Promise<ApplicationAddressResponseDto[]> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    const rows = await this.addressesRepo.find({
      where: { applicantId, tenantId: app.tenantId },
      order: { addressType: 'ASC' },
    });
    return rows.map((r) => this.toAddress(r));
  }

  async createAddresses(
    user: AuthUser,
    applicantId: string,
    dto: CreateAddressesDto,
  ): Promise<ApplicationAddressResponseDto[]> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertAddressTypesUnique(dto.addresses);

    const existing = await this.addressesRepo.find({
      where: { applicantId, tenantId: app.tenantId },
    });
    const existingTypes = new Set(existing.map((e) => e.addressType));
    for (const address of dto.addresses) {
      if (existingTypes.has(address.addressType)) {
        throw new BusinessException(
          `Address type ${address.addressType} already exists; use PUT to update`,
          HttpStatus.CONFLICT,
          'ADDRESS_TYPE_EXISTS',
        );
      }
    }

    const mergedTypes = [
      ...existing.map((e) => e.addressType),
      ...dto.addresses.map((a) => a.addressType),
    ];
    if (!mergedTypes.includes(ApplicationAddressType.PRIMARY)) {
      throw new BusinessException(
        'PRIMARY address is required',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PRIMARY_ADDRESS_REQUIRED',
      );
    }

    await this.addressesRepo.save(
      dto.addresses.map((a) =>
        this.addressesRepo.create({
          tenantId: app.tenantId,
          applicantId,
          ...this.mapAddressFields(a),
        }),
      ),
    );
    return this.getAddresses(user, applicantId);
  }

  async updateAddresses(
    user: AuthUser,
    applicantId: string,
    dto: UpdateAddressesDto,
  ): Promise<ApplicationAddressResponseDto[]> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertAddressTypesUnique(dto.addresses);
    await this.applyAddressUpdates(app.tenantId, applicantId, dto.addresses);
    return this.getAddresses(user, applicantId);
  }

  /* ── Contacts ──────────────────────────────────────────────────── */

  async getContacts(
    user: AuthUser,
    applicantId: string,
  ): Promise<ApplicationContactResponseDto[]> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    const rows = await this.contactsRepo.find({
      where: { applicantId, tenantId: app.tenantId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toContact(r));
  }

  async createContacts(
    user: AuthUser,
    applicantId: string,
    dto: CreateContactsDto,
  ): Promise<ApplicationContactResponseDto[]> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertEmergencyRules(dto.contacts);

    const existing = await this.contactsRepo.find({
      where: { applicantId, tenantId: app.tenantId },
    });
    const merged = [...existing, ...dto.contacts];
    this.assertHasEmergency(merged);

    await this.contactsRepo.save(
      dto.contacts.map((c) =>
        this.contactsRepo.create({
          tenantId: app.tenantId,
          applicantId,
          ...this.mapContactFields(c),
        }),
      ),
    );
    return this.getContacts(user, applicantId);
  }

  async updateContacts(
    user: AuthUser,
    applicantId: string,
    dto: UpdateContactsDto,
  ): Promise<ApplicationContactResponseDto[]> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertEmergencyRules(dto.contacts);
    await this.applyContactUpdates(app.tenantId, applicantId, dto.contacts);
    return this.getContacts(user, applicantId);
  }

  /* ── Profile ───────────────────────────────────────────────────── */

  async getProfile(
    user: AuthUser,
    applicantId: string,
  ): Promise<ProfileStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    const [addresses, contacts] = await Promise.all([
      this.getAddresses(user, applicantId),
      this.getContacts(user, applicantId),
    ]);
    return {
      applicantId,
      applicantName: app.applicantName,
      gender: app.gender,
      maritalStatus: app.maritalStatus,
      dateOfBirth: app.dateOfBirth,
      mobileNumber: app.mobileNumber,
      telephone: app.telephone,
      profilePhotograph: app.profilePhotograph,
      profilePhotographDownloadUrl: app.profilePhotograph
        ? await this.objectStorage.resolveDownloadUrl(app.profilePhotograph)
        : null,
      primaryNationalityId: app.primaryNationalityId,
      secondaryNationalityId: app.secondaryNationalityId,
      domicileId: app.domicileId,
      disabilityDeclared: app.disabilityDeclared,
      referralSource: app.referralSource,
      addresses,
      contacts,
      profileStepSaved: app.profileStepSaved,
      overallCompletion: app.overallCompletion,
    };
  }

  async createProfile(
    user: AuthUser,
    applicantId: string,
    dto: CreateProfileDto,
  ): Promise<ProfileStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    if (app.profileStepSaved) {
      throw new BusinessException(
        'Profile already created; use PUT to update',
        HttpStatus.CONFLICT,
        'PROFILE_ALREADY_EXISTS',
      );
    }
    await this.assertProfilePrerequisites(app.tenantId, applicantId);

    await this.applicationsRepo.update(
      applicantId,
      this.mapProfileFields(dto, app),
    );

    return this.getProfile(user, applicantId);
  }

  async updateProfile(
    user: AuthUser,
    applicantId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    if (!app.profileStepSaved) {
      throw new BusinessException(
        'Profile not found; use POST to create',
        HttpStatus.NOT_FOUND,
        'PROFILE_NOT_FOUND',
      );
    }
    await this.assertProfilePrerequisites(app.tenantId, applicantId);

    await this.applicationsRepo.update(
      applicantId,
      this.mapProfileFields(dto, app),
    );

    return this.getProfile(user, applicantId);
  }

  private async assertProfilePrerequisites(
    tenantId: string,
    applicantId: string,
  ): Promise<void> {
    const addresses = await this.addressesRepo.find({
      where: { applicantId, tenantId },
    });
    if (
      !addresses.some((a) => a.addressType === ApplicationAddressType.PRIMARY)
    ) {
      throw new BusinessException(
        'PRIMARY address must be saved via /addresses before profile step',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PRIMARY_ADDRESS_REQUIRED',
      );
    }
    const contacts = await this.contactsRepo.find({
      where: { applicantId, tenantId },
    });
    this.assertHasEmergency(contacts);
    this.assertEmergencyRules(contacts);
  }

  /* ── Declaration / Submit ──────────────────────────────────────── */

  async getDeclaration(
    user: AuthUser,
    applicantId: string,
  ): Promise<DeclarationStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    const row = await this.declarationsRepo.findOne({
      where: { applicantId, tenantId: app.tenantId },
    });
    return this.toDeclaration(app, row);
  }

  async createDeclaration(
    user: AuthUser,
    applicantId: string,
    dto: CreateDeclarationDto,
  ): Promise<DeclarationStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertPriorStepsComplete(app);
    await this.assertDeclarationPayload(app, applicantId, dto);

    const existing = await this.declarationsRepo.findOne({
      where: { applicantId },
    });
    if (existing) {
      throw new BusinessException(
        'Declaration already exists; use PUT to update',
        HttpStatus.CONFLICT,
        'DECLARATION_ALREADY_EXISTS',
      );
    }

    await this.persistDeclaration(app, applicantId, dto);
    return this.getDeclaration(user, applicantId);
  }

  async updateDeclaration(
    user: AuthUser,
    applicantId: string,
    dto: UpdateDeclarationDto,
  ): Promise<DeclarationStepResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertPriorStepsComplete(app);
    await this.assertDeclarationPayload(app, applicantId, dto);

    const existing = await this.declarationsRepo.findOne({
      where: { applicantId },
    });
    if (!existing) {
      throw new BusinessException(
        'Declaration not found; use POST to create',
        HttpStatus.NOT_FOUND,
        'DECLARATION_NOT_FOUND',
      );
    }

    await this.persistDeclaration(app, applicantId, dto, existing);
    return this.getDeclaration(user, applicantId);
  }

  async submit(
    user: AuthUser,
    applicantId: string,
  ): Promise<SubmitApplicationResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId);
    this.assertPriorStepsComplete(app);

    const activeOfferingDeclarations = await this.loadActiveOfferingDeclarations(
      app.tenantId,
      applicantId,
    );
    const requiresDeclarationAcceptance = activeOfferingDeclarations.length > 0;

    if (requiresDeclarationAcceptance && !app.declarationStepSaved) {
      throw new BusinessException(
        'Declaration step must be saved before submission',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DECLARATION_STEP_INCOMPLETE',
      );
    }

    const declaration = await this.declarationsRepo.findOne({
      where: { applicantId, tenantId: app.tenantId },
    });
    if (requiresDeclarationAcceptance && !declaration) {
      throw new BusinessException(
        'Declaration record is required',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DECLARATION_REQUIRED',
      );
    }
    if (declaration && !declaration.declarationAccepted) {
      throw new BusinessException(
        'Declaration must be accepted before submission',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DECLARATION_NOT_ACCEPTED',
      );
    }
    if (
      declaration?.disciplinaryIssueDeclared &&
      !declaration.disciplinaryIssueDetails?.trim()
    ) {
      throw new BusinessException(
        'Disciplinary issue details are required',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DISCIPLINARY_DETAILS_REQUIRED',
      );
    }
    const acceptedOfferingDeclarationIds = new Set(
      declaration?.acceptedOfferingDeclarationIds ?? [],
    );
    if (
      activeOfferingDeclarations.some(
        (item) => !acceptedOfferingDeclarationIds.has(item.id),
      )
    ) {
      throw new BusinessException(
        'All active offering declarations must be accepted before submission',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'OFFERING_DECLARATIONS_INCOMPLETE',
      );
    }

    await this.assertRequiredAcademicLevels(app, applicantId);
    await this.assertEligibilityMet(app, applicantId);

    if (
      app.applicationStatus === ApplicationStatus.COMPLETE ||
      app.applicationStatus === ApplicationStatus.SUBMITTED
    ) {
      return {
        applicantId,
        applicationStatus: app.applicationStatus,
        overallCompletion: app.overallCompletion,
        submissionDate:
          app.submissionDate ?? declaration?.submissionDate ?? new Date(),
      };
    }

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ApplicationEntity).update(applicantId, {
        applicationStatus: ApplicationStatus.COMPLETE,
        overallCompletion: 100,
        submissionDate: now,
        appliedDate: app.appliedDate ?? now,
      });
      if (declaration) {
        await manager.getRepository(ApplicationDeclarationEntity).update(
          { applicantId },
          { submissionDate: now },
        );
      }
    });

    return {
      applicantId,
      applicationStatus: ApplicationStatus.COMPLETE,
      overallCompletion: 100,
      submissionDate: now,
    };
  }

  /* ── Helpers ───────────────────────────────────────────────────── */

  private async persistProgramme(
    app: ApplicationEntity,
    applicantId: string,
    dto: CreateProgrammeDto,
  ): Promise<void> {
    this.assertProgrammeOptions(dto);

    const offeringIds = dto.options.map((o) => o.programmeOfferingId);
    const offerings = await this.offeringsRepo.find({
      where: {
        id: In(offeringIds),
        tenantId: app.tenantId,
        intakeId: app.intakeId,
      },
    });
    if (offerings.length !== offeringIds.length) {
      throw new BusinessException(
        'One or more programme offerings are invalid for this intake',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_PROGRAMME_OFFERING',
      );
    }
    for (const offering of offerings) {
      if (offering.offeringStatus !== OfferingStatus.PUBLISHED) {
        throw new BusinessException(
          'Programme offering must be published',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'UNPUBLISHED_PROGRAMME',
        );
      }
    }

    if (app.academicStepSaved) {
      await this.assertRequiredAcademicLevels(app, applicantId, offeringIds);
      await this.assertEligibilityMet(app, applicantId, offeringIds);
    }

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      const selectionRepo = manager.getRepository(
        ApplicationProgrammeSelectionEntity,
      );
      const optionsRepo = manager.getRepository(
        ApplicationProgrammeOptionEntity,
      );
      const appsRepo = manager.getRepository(ApplicationEntity);

      let selection = await selectionRepo.findOne({ where: { applicantId } });
      if (!selection) {
        selection = selectionRepo.create({
          applicantId,
          tenantId: app.tenantId,
          intakeSessionId: app.intakeId,
          qualificationLevel: dto.qualificationLevel,
          appliedDate: now,
          stepSaved: true,
          savedAt: now,
        });
      } else {
        selection.qualificationLevel = dto.qualificationLevel;
        selection.intakeSessionId = app.intakeId;
        selection.stepSaved = true;
        selection.savedAt = now;
      }
      await selectionRepo.save(selection);

      await optionsRepo.delete({ applicantId });
      await optionsRepo.save(
        dto.options.map((opt) =>
          optionsRepo.create({
            tenantId: app.tenantId,
            applicantId,
            programmeOfferingId: opt.programmeOfferingId,
            preferenceOrder: opt.preferenceOrder,
          }),
        ),
      );

      await appsRepo.update(applicantId, {
        programmeStepSaved: true,
        appliedDate: now,
        applicationStatus: this.inProgressStatus(app),
        overallCompletion: this.completionPercent({
          ...app,
          programmeStepSaved: true,
        }),
      });
    });
  }

  private async persistDeclaration(
    app: ApplicationEntity,
    applicantId: string,
    dto: CreateDeclarationDto,
    existing?: ApplicationDeclarationEntity,
  ): Promise<void> {
    const now = new Date();
    const required = await this.loadActiveOfferingDeclarations(
      app.tenantId,
      applicantId,
    );
    const acceptedIds = dto.acceptedOfferingDeclarationIds ?? [];
    const versionLabel = required
      .filter((r) => acceptedIds.includes(r.id))
      .map((r) => r.version)
      .join(',');

    const row =
      existing ??
      this.declarationsRepo.create({
        applicantId,
        tenantId: app.tenantId,
      });
    row.declarationAccepted = dto.declarationAccepted;
    row.declarationAcceptanceDate = dto.declarationAccepted ? now : null;
    row.declarationVersion = versionLabel || null;
    row.acceptedOfferingDeclarationIds = acceptedIds;
    row.disciplinaryIssueDeclared = dto.disciplinaryIssueDeclared;
    row.disciplinaryIssueDetails = dto.disciplinaryIssueDeclared
      ? (dto.disciplinaryIssueDetails ?? null)
      : null;
    await this.declarationsRepo.save(row);

    await this.applicationsRepo.update(applicantId, {
      declarationStepSaved: true,
      applicationStatus: this.inProgressStatus(app),
      overallCompletion: this.completionPercent({
        ...app,
        declarationStepSaved: true,
      }),
    });
  }

  async listOfferingDeclarationsForApplicant(
    user: AuthUser,
    applicantId: string,
  ): Promise<OfferingDeclarationForApplicantDto[]> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    return this.loadActiveOfferingDeclarations(app.tenantId, applicantId);
  }

  private async loadActiveOfferingDeclarations(
    tenantId: string,
    applicantId: string,
  ): Promise<OfferingDeclarationForApplicantDto[]> {
    const options = await this.programmeOptionsRepo.find({
      where: { applicantId, tenantId },
    });
    if (options.length === 0) {
      throw new BusinessException(
        'Programme selection is required before loading declaration texts',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PROGRAMME_STEP_INCOMPLETE',
      );
    }
    const offeringIds = options.map((o) => o.programmeOfferingId);
    const rows = await this.offeringDeclarationsRepo.find({
      where: {
        tenantId,
        programmeOfferingId: In(offeringIds),
        status: DeclarationStatus.ACTIVE,
      },
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      programmeOfferingId: r.programmeOfferingId,
      declarationTypeId: r.declarationTypeId,
      declarationText: r.declarationText,
      version: r.version,
    }));
  }

  private async requireOwnedEditable(
    user: AuthUser,
    applicantId: string,
    requireEditable = true,
  ): Promise<ApplicationEntity> {
    const app = await this.applicationsRepo.findOne({
      where: { id: applicantId, tenantId: user.tenantId },
    });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    if (!app.iamUserId || app.iamUserId !== user.userId) {
      throw new ForbiddenException('You do not own this application');
    }
    if (
      requireEditable &&
      (app.applicationStatus === ApplicationStatus.COMPLETE ||
        app.applicationStatus === ApplicationStatus.SUBMITTED ||
        app.applicationStatus === ApplicationStatus.APPROVED ||
        app.applicationStatus === ApplicationStatus.REJECTED)
    ) {
      throw new BusinessException(
        'Submitted applications are read-only',
        HttpStatus.CONFLICT,
        'APPLICATION_READ_ONLY',
      );
    }
    return app;
  }

  private inProgressStatus(app: ApplicationEntity): ApplicationStatus {
    if (
      app.applicationStatus === ApplicationStatus.REGISTERED ||
      app.applicationStatus === ApplicationStatus.IN_PROGRESS
    ) {
      return ApplicationStatus.IN_PROGRESS;
    }
    return app.applicationStatus as ApplicationStatus;
  }

  private completionPercent(
    app: Pick<
      ApplicationEntity,
      | 'academicStepSaved'
      | 'programmeStepSaved'
      | 'profileStepSaved'
      | 'declarationStepSaved'
    >,
  ): number {
    let steps = 0;
    if (app.academicStepSaved) steps += 1;
    if (app.programmeStepSaved) steps += 1;
    if (app.profileStepSaved) steps += 1;
    if (app.declarationStepSaved) steps += 1;
    return steps * 25;
  }

  private assertPriorStepsComplete(app: ApplicationEntity): void {
    if (!app.academicStepSaved) {
      throw new BusinessException(
        'Academic step must be completed first',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ACADEMIC_STEP_INCOMPLETE',
      );
    }
    if (!app.programmeStepSaved) {
      throw new BusinessException(
        'Programme step must be completed first',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PROGRAMME_STEP_INCOMPLETE',
      );
    }
    if (!app.profileStepSaved) {
      throw new BusinessException(
        'Profile step must be completed first',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PROFILE_STEP_INCOMPLETE',
      );
    }
  }

  private assertProgrammeOptions(dto: CreateProgrammeDto): void {
    const max = this.maxProgrammePreferences();
    if (dto.options.length > max) {
      throw new BusinessException(
        `At most ${max} programme preferences are allowed`,
        HttpStatus.BAD_REQUEST,
        'TOO_MANY_PREFERENCES',
      );
    }
    const orders = dto.options.map((o) => o.preferenceOrder);
    if (!orders.includes(1)) {
      throw new BusinessException(
        'Preference order 1 is mandatory',
        HttpStatus.BAD_REQUEST,
        'PREFERENCE_1_REQUIRED',
      );
    }
    if (orders.some((o) => o > max)) {
      throw new BusinessException(
        `preferenceOrder must be between 1 and ${max}`,
        HttpStatus.BAD_REQUEST,
        'INVALID_PREFERENCE_ORDER',
      );
    }
    if (new Set(orders).size !== orders.length) {
      throw new BusinessException(
        'Duplicate preference orders are not allowed',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_PREFERENCE',
      );
    }
    const offeringIds = dto.options.map((o) => o.programmeOfferingId);
    if (new Set(offeringIds).size !== offeringIds.length) {
      throw new BusinessException(
        'Duplicate programme offerings are not allowed',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_OFFERING',
      );
    }
  }

  private assertAddressTypesUnique(
    addresses: Array<{ addressType: ApplicationAddressType }>,
  ): void {
    const types = addresses.map((a) => a.addressType);
    if (new Set(types).size !== types.length) {
      throw new BusinessException(
        'At most one address per address type is allowed',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_ADDRESS_TYPE',
      );
    }
  }

  private assertHasEmergency(
    contacts: Array<{ contactType: ApplicationContactType }>,
  ): void {
    if (
      !contacts.some((c) => c.contactType === ApplicationContactType.EMERGENCY)
    ) {
      throw new BusinessException(
        'EMERGENCY contact is required',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'EMERGENCY_CONTACT_REQUIRED',
      );
    }
  }

  private assertEmergencyRules(
    contacts: Array<{
      contactType: ApplicationContactType;
      relationship: string;
    }>,
  ): void {
    for (const contact of contacts) {
      if (contact.contactType !== ApplicationContactType.EMERGENCY) continue;
      const relation = contact.relationship.trim().toUpperCase();
      if (BLOCKED_EMERGENCY_RELATIONS.has(relation)) {
        throw new BusinessException(
          'Emergency contact must not be father or guardian',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INVALID_EMERGENCY_RELATIONSHIP',
        );
      }
      if (!BLOOD_RELATIONS.has(relation)) {
        throw new BusinessException(
          'Emergency contact must be a blood relation',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INVALID_EMERGENCY_RELATIONSHIP',
        );
      }
    }
  }

  private async assertDeclarationPayload(
    app: ApplicationEntity,
    applicantId: string,
    dto: CreateDeclarationDto,
  ): Promise<void> {
    if (!dto.declarationAccepted) {
      throw new BusinessException(
        'Declaration must be accepted',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DECLARATION_NOT_ACCEPTED',
      );
    }
    if (
      dto.disciplinaryIssueDeclared &&
      !dto.disciplinaryIssueDetails?.trim()
    ) {
      throw new BusinessException(
        'Disciplinary issue details are required when declared',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'DISCIPLINARY_DETAILS_REQUIRED',
      );
    }
    const required = await this.loadActiveOfferingDeclarations(
      app.tenantId,
      applicantId,
    );
    const requiredIds = new Set(required.map((r) => r.id));
    const accepted = new Set(dto.acceptedOfferingDeclarationIds ?? []);
    for (const id of requiredIds) {
      if (!accepted.has(id)) {
        throw new BusinessException(
          'All ACTIVE offering declarations for selected programmes must be accepted',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'OFFERING_DECLARATIONS_INCOMPLETE',
        );
      }
    }
    for (const id of accepted) {
      if (!requiredIds.has(id)) {
        throw new BusinessException(
          `Offering declaration ${id} is not valid for this application`,
          HttpStatus.UNPROCESSABLE_ENTITY,
          'INVALID_OFFERING_DECLARATION',
        );
      }
    }
  }

  async getRequiredAcademicLevels(
    user: AuthUser,
    applicantId: string,
  ): Promise<ApplicantRequiredAcademicLevelsResponseDto> {
    const app = await this.requireOwnedEditable(user, applicantId, false);
    const resolved = await this.resolveRequiredAcademicLevels(app, applicantId);
    return {
      applicantId,
      byDegreeLevel: resolved.byDegreeLevel,
      requiredAcademicCodes: resolved.requiredAcademicCodes,
      missingAcademicCodes: resolved.missingAcademicCodes,
      complete: resolved.missingAcademicCodes.length === 0,
    };
  }

  private assertUniqueDegreeTypesInPayload(degreeTypes: string[]): void {
    const normalized = degreeTypes.map((d) => d.trim().toUpperCase());
    if (new Set(normalized).size !== normalized.length) {
      throw new BusinessException(
        'Duplicate academic degreeType in request; only one record per code is allowed',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_ACADEMIC_DEGREE_TYPE',
      );
    }
  }

  private async assertRequiredAcademicLevels(
    app: ApplicationEntity,
    applicantId: string,
    offeringIdsOverride?: string[],
  ): Promise<void> {
    const resolved = await this.resolveRequiredAcademicLevels(
      app,
      applicantId,
      offeringIdsOverride,
    );
    if (resolved.missingAcademicCodes.length === 0) return;

    throw new BusinessException(
      `Missing required academic records: ${resolved.missingAcademicCodes.join(', ')}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      'ACADEMIC_LEVELS_INCOMPLETE',
      {
        requiredAcademicCodes: resolved.requiredAcademicCodes,
        missingAcademicCodes: resolved.missingAcademicCodes,
        byDegreeLevel: resolved.byDegreeLevel,
      },
    );
  }

  private async resolveRequiredAcademicLevels(
    app: ApplicationEntity,
    applicantId: string,
    offeringIdsOverride?: string[],
  ): Promise<{
    byDegreeLevel: Array<{
      degreeLevel: DegreeLevel;
      requiredAcademicCodes: AcademicDegreeType[];
      missingAcademicCodes: AcademicDegreeType[];
    }>;
    requiredAcademicCodes: AcademicDegreeType[];
    missingAcademicCodes: AcademicDegreeType[];
  }> {
    let offeringIds = offeringIdsOverride;
    if (!offeringIds) {
      const options = await this.programmeOptionsRepo.find({
        where: { applicantId, tenantId: app.tenantId },
      });
      offeringIds = options.map((o) => o.programmeOfferingId);
    }

    if (!offeringIds.length) {
      return {
        byDegreeLevel: [],
        requiredAcademicCodes: [],
        missingAcademicCodes: [],
      };
    }

    const offerings = await this.offeringsRepo.find({
      where: { id: In(offeringIds), tenantId: app.tenantId },
    });
    const programmeIds = [...new Set(offerings.map((o) => o.programmeId))];
    const programmes = programmeIds.length
      ? await this.programmesRepo.find({
          where: { id: In(programmeIds), tenantId: app.tenantId },
        })
      : [];
    const degreeLevels = [
      ...new Set(programmes.map((p) => p.degreeLevel).filter(Boolean)),
    ];

    const byLevelMap =
      await this.academicLevelRequirements.listMandatoryCodesForDegreeLevels(
        app.tenantId,
        degreeLevels,
      );

    const academics = await this.academicInfoRepo.find({
      where: { applicantId, tenantId: app.tenantId },
    });
    const present = new Set(
      academics.map((a) => a.degreeType.trim().toUpperCase()),
    );

    const requiredSet = new Set<AcademicDegreeType>();
    const byDegreeLevel = degreeLevels.map((level) => {
      const required = byLevelMap.get(level) ?? [];
      for (const code of required) requiredSet.add(code);
      const missing = required.filter((code) => !present.has(code));
      return {
        degreeLevel: level as DegreeLevel,
        requiredAcademicCodes: required,
        missingAcademicCodes: missing,
      };
    });

    const requiredAcademicCodes = [...requiredSet];
    const missingAcademicCodes = requiredAcademicCodes.filter(
      (code) => !present.has(code),
    );

    return { byDegreeLevel, requiredAcademicCodes, missingAcademicCodes };
  }

  /**
   * Enforces machine-evaluable mandatory offering criteria (criteria_value set)
   * against applicant academic percentages. Display-only criteria (no value) are skipped.
   */
  private async assertEligibilityMet(
    app: ApplicationEntity,
    applicantId: string,
    offeringIdsOverride?: string[],
  ): Promise<void> {
    let offeringIds = offeringIdsOverride;
    if (!offeringIds) {
      const options = await this.programmeOptionsRepo.find({
        where: { applicantId, tenantId: app.tenantId },
      });
      offeringIds = options.map((o) => o.programmeOfferingId);
    }
    if (!offeringIds.length) return;

    const now = new Date();
    const links = await this.admissionCriteriaRepo.find({
      where: {
        tenantId: app.tenantId,
        programmeOfferingId: In(offeringIds),
      },
      order: { sequenceNo: 'ASC', createdAt: 'ASC' },
    });
    if (!links.length) return;

    const generalIds = [...new Set(links.map((l) => l.generalCriteriaId))];
    const generals = await this.generalCriteriaRepo.find({
      where: { id: In(generalIds), tenantId: app.tenantId },
    });
    const generalById = new Map(generals.map((g) => [g.id, g]));

    const academics = await this.academicInfoRepo.find({
      where: { applicantId, tenantId: app.tenantId },
    });

    type Failure = {
      admissionCriteriaId: string;
      programmeOfferingId: string;
      generalCriteriaId: string;
      criteriaName: string | null;
      criteriaRequirement: string;
      appliesToDegreeType: string | null;
      requiredValue: number | null;
      requiredValueMax: number | null;
      operator: string | null;
      actualPercentage: number | null;
      reason: string;
    };

    const failures: Failure[] = [];

    for (const link of links) {
      if (
        link.effectiveFrom &&
        link.effectiveFrom.getTime() > now.getTime()
      ) {
        continue;
      }
      if (link.effectiveTo && link.effectiveTo.getTime() < now.getTime()) {
        continue;
      }

      const general = generalById.get(link.generalCriteriaId);
      if (!general || !general.mandatory) continue;

      const hasNumeric =
        general.criteriaValue != null &&
        general.criteriaValue !== '' &&
        !Number.isNaN(Number(general.criteriaValue));
      const isRequiredPresence =
        general.criteriaOperator === CriteriaOperator.REQUIRED &&
        !!general.appliesToDegreeType;

      if (!hasNumeric && !isRequiredPresence) continue;

      const degreeFilter = general.appliesToDegreeType?.trim().toLowerCase();
      const matchingAcademics = degreeFilter
        ? academics.filter(
            (a) => a.degreeType?.trim().toLowerCase() === degreeFilter,
          )
        : academics;

      if (isRequiredPresence) {
        if (matchingAcademics.length === 0) {
          failures.push({
            admissionCriteriaId: link.id,
            programmeOfferingId: link.programmeOfferingId,
            generalCriteriaId: general.id,
            criteriaName: general.criteriaName,
            criteriaRequirement: general.criteriaRequirement,
            appliesToDegreeType: general.appliesToDegreeType,
            requiredValue: null,
            requiredValueMax: null,
            operator: general.criteriaOperator,
            actualPercentage: null,
            reason: `Missing academic record for degree type ${general.appliesToDegreeType}`,
          });
        }
        continue;
      }

      const required = Number(general.criteriaValue);
      const requiredMax =
        general.criteriaValueMax != null
          ? Number(general.criteriaValueMax)
          : null;
      const operator =
        (general.criteriaOperator as CriteriaOperator | null) ??
        CriteriaOperator.GREATER_THAN_OR_EQUAL;

      if (matchingAcademics.length === 0) {
        failures.push({
          admissionCriteriaId: link.id,
          programmeOfferingId: link.programmeOfferingId,
          generalCriteriaId: general.id,
          criteriaName: general.criteriaName,
          criteriaRequirement: general.criteriaRequirement,
          appliesToDegreeType: general.appliesToDegreeType,
          requiredValue: required,
          requiredValueMax: requiredMax,
          operator,
          actualPercentage: null,
          reason: degreeFilter
            ? `No academic record found for degree type ${general.appliesToDegreeType}`
            : 'No academic records found to evaluate percentage',
        });
        continue;
      }

      const percentages = matchingAcademics
        .map((a) => Number(a.percentage))
        .filter((n) => Number.isFinite(n));
      if (!percentages.length) {
        failures.push({
          admissionCriteriaId: link.id,
          programmeOfferingId: link.programmeOfferingId,
          generalCriteriaId: general.id,
          criteriaName: general.criteriaName,
          criteriaRequirement: general.criteriaRequirement,
          appliesToDegreeType: general.appliesToDegreeType,
          requiredValue: required,
          requiredValueMax: requiredMax,
          operator,
          actualPercentage: null,
          reason: 'Academic percentage is missing or invalid',
        });
        continue;
      }

      const actual = Math.max(...percentages);
      const passed = this.comparePercentage(
        actual,
        operator,
        required,
        requiredMax,
      );
      if (!passed) {
        failures.push({
          admissionCriteriaId: link.id,
          programmeOfferingId: link.programmeOfferingId,
          generalCriteriaId: general.id,
          criteriaName: general.criteriaName,
          criteriaRequirement: general.criteriaRequirement,
          appliesToDegreeType: general.appliesToDegreeType,
          requiredValue: required,
          requiredValueMax: requiredMax,
          operator,
          actualPercentage: actual,
          reason: `Obtained ${actual}% does not meet required ${operator} ${required}${
            requiredMax != null ? `–${requiredMax}` : ''
          }%`,
        });
      }
    }

    if (failures.length > 0) {
      throw new BusinessException(
        'Applicant does not meet one or more mandatory admission criteria',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'ELIGIBILITY_CRITERIA_NOT_MET',
        { failures },
      );
    }
  }

  private comparePercentage(
    actual: number,
    operator: CriteriaOperator | string,
    required: number,
    requiredMax: number | null,
  ): boolean {
    switch (operator) {
      case CriteriaOperator.EQUALS:
        return actual === required;
      case CriteriaOperator.GREATER_THAN:
        return actual > required;
      case CriteriaOperator.GREATER_THAN_OR_EQUAL:
        return actual >= required;
      case CriteriaOperator.LESS_THAN:
        return actual < required;
      case CriteriaOperator.BETWEEN:
        return (
          requiredMax != null && actual >= required && actual <= requiredMax
        );
      default:
        return actual >= required;
    }
  }

  private mapProfileFields(dto: ProfileFieldsDto, app: ApplicationEntity) {
    return {
      applicantName: dto.applicantName,
      gender: dto.gender,
      maritalStatus: dto.maritalStatus,
      dateOfBirth: dto.dateOfBirth,
      mobileNumber: dto.mobileNumber,
      telephone: dto.telephone ?? null,
      profilePhotograph: dto.profilePhotograph ?? null,
      primaryNationalityId: dto.primaryNationalityId,
      secondaryNationalityId: dto.secondaryNationalityId ?? null,
      domicileId: dto.domicileId ?? null,
      disabilityDeclared: dto.disabilityDeclared,
      referralSource: dto.referralSource ?? null,
      profileStepSaved: true,
      applicationStatus: this.inProgressStatus(app),
      overallCompletion: this.completionPercent({
        ...app,
        profileStepSaved: true,
      }),
    };
  }

  private mapAddressFields(a: AddressFieldsDto) {
    return {
      addressType: a.addressType,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2 ?? null,
      countryId: a.countryId,
      provinceId: a.provinceId,
      cityId: a.cityId,
      postalCode: a.postalCode ?? null,
      isSameAsPrimary: a.isSameAsPrimary ?? false,
    };
  }

  private mapContactFields(c: ContactFieldsDto) {
    return {
      contactType: c.contactType,
      name: c.name,
      identityDocumentNumber: c.identityDocumentNumber ?? null,
      relationship: c.relationship,
      occupation: c.occupation ?? null,
      mobileNumber: c.mobileNumber,
      telephone: c.telephone ?? null,
      email: c.email ?? null,
      addressLine: c.addressLine ?? null,
    };
  }

  private async applyAddressUpdates(
    tenantId: string,
    applicantId: string,
    addresses: UpdateAddressDto[],
    repo: Repository<ApplicationAddressEntity> = this.addressesRepo,
  ): Promise<void> {
    const ids = addresses.map((a) => a.id);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessException(
        'Duplicate address ids in request',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_ADDRESS_ID',
      );
    }
    const existing = await repo.find({
      where: { id: In(ids), applicantId, tenantId },
    });
    if (existing.length !== ids.length) {
      throw new BusinessException(
        'One or more addresses were not found',
        HttpStatus.NOT_FOUND,
        'ADDRESS_NOT_FOUND',
      );
    }
    const byId = new Map(existing.map((e) => [e.id, e]));
    for (const address of addresses) {
      const row = byId.get(address.id)!;
      Object.assign(row, this.mapAddressFields(address));
      await repo.save(row);
    }
  }

  private async applyContactUpdates(
    tenantId: string,
    applicantId: string,
    contacts: UpdateContactDto[],
    repo: Repository<ApplicationContactEntity> = this.contactsRepo,
  ): Promise<void> {
    const ids = contacts.map((c) => c.id);
    if (new Set(ids).size !== ids.length) {
      throw new BusinessException(
        'Duplicate contact ids in request',
        HttpStatus.BAD_REQUEST,
        'DUPLICATE_CONTACT_ID',
      );
    }
    const existing = await repo.find({
      where: { id: In(ids), applicantId, tenantId },
    });
    if (existing.length !== ids.length) {
      throw new BusinessException(
        'One or more contacts were not found',
        HttpStatus.NOT_FOUND,
        'CONTACT_NOT_FOUND',
      );
    }
    const byId = new Map(existing.map((e) => [e.id, e]));
    for (const contact of contacts) {
      const row = byId.get(contact.id)!;
      Object.assign(row, this.mapContactFields(contact));
      await repo.save(row);
    }
  }

  private mapAcademicFields(record: {
    degreeType: AcademicDegreeType | string;
    rollNumber: string;
    qualificationName: string;
    boardOrInstitution: string;
    passingYear: string;
    division: string;
    grade: string;
    marksOrGpaObtained: string;
    marksOrGpaTotal: string;
    percentage: number;
  }) {
    return {
      degreeType: String(record.degreeType).trim().toUpperCase(),
      rollNumber: record.rollNumber,
      qualificationName: record.qualificationName,
      boardOrInstitution: record.boardOrInstitution,
      passingYear: record.passingYear,
      division: record.division,
      grade: record.grade,
      marksOrGpaObtained: record.marksOrGpaObtained,
      marksOrGpaTotal: record.marksOrGpaTotal,
      percentage: record.percentage.toFixed(2),
    };
  }

  private async toAcademicRecord(
    row: ApplicationAcademicInformationEntity,
  ): Promise<AcademicRecordResponseDto> {
    return {
      id: row.id,
      degreeType: row.degreeType as AcademicDegreeType,
      rollNumber: row.rollNumber,
      qualificationName: row.qualificationName,
      boardOrInstitution: row.boardOrInstitution,
      passingYear: row.passingYear,
      division: row.division,
      grade: row.grade,
      marksOrGpaObtained: row.marksOrGpaObtained,
      marksOrGpaTotal: row.marksOrGpaTotal,
      percentage: Number(row.percentage),
      documents: await Promise.all(
        (row.documents ?? []).map((d) => this.toAcademicDocument(d)),
      ),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async toAcademicDocument(
    row: ApplicationAcademicDocumentEntity,
    downloadUrl?: string,
  ): Promise<AcademicDocumentResponseDto> {
    return {
      id: row.id,
      academicInformationId: row.academicInformationId,
      documentType: row.documentType,
      fileReference: row.fileReference,
      downloadUrl:
        downloadUrl ??
        (await this.objectStorage.resolveDownloadUrl(row.fileReference)),
      originalFileName: row.originalFileName,
      mimeType: row.mimeType,
      fileSize: row.fileSize,
      uploadedAt: row.uploadedAt,
      verificationStatus: row.verificationStatus,
    };
  }

  private toAddress(
    row: ApplicationAddressEntity,
  ): ApplicationAddressResponseDto {
    return {
      id: row.id,
      addressType: row.addressType,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      countryId: row.countryId,
      provinceId: row.provinceId,
      cityId: row.cityId,
      postalCode: row.postalCode,
      isSameAsPrimary: row.isSameAsPrimary,
    };
  }

  private toContact(
    row: ApplicationContactEntity,
  ): ApplicationContactResponseDto {
    return {
      id: row.id,
      contactType: row.contactType,
      name: row.name,
      identityDocumentNumber: row.identityDocumentNumber,
      relationship: row.relationship,
      occupation: row.occupation,
      mobileNumber: row.mobileNumber,
      telephone: row.telephone,
      email: row.email,
      addressLine: row.addressLine,
    };
  }

  private toDeclaration(
    app: ApplicationEntity,
    row: ApplicationDeclarationEntity | null,
  ): DeclarationStepResponseDto {
    return {
      applicantId: app.id,
      declarationAccepted: row?.declarationAccepted ?? false,
      declarationAcceptanceDate: row?.declarationAcceptanceDate ?? null,
      declarationVersion: row?.declarationVersion ?? null,
      acceptedOfferingDeclarationIds:
        row?.acceptedOfferingDeclarationIds ?? [],
      disciplinaryIssueDeclared: row?.disciplinaryIssueDeclared ?? false,
      disciplinaryIssueDetails: row?.disciplinaryIssueDetails ?? null,
      submissionDate: row?.submissionDate ?? app.submissionDate,
      declarationStepSaved: app.declarationStepSaved,
      overallCompletion: app.overallCompletion,
      applicationStatus: app.applicationStatus,
    };
  }
}
