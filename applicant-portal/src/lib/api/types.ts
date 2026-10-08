export type ApiSuccessResponse<T> = {
  success: true
  data: T
}

export type ApiErrorResponse = {
  success: false
  statusCode: number
  code: string
  message: string | string[]
  path: string
  timestamp: string
}

export type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PaginatedItems<T> = {
  items: T[]
  meta: PaginationMeta
}

export type ApplicantIntake = {
  id: string
  intakeName: string
  intakeCode: string
  applicationOpenAt: string
  applicationCloseAt: string
  publishedAt: string | null
}

export type ApplicantProgrammeSummary = {
  id: string
  code: string
  name: string
  degreeLevel: string
  programmeGrouping: string | null
}

export type ApplicantOffering = {
  id: string
  intakeId: string
  programmeId: string
  programme: ApplicantProgrammeSummary
  publishedDescription: string
  displayOrder: number | null
  publishedAt: string | null
}

export type ApplicantCriterion = {
  id: string
  criteriaTypeId: string
  criteriaName: string | null
  criteriaRequirement: string
  criteriaOperator: string | null
  criteriaUnit: string | null
  mandatory: boolean
  sequenceNo: number | null
}

export type ApplicantFee = {
  id: string
  feeType: string
  amount: string
  currency: string
  effectiveFrom: string | null
  effectiveTo: string | null
  sortOrder: number | null
}

export type ApplicantWindowStatus = 'open' | 'upcoming' | 'closed'

export type RegisterApplicantRequest = {
  intakeSessionId: string
  applicantName: string
  registeredEmail: string
  mobileNumber: string
  cnicNumber?: string
  passportNumber?: string
}

export type RegistrationResponse = {
  applicantId: string
  applicationId: string
  applicationReference: string
  intakeSessionId: string
  applicationStatus: string
  overallCompletion: number
  iamOnboardStatus: string
  verificationEmailSent: boolean
}

export type SetApplicantPasswordRequest = {
  token: string
  password: string
}

export type SetApplicantPasswordResponse = {
  userId: string
  email: string
  verified: boolean
  applicantId?: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  access_token: string
  user_id: string
  tenant_id: string
  email: string
  roles: string[]
}

export type ApplicantOwnedApplication = {
  applicantId: string
  applicationReference: string
  intakeSessionId: string
  intakeName: string | null
  applicationStatus: string
  overallCompletion: number
  submissionDate: string | null
  processingFeeStatus: string
  updatedAt: string
}

export type QualificationLevel = 'UNDERGRADUATE' | 'POSTGRADUATE' | 'PHD'

export type ProgrammeOptionInput = {
  programmeOfferingId: string
  preferenceOrder: number
}

export type ProgrammeOptionResponse = {
  id: string
  programmeOfferingId: string
  preferenceOrder: number
}

export type ProgrammeStepResponse = {
  applicantId: string
  intakeSessionId: string
  qualificationLevel: QualificationLevel | null
  appliedDate: string | null
  stepSaved: boolean
  savedAt: string | null
  options: ProgrammeOptionResponse[]
  programmeStepSaved: boolean
  overallCompletion: number
}

export type SaveProgrammeRequest = {
  qualificationLevel: QualificationLevel
  options: ProgrammeOptionInput[]
}

export type AcademicDocumentType = 'CERTIFICATE' | 'MARKSHEET' | 'TRANSCRIPT'

export type AcademicRecordFields = {
  degreeType: string
  rollNumber: string
  qualificationName: string
  boardOrInstitution: string
  passingYear: string
  division: string
  grade: string
  marksOrGpaObtained: string
  marksOrGpaTotal: string
  percentage: number
}

export type AcademicDocumentResponse = {
  id: string
  academicInformationId: string
  documentType: AcademicDocumentType
  fileReference: string
  downloadUrl: string
  originalFileName: string | null
  mimeType: string | null
  fileSize: number | null
  uploadedAt: string
  verificationStatus: string
}

export type AcademicRecordResponse = AcademicRecordFields & {
  id: string
  rollNumber: string | null
  documents: AcademicDocumentResponse[]
  createdAt: string
  updatedAt: string
}

export type AcademicStepResponse = {
  applicantId: string
  academicStepSaved: boolean
  overallCompletion: number
  records: AcademicRecordResponse[]
}

export type RequiredAcademicLevelGroup = {
  degreeLevel: string
  requiredAcademicCodes: string[]
  missingAcademicCodes: string[]
}

export type RequiredAcademicLevels = {
  applicantId: string
  byDegreeLevel: RequiredAcademicLevelGroup[]
  requiredAcademicCodes: string[]
  missingAcademicCodes: string[]
  complete: boolean
}

export type SaveAcademicRequest = {
  records: AcademicRecordFields[]
}

export type UpdateAcademicRequest = {
  records: Array<AcademicRecordFields & { id: string }>
}

