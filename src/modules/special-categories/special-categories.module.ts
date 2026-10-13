import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationSpecialCategoryClaimEntity } from '../../database/entities/application-special-category-claim.entity.js';
import { ApplicationEntity } from '../../database/entities/application.entity.js';
import { SpecialCategoryEntity } from '../../database/entities/special-category.entity.js';
import {
  ApplicantSpecialCategoriesController,
  SpecialCategoriesAdminController,
} from './special-categories.controller.js';
import { SpecialCategoriesService } from './special-categories.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpecialCategoryEntity,
      ApplicationSpecialCategoryClaimEntity,
      ApplicationEntity,
    ]),
  ],
  controllers: [
    SpecialCategoriesAdminController,
    ApplicantSpecialCategoriesController,
  ],
  providers: [SpecialCategoriesService],
  exports: [SpecialCategoriesService],
})
export class SpecialCategoriesModule {}
