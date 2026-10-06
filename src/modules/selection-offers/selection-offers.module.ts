import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeritFormulasModule } from '../merit-formulas/merit-formulas.module.js';
import { OfferFeesModule } from '../offer-fees/offer-fees.module.js';
import {
  ApplicantSelectionController,
  OfferEventsController,
  SelectionOffersController,
} from './selection-offers.controller.js';
import { SelectionOffersService } from './selection-offers.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([]), MeritFormulasModule, OfferFeesModule],
  controllers: [
    SelectionOffersController,
    ApplicantSelectionController,
    OfferEventsController,
  ],
  providers: [SelectionOffersService],
  exports: [SelectionOffersService],
})
export class SelectionOffersModule {}
