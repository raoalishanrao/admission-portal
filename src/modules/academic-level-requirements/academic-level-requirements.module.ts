import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicLevelRequirementEntity } from '../../database/entities/academic-level-requirement.entity.js';
import { AcademicLevelRequirementsController } from './academic-level-requirements.controller.js';
import { AcademicLevelRequirementsService } from './academic-level-requirements.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicLevelRequirementEntity])],
  controllers: [AcademicLevelRequirementsController],
  providers: [AcademicLevelRequirementsService],
  exports: [AcademicLevelRequirementsService],
})
export class AcademicLevelRequirementsModule {}
