import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationAcademicDocumentEntity } from '../../database/entities/application-academic-document.entity.js';
import { ApplicationAcademicInformationEntity } from '../../database/entities/application-academic-information.entity.js';
import { ApplicationAddressEntity } from '../../database/entities/application-address.entity.js';
import { ApplicationContactEntity } from '../../database/entities/application-contact.entity.js';
import { ApplicationDeclarationEntity } from '../../database/entities/application-declaration.entity.js';
import { ApplicationProgrammeOptionEntity } from '../../database/entities/application-programme-options.entity.js';
import { ApplicationProgrammeSelectionEntity } from '../../database/entities/application-programme-selection.entity.js';
import { ApplicationEntity } from '../../database/entities/application.entity.js';
import { AdmissionCriterionEntity } from '../../database/entities/admission-criterion.entity.js';
import { GeneralCriterionEntity } from '../../database/entities/general-criterion.entity.js';
import { ProgrammeEntity } from '../../database/entities/programme.entity.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import { OfferingDeclarationEntity } from '../../database/entities/offering-declaration.entity.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { AcademicLevelRequirementsModule } from '../academic-level-requirements/academic-level-requirements.module.js';
import { AdmissionDocumentsModule } from '../admission-documents/admission-documents.module.js';
import { ApplicantApplicationsController } from './applicant-applications.controller.js';
import { ApplicantApplicationsService } from './applicant-applications.service.js';

@Module({
  imports: [
    StorageModule,
    AcademicLevelRequirementsModule,
    AdmissionDocumentsModule,
    TypeOrmModule.forFeature([
      ApplicationEntity,
      ApplicationAcademicInformationEntity,
      ApplicationAcademicDocumentEntity,
      ApplicationProgrammeSelectionEntity,
      ApplicationProgrammeOptionEntity,
      ApplicationAddressEntity,
      ApplicationContactEntity,
      ApplicationDeclarationEntity,
      ProgrammeOfferingEntity,
      ProgrammeEntity,
      OfferingDeclarationEntity,
      AdmissionCriterionEntity,
      GeneralCriterionEntity,
    ]),
  ],
  controllers: [ApplicantApplicationsController],
  providers: [ApplicantApplicationsService],
  exports: [ApplicantApplicationsService],
})
export class ApplicantApplicationsModule {}
