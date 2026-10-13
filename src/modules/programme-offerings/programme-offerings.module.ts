import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import { ProgrammeEntity } from '../../database/entities/programme.entity.js';
import { AdmissionDocumentsModule } from '../admission-documents/admission-documents.module.js';
import { IntakesModule } from '../intakes/intakes.module.js';
import { ProgrammeOfferingsController } from './programme-offerings.controller.js';
import { ProgrammeOfferingsService } from './programme-offerings.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProgrammeOfferingEntity, ProgrammeEntity]),
    IntakesModule,
    forwardRef(() => AdmissionDocumentsModule),
  ],
  controllers: [ProgrammeOfferingsController],
  providers: [ProgrammeOfferingsService],
  exports: [ProgrammeOfferingsService],
})
export class ProgrammeOfferingsModule {}
