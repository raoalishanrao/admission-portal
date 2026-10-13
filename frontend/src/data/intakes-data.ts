export type IntakeStatus = 'Draft' | 'Under Review' | 'Published' | 'Closed'

export type Intake = {
  code: string
  name: string
  applicationPeriod: string
  programmes: number
  status: IntakeStatus
  lastUpdated: string
}

export const intakeSteps = [
  { slug: 'intake-information', label: 'Intake Information', description: 'Basic details for this intake' },
  { slug: 'application-period', label: 'Application Period', description: 'Set opening and closing dates' },
  { slug: 'programme-offerings', label: 'Select Programmes', description: 'Select programmes for this intake' },
  { slug: 'criteria-and-fees', label: 'Criteria & Fees', description: 'Configure criteria and fees per programme' },
  {
    slug: 'supporting-information',
    label: 'Supporting Information',
    description: 'Add applicant-facing notes and instructions',
  },
  { slug: 'review-submit', label: 'Review & Submit', description: 'Review and submit for approval' },
] as const

export type IntakeStepSlug = (typeof intakeSteps)[number]['slug']

const legacyStepSlugs: Record<string, IntakeStepSlug> = {
  'admission-criteria': 'criteria-and-fees',
  'application-fees': 'criteria-and-fees',
  'additional-information': 'supporting-information',
}

export const intakes: Intake[] = [
  { code: 'F26', name: 'Fall 2026', applicationPeriod: '01 Aug 2026 – 30 Sep 2026', programmes: 12, status: 'Published', lastUpdated: '15 Jul 2026' },
  { code: 'S26', name: 'Spring 2026', applicationPeriod: '01 Jan 2026 – 28 Feb 2026', programmes: 8, status: 'Published', lastUpdated: '10 Jan 2026' },
  { code: 'F27', name: 'Fall 2027', applicationPeriod: '01 Aug 2027 – 30 Sep 2027', programmes: 7, status: 'Draft', lastUpdated: '10 Sep 2026' },
  { code: 'S27', name: 'Spring 2027', applicationPeriod: '01 Jan 2027 – 28 Feb 2027', programmes: 0, status: 'Draft', lastUpdated: '05 Sep 2026' },
  { code: 'F25', name: 'Fall 2025', applicationPeriod: '01 Aug 2025 – 30 Sep 2025', programmes: 10, status: 'Closed', lastUpdated: '01 Oct 2025' },
  { code: 'S25', name: 'Spring 2025', applicationPeriod: '01 Jan 2025 – 28 Feb 2025', programmes: 9, status: 'Published', lastUpdated: '20 Dec 2024' },
  { code: 'F28', name: 'Fall 2028', applicationPeriod: '01 Aug 2028 – 30 Sep 2028', programmes: 5, status: 'Under Review', lastUpdated: '12 Sep 2026' },
  { code: 'S24', name: 'Spring 2024', applicationPeriod: '01 Jan 2024 – 28 Feb 2024', programmes: 7, status: 'Published', lastUpdated: '15 Mar 2024' },
]

export const intakeStats = {
  total: 8,
  draft: 2,
  underReview: 1,
  published: 4,
  closed: 1,
}

export const intakeTypes = ['Fall', 'Spring', 'Summer', 'Winter']

/** Kept for compatibility; prefer AcademicYearField for selection. */
export const academicYears = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
  '2027-2028',
  '2028-2029',
  '2029-2030',
]

export type IntakeCriteriaCatalogItem = {
  id: string
  type: string
  requirement: string
  mandatory: 'Yes' | 'No'
}

export type IntakeFeeCatalogItem = {
  id: string
  feeType: string
  amount: string
  currency: string
  notes: string
}

export const intakeCriteriaCatalog: IntakeCriteriaCatalogItem[] = [
  { id: '1', type: 'Academic Qualification', requirement: 'Minimum 60% in Intermediate', mandatory: 'Yes' },
  { id: '2', type: 'Subject Requirement', requirement: 'Mathematics required', mandatory: 'Yes' },
  { id: '3', type: 'English Proficiency', requirement: 'IELTS 6.0 or equivalent', mandatory: 'Yes' },
  { id: '4', type: 'Entry Test Score', requirement: 'Minimum 50% in university entry test', mandatory: 'Yes' },
  { id: '5', type: 'Interview', requirement: 'Successful completion of admission interview', mandatory: 'No' },
  { id: '6', type: 'Document Submission', requirement: 'All required documents must be submitted', mandatory: 'Yes' },
]

export const intakeFeesCatalog: IntakeFeeCatalogItem[] = [
  { id: '1', feeType: 'Application Fee', amount: '5,000.00', currency: 'PKR', notes: 'Standard application processing fee' },
  { id: '2', feeType: 'Transcript Evaluation Fee', amount: '2,000.00', currency: 'PKR', notes: 'For international transcript evaluation' },
  { id: '3', feeType: 'Late Application Fee', amount: '3,000.00', currency: 'PKR', notes: 'Applied after closing date extension' },
]

export const intakeProgrammeOptions = [
  { name: 'Bachelor of Computer Science', code: 'BCS', level: 'Bachelor', department: 'Computer Science' },
  { name: 'Master of Computer Science', code: 'MCS', level: 'Master', department: 'Computer Science' },
  { name: 'Bachelor of Business Administration', code: 'BBA', level: 'Bachelor', department: 'Business Administration' },
  { name: 'Master of Business Administration', code: 'MBA', level: 'Master', department: 'Business Administration' },
  { name: 'Bachelor of Education', code: 'BED', level: 'Bachelor', department: 'Education' },
  { name: 'PhD in Computer Science', code: 'PHD-CS', level: 'Doctoral', department: 'Research' },
  { name: 'Bachelor of Engineering', code: 'BENG', level: 'Bachelor', department: 'Engineering' },
]

export function getIntakeByCode(code: string) {
  return intakes.find(i => i.code.toLowerCase() === code.toLowerCase())
}

export function getStepIndex(slug: string) {
  const resolved = legacyStepSlugs[slug] ?? slug
  return intakeSteps.findIndex(s => s.slug === resolved)
}

export function resolveStepSlug(slug: string): IntakeStepSlug | undefined {
  const resolved = legacyStepSlugs[slug] ?? slug
  return intakeSteps.find(s => s.slug === resolved)?.slug
}

export function getStepSlug(index: number): IntakeStepSlug {
  return intakeSteps[Math.max(0, Math.min(index, intakeSteps.length - 1))].slug
}