export type AddressType = 'PRIMARY' | 'SECONDARY'

export type AddressFields = {
  addressType: AddressType
  addressLine1: string
  addressLine2?: string
  countryId: string
  provinceId: string
  cityId: string
  postalCode?: string
  isSameAsPrimary?: boolean
}

export type ApplicationAddressResponse = AddressFields & {
  id: string
  addressLine2: string | null
  postalCode: string | null
  isSameAsPrimary: boolean
}

export type ContactType = 'PARENT' | 'GUARDIAN' | 'EMERGENCY'

export type ContactFields = {
  contactType: ContactType
  name: string
  identityDocumentNumber?: string
  relationship: string
  occupation?: string
  mobileNumber: string
  telephone?: string
  email?: string
  addressLine?: string
}

export type ApplicationContactResponse = ContactFields & {
  id: string
  identityDocumentNumber: string | null
  occupation: string | null
  telephone: string | null
  email: string | null
  addressLine: string | null
}

export type SaveProfileRequest = {
  applicantName: string
  gender: string
  maritalStatus: string
  dateOfBirth: string
  mobileNumber: string
  telephone?: string
  primaryNationalityId: string
  secondaryNationalityId?: string
  domicileId?: string
  disabilityDeclared: boolean
  referralSource?: string
}

export type ProfileStepResponse = {
  applicantId: string
  applicantName: string
  gender: string | null
  maritalStatus: string | null
  dateOfBirth: string | null
  mobileNumber: string
  telephone: string | null
  profilePhotograph: string | null
  profilePhotographDownloadUrl: string | null
  primaryNationalityId: string | null
  secondaryNationalityId: string | null
  domicileId: string | null
  disabilityDeclared: boolean | null
  referralSource: string | null
  addresses: ApplicationAddressResponse[]
  contacts: ApplicationContactResponse[]
  profileStepSaved: boolean
  overallCompletion: number
}

export type ProfilePhotographResponse = {
  applicantId: string
  profilePhotograph: string
  downloadUrl: string
}

export type OfferingDeclarationText = {
  id: string
  programmeOfferingId: string
  declarationTypeId: string
  declarationText: string
  version: string
  effectiveFrom?: string
  effectiveTo?: string | null
}

/** Public browse of offering terms (pre-registration). Same shape as authenticated declaration texts. */
export type ApplicantOfferingDeclaration = OfferingDeclarationText

export type StartApplicationHandoff = {
  tenantId: string
  intakeId: string
  offeringId: string
  programmeId: string
  applicantUserId: string
}

export type StartApplicationResponse = {
  targetFeature: string
  offeringId: string
  intakeId: string
  programmeId: string
  handoff: StartApplicationHandoff
  nextAction: string
}

export type SaveDeclarationRequest = {
  declarationAccepted: boolean
  acceptedOfferingDeclarationIds: string[]
  disciplinaryIssueDeclared: boolean
  disciplinaryIssueDetails?: string
}

export type DeclarationStepResponse = {
  applicantId: string
  declarationAccepted: boolean
  declarationAcceptanceDate: string | null
  declarationVersion: string | null
  acceptedOfferingDeclarationIds: string[]
  disciplinaryIssueDeclared: boolean
  disciplinaryIssueDetails: string | null
  submissionDate: string | null
  declarationStepSaved: boolean
  overallCompletion: number
  applicationStatus: string
}

export type SubmitApplicationResponse = {
  applicantId: string
  applicationStatus: string
  overallCompletion: number
  submissionDate: string
}

export type ApplicationStepId =
  | 'programme'
  | 'academic'
  | 'profile'
  | 'declaration'
  | 'review'

export type ProcessingFeeChallanItem = {
  id: string
  feeTypeCode: string
  description: string
  quantity: string
  unitAmount: string
  amount: string
  currency: string
}

export type ProcessingFeeChallan = {
  id: string
  applicantId: string
  challanNumber: string
  issueDate: string
  dueDate: string
  applicantName: string
  applicantContactNumber?: string
  registrationNumber: string
  intakeSession: string
  programmesAppliedFor: string
  totalAmountPayable: string
  amountInWords: string
  paymentStatus: string
  latePaymentFlag: boolean
  collectionBankName: string
  bankLogoUrl: string | null
  collectionBankBranch: string
  collectionBankAccount: string
  branchCode: string
  institutionCode?: string | null
  items: ProcessingFeeChallanItem[]
}

export type ProcessingFeeCopyLabel = 'APPLICANT' | 'INSTITUTION' | 'BANK' | string

export type ProcessingFeePrintResponse = {
  challan: ProcessingFeeChallan
  copies: ProcessingFeeCopyLabel[]
}

export type ProcessingFeeStatusResponse = {
  applicantId: string
  applicationStatus: string
  paymentStatus: string
  challan: ProcessingFeeChallan | null
}

