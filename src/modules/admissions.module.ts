import { Module } from '@nestjs/common';
import { AdmissionCriteriaModule } from './admission-criteria/admission-criteria.module.js';
import { ApplicantAdmissionsModule } from './applicant-admissions/applicant-admissions.module.js';
import { ApplicantApplicationsModule } from './applicant-applications/applicant-applications.module.js';
import { ApplicantRegistrationsModule } from './applicant-registrations/applicant-registrations.module.js';
import { CriteriaTypesModule } from './criteria-types/criteria-types.module.js';
import { DeclarationTypesModule } from './declaration-types/declaration-types.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { FeeTypesModule } from './fee-types/fee-types.module.js';
import { GeneralCriteriaModule } from './general-criteria/general-criteria.module.js';
import { GeneralDeclarationsModule } from './general-declarations/general-declarations.module.js';
import { IntakesModule } from './intakes/intakes.module.js';
import { OfferingDeclarationsModule } from './offering-declarations/offering-declarations.module.js';
import { OfferingFeesModule } from './offering-fees/offering-fees.module.js';
import { ProgrammeFeesModule } from './programme-fees/programme-fees.module.js';
import { ProgrammeOfferingsModule } from './programme-offerings/programme-offerings.module.js';
import { ProgrammesModule } from './programmes/programmes.module.js';
import { SupportingInformationModule } from './supporting-information/supporting-information.module.js';
import { ProcessingFeeModule } from './processing-fee/processing-fee.module.js';
import { OfferFeesModule } from './offer-fees/offer-fees.module.js';
import { AdmissionDocumentsModule } from './admission-documents/admission-documents.module.js';
import { AcademicLevelRequirementsModule } from './academic-level-requirements/academic-level-requirements.module.js';
import { ApplicationReviewModule } from './application-review/application-review.module.js';
import { EntryTestModule } from './entry-test/entry-test.module.js';
import { MeritFormulasModule } from './merit-formulas/merit-formulas.module.js';
import { SelectionOffersModule } from './selection-offers/selection-offers.module.js';

/**
 * ADM-F000 domain aggregate — Intake & Offering Management.
 * Also wires ADM-F001 registration and ADM-F002 application completion.
 */
@Module({
  imports: [
    DepartmentsModule,
    ProgrammesModule,
    CriteriaTypesModule,
    FeeTypesModule,
    DeclarationTypesModule,
    AcademicLevelRequirementsModule,
    MeritFormulasModule,
    IntakesModule,
    ProgrammeOfferingsModule,
    GeneralCriteriaModule,
    AdmissionCriteriaModule,
    ProgrammeFeesModule,
    OfferingFeesModule,
    GeneralDeclarationsModule,
    OfferingDeclarationsModule,
    SupportingInformationModule,
    ApplicantAdmissionsModule,
    ApplicantRegistrationsModule,
    ApplicantApplicationsModule,
    ProcessingFeeModule,
    OfferFeesModule,
    AdmissionDocumentsModule,
    ApplicationReviewModule,
    EntryTestModule,
    SelectionOffersModule,
  ],
  exports: [
    DepartmentsModule,
    ProgrammesModule,
    CriteriaTypesModule,
    FeeTypesModule,
    DeclarationTypesModule,
    AcademicLevelRequirementsModule,
    MeritFormulasModule,
    IntakesModule,
    ProgrammeOfferingsModule,
    GeneralCriteriaModule,
    AdmissionCriteriaModule,
    ProgrammeFeesModule,
    OfferingFeesModule,
    GeneralDeclarationsModule,
    OfferingDeclarationsModule,
    SupportingInformationModule,
    ApplicantAdmissionsModule,
    ApplicantRegistrationsModule,
    ApplicantApplicationsModule,
    ProcessingFeeModule,
    OfferFeesModule,
    AdmissionDocumentsModule,
    ApplicationReviewModule,
    EntryTestModule,
    SelectionOffersModule,
  ],
})
export class AdmissionsModule {}
