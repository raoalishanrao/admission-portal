import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationEntity } from '../../database/entities/application.entity.js';
import { IntakeEntity } from '../../database/entities/intake.entity.js';
import { IamModule } from '../../integrations/base-platform/iam/iam.module.js';
import { EmailModule } from '../../integrations/email/email.module.js';
import {
  ApplicantMeController,
  ApplicantRegistrationsController,
} from './applicant-registrations.controller.js';
import { ApplicantRegistrationsService } from './applicant-registrations.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationEntity, IntakeEntity]),
    IamModule,
    EmailModule,
  ],
  controllers: [ApplicantRegistrationsController, ApplicantMeController],
  providers: [ApplicantRegistrationsService],
  exports: [ApplicantRegistrationsService],
})
export class ApplicantRegistrationsModule {}
