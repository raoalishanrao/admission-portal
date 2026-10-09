function readEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/** API origin — no trailing slash. Set via VITE_API_BASE_URL in `.env`. */
export const API_BASE_URL = readEnv('VITE_API_BASE_URL').replace(/\/$/, '')

/** Relative API paths — defined in code, combined with API_BASE_URL in the client. */
export const API_ENDPOINTS = {
  applicantIntakes: '/api/v1/applicant/admissions/intakes',
  applicantIntake: (intakeId: string) => `/api/v1/applicant/admissions/intakes/${intakeId}`,
  applicantIntakeProgrammes: (intakeId: string) =>
    `/api/v1/applicant/admissions/intakes/${intakeId}/programmes`,
  applicantOffering: (offeringId: string) =>
    `/api/v1/applicant/admissions/offerings/${offeringId}`,
  applicantOfferingCriteria: (offeringId: string) =>
    `/api/v1/applicant/admissions/offerings/${offeringId}/criteria`,
  applicantOfferingFees: (offeringId: string) =>
    `/api/v1/applicant/admissions/offerings/${offeringId}/fees`,
  applicantOfferingDeclarations: (offeringId: string) =>
    `/api/v1/applicant/admissions/offerings/${offeringId}/declarations`,
  applicantOfferingStartApplication: (offeringId: string) =>
    `/api/v1/applicant/admissions/offerings/${offeringId}/start-application`,
  applicantRegister: '/api/v1/applicants/applications/registrations',
  applicantSetPassword: '/api/v1/applicants/applications/auth/set-password',
  applicantApplicationsMine: '/api/v1/applicants/me/applications',
  authLogin: '/api/v1/auth/login',
  applicationProgramme: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/programme`,
  applicationAcademic: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/academic`,
  applicationAcademicRequiredLevels: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/academic/required-levels`,
  applicationAcademicDocument: (applicantId: string, academicInformationId: string) =>
    `/api/v1/applicants/applications/${applicantId}/academic/${academicInformationId}/documents`,
  applicationAcademicDocumentById: (
    applicantId: string,
    academicInformationId: string,
    documentId: string,
  ) =>
    `/api/v1/applicants/applications/${applicantId}/academic/${academicInformationId}/documents/${documentId}`,
  applicationAddresses: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/addresses`,
  applicationContacts: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/contacts`,
  applicationProfile: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/profile`,
  applicationPhotograph: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/profile/photograph`,
  applicationDeclaration: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/declaration`,
  applicationDeclarationTexts: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/declaration/texts`,
  applicationSubmit: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/submit`,
  processingFeeChallan: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/processing-fee/challan`,
  processingFeeChallanPrint: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/processing-fee/challan/print`,
  processingFeeStatus: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/processing-fee/status`,
  applicantDocuments: (applicantId: string) =>
    `/api/v1/applicant/applications/${applicantId}/documents`,
  applicantDocumentRequirements: (applicantId: string) =>
    `/api/v1/applicant/applications/${applicantId}/documents/requirements`,
  applicantDocumentCompleteness: (applicantId: string) =>
    `/api/v1/applicant/applications/${applicantId}/documents/completeness`,
  applicantDocument: (applicantId: string, documentId: string) =>
    `/api/v1/applicant/applications/${applicantId}/documents/${documentId}`,
  applicantDocumentReplace: (applicantId: string, documentId: string) =>
    `/api/v1/applicant/applications/${applicantId}/documents/${documentId}/replace`,
  processingFeeEvidence: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/processing-fee/evidence`,
  processingFeeOnlinePayment: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/processing-fee/payment`,
  processingFeeOnlinePaymentStatus: (applicantId: string) =>
    `/api/v1/applicants/applications/${applicantId}/processing-fee/payment-status`,
  applicantAdmitCard: (applicantId: string) =>
    `/api/v1/applicant/applications/${applicantId}/admit-card`,
  applicantResults: '/api/v1/applicant/results',
  applicantOffer: '/api/v1/applicant/offer',
  applicantOfferFeeChallan: (applicantId: string) =>
    `/api/v1/applicant/applications/${applicantId}/offer-fee/challan`,
  applicantOfferFeeEvidence: (applicantId: string) =>
    `/api/v1/applicant/applications/${applicantId}/offer-fee/evidence`,
} as const
