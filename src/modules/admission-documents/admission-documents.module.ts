import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApplicantDocumentEntity,
  ApplicantDocumentFileEntity,
  ApplicationAcademicDocumentEntity,
  ApplicationEntity,
  ApplicationProgrammeOptionEntity,
  DegreeLevelRequiredDocumentEntity,
  DocumentTypeEntity,
  DocumentVerificationAuditEntity,
  OfferingRequiredDocumentEntity,
  ProgrammeEntity,
  ProgrammeOfferingEntity,
} from '../../database/entities/index.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { ProgrammeOfferingsModule } from '../programme-offerings/programme-offerings.module.js';
import { AdmissionDocumentsAdminController, ApplicantDocumentsController } from './admission-documents.controller.js';
import { AdmissionDocumentsService } from './admission-documents.service.js';

@Module({
  imports: [
    StorageModule,
    forwardRef(() => ProgrammeOfferingsModule),
    TypeOrmModule.forFeature([
      DocumentTypeEntity,
      OfferingRequiredDocumentEntity,
      DegreeLevelRequiredDocumentEntity,
      ApplicantDocumentEntity,
      ApplicantDocumentFileEntity,
      DocumentVerificationAuditEntity,
      ApplicationEntity,
      ApplicationProgrammeOptionEntity,
      ProgrammeOfferingEntity,
      ProgrammeEntity,
      ApplicationAcademicDocumentEntity,
    ]),
  ],
  controllers: [ApplicantDocumentsController, AdmissionDocumentsAdminController],
  providers: [AdmissionDocumentsService],
  exports: [AdmissionDocumentsService],
})
export class AdmissionDocumentsModule {}
