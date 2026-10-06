import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdmissionOfferFeeChallanEntity,
  AdmissionOfferFeeChallanItemEntity,
  AdmissionOfferFeeEvidenceEntity,
  ApplicationEntity,
  DesignatedBankEntity,
  IntakeEntity,
  OfferingFeeEntity,
  ProgrammeOfferingEntity,
  SelectionSeatReleaseRunEntity,
} from '../../database/entities/index.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import { OfferFeeExpireJob } from './offer-fee-expire.job.js';
import {
  ApplicantOfferFeeController,
  OfferFeesAdminController,
} from './offer-fees.controller.js';
import { OfferFeesService } from './offer-fees.service.js';

@Module({
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([
      AdmissionOfferFeeChallanEntity,
      AdmissionOfferFeeChallanItemEntity,
      AdmissionOfferFeeEvidenceEntity,
      SelectionSeatReleaseRunEntity,
      ApplicationEntity,
      IntakeEntity,
      OfferingFeeEntity,
      ProgrammeOfferingEntity,
      DesignatedBankEntity,
    ]),
  ],
  controllers: [OfferFeesAdminController, ApplicantOfferFeeController],
  providers: [OfferFeesService, OfferFeeExpireJob],
  exports: [OfferFeesService],
})
export class OfferFeesModule {}
