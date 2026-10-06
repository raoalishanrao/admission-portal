import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ApplicationAdmitCardEntity,
  ApplicationAttendanceAuditEntity,
  ApplicationAttendanceEntity,
  ApplicationAttendanceScanEntity,
  ApplicationContactEntity,
  ApplicationEntity,
  ApplicationEntryTestOutcomeEntity,
  ApplicationProgrammeOptionEntity,
  IntakeEntity,
  ProgrammeEntity,
  ProgrammeOfferingEntity,
  TestCentreEntity,
  TestSessionEntity,
  TestSessionProgrammeEntity,
} from '../../database/entities/index.js';
import { StorageModule } from '../../integrations/storage/storage.module.js';
import {
  ApplicantAdmitCardController,
  EntryTestAdminController,
} from './entry-test.controller.js';
import { EntryTestService } from './entry-test.service.js';

@Module({
  imports: [
    StorageModule,
    TypeOrmModule.forFeature([
      TestCentreEntity,
      TestSessionEntity,
      TestSessionProgrammeEntity,
      ApplicationAdmitCardEntity,
      ApplicationAttendanceEntity,
      ApplicationAttendanceScanEntity,
      ApplicationAttendanceAuditEntity,
      ApplicationEntryTestOutcomeEntity,
      ApplicationEntity,
      ApplicationProgrammeOptionEntity,
      ApplicationContactEntity,
      IntakeEntity,
      ProgrammeOfferingEntity,
      ProgrammeEntity,
    ]),
  ],
  controllers: [EntryTestAdminController, ApplicantAdmitCardController],
  providers: [EntryTestService],
  exports: [EntryTestService],
})
export class EntryTestModule {}