export type OnlinePaymentMethod = 'WALLET' | 'MOBILE_ACCOUNT'

export type OnlinePaymentStatus =
  | 'INITIATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED'
  | string

export type OnlinePayment = {
  id: string
  challanId: string
  paymentMethod: OnlinePaymentMethod | string
  transactionReference: string
  currency: string
  amount: string
  senderName: string
  status: OnlinePaymentStatus
  providerCode?: string | null
  notes?: string | null
  receiptRequired: boolean
  receiptUploaded: boolean
  paidAt?: string | null
  confirmedAt?: string | null
  createdAt?: string
}

export type CreateOnlinePaymentRequest = {
  paymentMethod: OnlinePaymentMethod
  transactionReference: string
  currency: string
  amount: number
  senderName: string
  providerCode?: string
  notes?: string
}

export type AdmissionDocumentStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'RESUBMISSION_REQUIRED'
  | 'VERIFIED'
  | string

export type AdmissionDocument = {
  id: string
  documentFileId?: string | null
  applicantId: string
  programmeOfferingId: string
  offeringRequiredDocumentId: string
  documentTypeId: string
  documentTypeCode: string
  documentTypeName: string
  mandatory: boolean
  conditionCode: string | null
  sourceModule: string
  sourceDocumentId: string | null
  fileReference: string | null
  downloadUrl: string | null
  fileName: string | null
  mimeType: string | null
  fileSizeBytes: string | null
  status: AdmissionDocumentStatus
  resubmissionReason: string | null
  submittedAt: string | null
  verifiedAt: string | null
}

export type ApplicantDocumentRequirement = {
  applicantId: string
  programmeOfferingId: string
  offeringRequiredDocumentId: string
  offeringRequiredDocumentIds: string[]
  programmeOfferingIds: string[]
  documentTypeId: string
  documentTypeCode: string
  documentTypeName: string
  mandatory: boolean
  conditionCode: string | null
  status: AdmissionDocumentStatus
  document: AdmissionDocument | null
}

export type DocumentCompleteness = {
  applicantId: string
  complete: boolean
  requiredCount: number
  verifiedCount: number
  requirements: ApplicantDocumentRequirement[]
}

export type PaymentEvidence = {
  id: string
  challanId: string
  evidenceSource: string
  fileFormat: string
  verificationIndicator: string
  isCurrent: boolean
  uploadDate: string
  downloadUrl: string
}

export type AdmitCardProgrammeOption = {
  preferenceOrder: number
  programmeId: string
  programmeCode: string
  programmeName: string
}

export type AdmitCard = {
  id: string
  applicantId?: string
  applicationId: string
  serialNumber?: string
  applicantName: string
  fatherGuardianName: string
  gender: string
  intakeSession: string
  photographDownloadUrl?: string | null
  programmeOptions: AdmitCardProgrammeOption[]
  testVenue: string
  testDate: string
  reportingTime: string
  testTime: string
  room: string
  issueDate: string
  instructions: string
  status: string
  qrUrl: string
  publishedAt: string
}

export type ApplicantTestResult = {
  id: string
  applicationReference: string
  testSessionId: string
  testScore: string | number
  totalMarks: string | number
  percentage: string | number
  resultStatus: string
  publishedAt: string
  testDate?: string | null
  reportingTime?: string | null
  testTime?: string | null
  room?: string | null
  centreName?: string | null
  centreLocation?: string | null
  testVenue?: string | null
}

export type AdmissionOffer = {
  id: string
  applicationRecordId: string
  programmeOfferingId: string
  offerType: string
  offerConditions: string | null
  offerIssueDate: string | null
  acceptanceDeadline: string | null
  feePaymentInstructions: string | null
  offerLetterDocument: string | null
  status: string
  publishedAt: string | null
  feeChallanId: string | null
}

export type OfferFeeChallanItem = {
  id: string
  feeTypeCode: string
  description: string
  quantity: string
  unitAmount: string
  amount: string
  currency: string
}

export type OfferFeeChallan = {
  id: string
  offerId: string
  applicantId: string
  programmeOfferingId: string
  challanNumber: string
  issueDate: string
  dueDate: string
  collectionBankName: string
  collectionBankBranch: string
  collectionBankAccount: string
  branchCode: string
  institutionCode: string | null
  applicantName: string
  applicantContactNumber: string
  registrationNumber: string
  intakeSession: string
  programmeName: string
  totalAmountPayable: string
  amountInWords: string
  paymentStatus: string
  paymentDate: string | null
  amountPaid: string | null
  latePaymentFlag: boolean
  items?: OfferFeeChallanItem[]
}

export type OfferFeeEvidence = {
  id: string
  challanId: string
  fileFormat: string
  evidenceSource: string
  amountClaimed: string | null
  verificationIndicator: string
  uploadDate: string
  downloadUrl: string | null
}

