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
  authLogin: '/api/v1/auth/login',
  departments: '/api/v1/admissions/departments',
  departmentsProgrammesStats: '/api/v1/admissions/departments-programmes/stats',
  programmes: '/api/v1/admissions/programmes',
  generalCriteria: '/api/v1/admissions/general-criteria',
  generalFees: '/api/v1/admissions/general-fees',
  criteriaTypes: '/api/v1/admissions/criteria-types',
  feeTypes: '/api/v1/admissions/fee-types',
  intake: '/api/v1/admissions/intake',
  intakeStats: '/api/v1/admissions/intake/stats',
  intakes: '/api/v1/admissions/intakes',
  offering: '/api/v1/admissions/offerings',
  criteria: '/api/v1/admissions/criteria',
  fees: '/api/v1/admissions/fees',
  supportingInformation: '/api/v1/admissions/supporting-information',
  applicantOfferings: '/api/v1/applicant/admissions/offerings',
  attendanceQr: (qrToken: string) =>
    `/api/v1/admissions/attendance/qr/${encodeURIComponent(qrToken)}`,
  attendanceQrScan: (qrToken: string) =>
    `/api/v1/admissions/attendance/qr/${encodeURIComponent(qrToken)}/scan`,
  markAttendance: (applicantId: string) =>
    `/api/v1/admissions/applications/${applicantId}/attendance`,
} as const
