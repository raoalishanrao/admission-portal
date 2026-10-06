/** ADM-F002 controlled values for application completion child tables. */

/** Controlled academic qualification codes (one row per code per application). */
export enum AcademicDegreeType {
  MATRIC = 'MATRIC',
  FSC = 'FSC',
  BACHELOR = 'BACHELOR',
  MASTER = 'MASTER',
  DOCTORATE = 'DOCTORATE',
}

export enum AcademicDocumentType {
  CERTIFICATE = 'CERTIFICATE',
  MARKSHEET = 'MARKSHEET',
  TRANSCRIPT = 'TRANSCRIPT',
}

export enum AcademicDocumentVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum QualificationLevel {
  UNDERGRADUATE = 'UNDERGRADUATE',
  POSTGRADUATE = 'POSTGRADUATE',
  PHD = 'PHD',
}

export enum ApplicationAddressType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
}

export enum ApplicationContactType {
  PARENT = 'PARENT',
  GUARDIAN = 'GUARDIAN',
  EMERGENCY = 'EMERGENCY',
}
