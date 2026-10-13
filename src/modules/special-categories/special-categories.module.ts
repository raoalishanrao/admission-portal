import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationProgrammeOptionEntity } from '../../database/entities/application-programme-options.entity.js';
import { ApplicationSpecialCategoryClaimEntity } from '../../database/entities/application-special-category-claim.entity.js';
import { ApplicationEntity } from '../../database/entities/application.entity.js';
import { OfferingSpecialCategoryEntity } from '../../database/entities/offering-special-category.entity.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import { SpecialCategoryEntity } from '../../database/entities/special-category.entity.js';
import {
  ApplicantSpecialCategoriesController,
  OfferingSpecialCategoriesAdminController,
  SpecialCategoriesAdminController,
} from './special-categories.controller.js';
import { SpecialCategoriesService } from './special-categories.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpecialCategoryEntity,
      OfferingSpecialCategoryEntity,
      ApplicationSpecialCategoryClaimEntity,
      ApplicationEntity,
      ApplicationProgrammeOptionEntity,
      ProgrammeOfferingEntity,
    ]),
  ],
  controllers: [
    SpecialCategoriesAdminController,
    OfferingSpecialCategoriesAdminController,
    ApplicantSpecialCategoriesController,
  ],
  providers: [SpecialCategoriesService],
  exports: [SpecialCategoriesService],
})
export class SpecialCategoriesModule {}
