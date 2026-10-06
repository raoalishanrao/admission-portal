import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeritFormulaTemplateComponentEntity } from '../../database/entities/merit-formula-template-component.entity.js';
import { MeritFormulaTemplateEntity } from '../../database/entities/merit-formula-template.entity.js';
import { OfferingMeritFormulaComponentEntity } from '../../database/entities/offering-merit-formula-component.entity.js';
import { OfferingMeritFormulaEntity } from '../../database/entities/offering-merit-formula.entity.js';
import { ProgrammeOfferingEntity } from '../../database/entities/programme-offering.entity.js';
import { ProgrammeEntity } from '../../database/entities/programme.entity.js';
import { MeritFormulasController } from './merit-formulas.controller.js';
import { MeritFormulasService } from './merit-formulas.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeritFormulaTemplateEntity,
      MeritFormulaTemplateComponentEntity,
      OfferingMeritFormulaEntity,
      OfferingMeritFormulaComponentEntity,
      ProgrammeOfferingEntity,
      ProgrammeEntity,
    ]),
  ],
  controllers: [MeritFormulasController],
  providers: [MeritFormulasService],
  exports: [MeritFormulasService],
})
export class MeritFormulasModule {}
