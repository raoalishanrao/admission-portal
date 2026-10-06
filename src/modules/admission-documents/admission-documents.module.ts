import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicantDocumentEntity, ApplicantDocumentFileEntity, ApplicationAcademicDocumentEntity, ApplicationEntity, ApplicationProgrammeOptionEntity, DocumentTypeEntity, DocumentVerificationAuditEntity, OfferingRequiredDocumentEntity, ProgrammeOfferingEntity } from '../../database/entities/index.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { ProgrammeOfferingsModule } from '../programme-offerings/programme-offerings.module.js';
import { AdmissionDocumentsAdminController, ApplicantDocumentsController } from './admission-documents.controller.js';
import { AdmissionDocumentsService } from './admission-documents.service.js';

@Module({
  imports: [StorageModule, ProgrammeOfferingsModule, TypeOrmModule.forFeature([DocumentTypeEntity, OfferingRequiredDocumentEntity, ApplicantDocumentEntity, ApplicantDocumentFileEntity, DocumentVerificationAuditEntity, ApplicationEntity, ApplicationProgrammeOptionEntity, ProgrammeOfferingEntity, ApplicationAcademicDocumentEntity])],
  controllers: [ApplicantDocumentsController, AdmissionDocumentsAdminController],
  providers: [AdmissionDocumentsService],
  exports: [AdmissionDocumentsService],
})
export class AdmissionDocumentsModule {}
