import { Module } from '@nestjs/common';
import { AdmissionsLookupsController } from './admissions-lookups.controller.js';

@Module({
  controllers: [AdmissionsLookupsController],
})
export class AdmissionsLookupsModule {}
