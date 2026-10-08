import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationAcademicDocumentEntity, ApplicationAcademicInformationEntity, ApplicationAddressEntity, ApplicationContactEntity, ApplicationDeclarationEntity, ApplicationEntity, ApplicationProgrammeOptionEntity, ApplicationStatusAuditEntity, IntakeEntity } from '../../database/entities/index.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { AdmissionDocumentsModule } from '../admission-documents/admission-documents.module.js';
import { EntryTestModule } from '../entry-test/entry-test.module.js';
import { ProcessingFeeModule } from '../processing-fee/processing-fee.module.js';
import { ApplicationReviewController } from './application-review.controller.js';
import { ApplicationReviewService } from './application-review.service.js';

@Module({
  imports: [
    StorageModule,
    AdmissionDocumentsModule,
    ProcessingFeeModule,
    EntryTestModule,
    TypeOrmModule.forFeature([ApplicationEntity, IntakeEntity, ApplicationAcademicInformationEntity, ApplicationAcademicDocumentEntity, ApplicationProgrammeOptionEntity, ApplicationAddressEntity, ApplicationContactEntity, ApplicationDeclarationEntity, ApplicationStatusAuditEntity]),
  ],
  controllers: [ApplicationReviewController],
  providers: [ApplicationReviewService],
})
export class ApplicationReviewModule {}
