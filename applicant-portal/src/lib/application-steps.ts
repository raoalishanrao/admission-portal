import type { ApplicationStepId, QualificationLevel } from '@/lib/api/types'

export const APPLICATION_STEPS: Array<{
  id: ApplicationStepId
  number: number
  title: string
  shortTitle: string
  description: string
}> = [
  {
    id: 'programme',
    number: 1,
    title: 'Programme Selection',
    shortTitle: 'Programme',
    description: 'Choose your preferred programmes for this intake.',
  },
  {
    id: 'academic',
    number: 2,
    title: 'Academic Details',
    shortTitle: 'Academic',
    description: 'Add qualification information (board, marks, year) for each required level.',
  },
  {
    id: 'documents',
    number: 3,
    title: 'Admission Documents',
    shortTitle: 'Documents',
    description: 'Upload required admission document files for your selected programmes.',
  },
  {
    id: 'profile',
    number: 4,
    title: 'Personal Information',
    shortTitle: 'Personal',
    description:
      'Your personal details, photograph, address, parent/guardian, and emergency contact.',
  },
  {
    id: 'declaration',
    number: 5,
    title: 'Declarations',
    shortTitle: 'Declarations',
    description: 'Review and accept the required declarations.',
  },
  {
    id: 'review',
    number: 6,
    title: 'Review & Submit',
    shortTitle: 'Review',
    description: 'Confirm your application and submit for review.',
  },
]

/** Blood relations allowed for EMERGENCY contacts (must not be FATHER/GUARDIAN). */
export const EMERGENCY_RELATIONSHIP_OPTIONS = [
  'MOTHER',
  'BROTHER',
  'SISTER',
  'UNCLE',
  'AUNT',
  'GRANDFATHER',
  'GRANDMOTHER',
  'COUSIN',
] as const

export const PARENT_GUARDIAN_RELATIONSHIP_OPTIONS = [
  'FATHER',
  'MOTHER',
  'GUARDIAN',
] as const

export const APPLICATION_STEP_ORDER: ApplicationStepId[] = APPLICATION_STEPS.map(
  step => step.id,
)

export function qualificationLevelFromDegree(degreeLevel: string): QualificationLevel {
  const normalized = degreeLevel.toLowerCase()
  if (normalized.includes('phd') || normalized.includes('doctor')) return 'PHD'
  if (
    normalized.includes('master') ||
    normalized.includes('post') ||
    normalized === 'pg' ||
    normalized.includes('ms') ||
    normalized.includes('mphil')
  ) {
    return 'POSTGRADUATE'
  }
  return 'UNDERGRADUATE'
}

export function qualificationLevelLabel(level: QualificationLevel) {
  if (level === 'UNDERGRADUATE') return 'Undergraduate'
  if (level === 'POSTGRADUATE') return 'Postgraduate'
  return 'PhD'
}

export function calcPercentage(obtained: string, total: string) {
  const obt = Number(obtained)
  const tot = Number(total)
  if (!Number.isFinite(obt) || !Number.isFinite(tot) || tot <= 0) return 0
  return Math.round((obt / tot) * 10000) / 100
}

/** Controlled codes accepted by the API (one record per code). */
export const DEGREE_TYPE_OPTIONS = [
  { value: 'MATRIC', label: 'Matric / SSC' },
  { value: 'FSC', label: 'Intermediate / FSc / HSSC' },
  { value: 'BACHELOR', label: 'Bachelor' },
  { value: 'MASTER', label: 'Master' },
  { value: 'DOCTORATE', label: 'Doctorate / PhD' },
] as const

export function academicDegreeLabel(code: string) {
  return (
    DEGREE_TYPE_OPTIONS.find((item) => item.value === code.toUpperCase())
      ?.label ?? code
  )
}

/** Degree label, plus qualification name only when it adds detail. */
export function academicRecordTitle(
  degreeType: string,
  qualificationName?: string | null,
) {
  const label = academicDegreeLabel(degreeType)
  const name = qualificationName?.trim()
  if (!name) return label
  const normalizedName = name.toUpperCase()
  if (
    normalizedName === degreeType.trim().toUpperCase() ||
    normalizedName === label.toUpperCase()
  ) {
    return label
  }
  return `${label} · ${name}`
}

/** Common Pakistan education boards / exam bodies. */
export const PAKISTAN_BOARD_OPTIONS = [
  'Federal Board of Intermediate and Secondary Education (FBISE), Islamabad',
  'BISE Abbottabad',
  'BISE Bahawalpur',
  'BISE Bannu',
  'BISE Dera Ghazi Khan',
  'BISE Dera Ismail Khan',
  'BISE Faisalabad',
  'BISE Gujranwala',
  'BISE Hyderabad',
  'BISE Islamabad',
  'BISE Karachi',
  'BISE Kohat',
  'BISE Lahore',
  'BISE Larkana',
  'BISE Malakand',
  'BISE Mardan',
  'BISE Mirpurkhas',
  'BISE Multan',
  'BISE Nawabshah (Shaheed Benazirabad)',
  'BISE Peshawar',
  'BISE Quetta',
  'BISE Rawalpindi',
  'BISE Sahiwal',
  'BISE Sargodha',
  'BISE Sukkur',
  'BISE Swat',
  'Board of Intermediate Education Karachi (BIEK)',
  'Board of Secondary Education Karachi (BSEK)',
  'AJK Board of Intermediate and Secondary Education, Mirpur',
  'Gilgit-Baltistan Board of Intermediate and Secondary Education',
  'Agha Khan University Examination Board (AKU-EB)',
  'Cambridge Assessment International Education (CAIE)',
  'Edexcel / Pearson',
  'Technical Education & Vocational Training Authority (TEVTA)',
  'Other / University / Institution',
] as const

export function passingYearOptions(fromYear = 1970) {
  const current = new Date().getFullYear()
  const years: string[] = []
  for (let year = current; year >= fromYear; year -= 1) {
    years.push(String(year))
  }
  return years
}

export const DIVISION_OPTIONS = [
  { value: '1st', label: '1st Division' },
  { value: '2nd', label: '2nd Division' },
  { value: '3rd', label: '3rd Division' },
  { value: 'N/A', label: 'N/A' },
] as const

export const GRADE_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'N/A', label: 'N/A' },
] as const

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'MARKSHEET', label: 'Mark Sheet' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'TRANSCRIPT', label: 'Transcript' },
] as const

export const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
] as const

/** Primary nationality for applicant profile (stored as country code). */
export const NATIONALITY_OPTIONS = [
  { value: 'PK', label: 'Pakistani' },
] as const

/** Pakistan provinces / territories for domicile (and address province). */
export const DOMICILE_PROVINCE_OPTIONS = [
  { value: 'PK-PB', label: 'Punjab' },
  { value: 'PK-SD', label: 'Sindh' },
  { value: 'PK-KP', label: 'Khyber Pakhtunkhwa' },
  { value: 'PK-BA', label: 'Balochistan' },
  { value: 'PK-IS', label: 'Islamabad Capital Territory' },
  { value: 'PK-GB', label: 'Gilgit-Baltistan' },
  { value: 'PK-AJK', label: 'Azad Jammu & Kashmir' },
] as const

export const COUNTRY_OPTIONS = [
  { value: 'PK', label: 'Pakistan' },
] as const

/** Map legacy domicile codes (e.g. PK-PB-LHE) onto province values. */
export function normalizeDomicileProvinceId(code: string | null | undefined) {
  if (!code?.trim()) return ''
  const normalized = code.trim().toUpperCase()
  const exact = DOMICILE_PROVINCE_OPTIONS.find(item => item.value === normalized)
  if (exact) return exact.value
  const prefix = DOMICILE_PROVINCE_OPTIONS.find(
    item =>
      normalized === item.value ||
      normalized.startsWith(`${item.value}-`),
  )
  return prefix?.value ?? normalized
}

/** Major cities by province / territory code (stored as city name). */
export const CITIES_BY_PROVINCE: Record<string, readonly string[]> = {
  'PK-PB': [
    'Lahore',
    'Faisalabad',
    'Rawalpindi',
    'Multan',
    'Gujranwala',
    'Sialkot',
    'Bahawalpur',
    'Sargodha',
    'Sheikhupura',
    'Jhang',
    'Rahim Yar Khan',
    'Gujrat',
    'Sahiwal',
    'Okara',
    'Wah Cantonment',
    'Dera Ghazi Khan',
    'Kasur',
    'Chiniot',
    'Kamoke',
    'Hafizabad',
    'Other',
  ],
  'PK-SD': [
    'Karachi',
    'Hyderabad',
    'Sukkur',
    'Larkana',
    'Nawabshah (Shaheed Benazirabad)',
    'Mirpur Khas',
    'Jacobabad',
    'Shikarpur',
    'Khairpur',
    'Dadu',
    'Thatta',
    'Badin',
    'Other',
  ],
  'PK-KP': [
    'Peshawar',
    'Mardan',
    'Abbottabad',
    'Swat (Mingora)',
    'Kohat',
    'Dera Ismail Khan',
    'Charsadda',
    'Nowshera',
    'Mansehra',
    'Bannu',
    'Swabi',
    'Other',
  ],
  'PK-BA': [
    'Quetta',
    'Turbat',
    'Khuzdar',
    'Chaman',
    'Gwadar',
    'Sibi',
    'Zhob',
    'Loralai',
    'Other',
  ],
  'PK-IS': ['Islamabad', 'Other'],
  'PK-GB': [
    'Gilgit',
    'Skardu',
    'Hunza',
    'Ghizer',
    'Diamer (Chilas)',
    'Ghanche',
    'Other',
  ],
  'PK-AJK': [
    'Muzaffarabad',
    'Mirpur',
    'Kotli',
    'Rawalakot',
    'Bhimber',
    'Bagh',
    'Other',
  ],
}

export function citiesForProvince(provinceId: string | null | undefined): string[] {
  const code = normalizeDomicileProvinceId(provinceId)
  if (!code) return []
  return [...(CITIES_BY_PROVINCE[code] ?? [])]
}

export function domicileProvinceLabel(code: string | null | undefined) {
  if (!code) return '—'
  const normalized = code.trim().toUpperCase()
  const exact = DOMICILE_PROVINCE_OPTIONS.find(item => item.value === normalized)
  if (exact) return exact.label
  const prefix = DOMICILE_PROVINCE_OPTIONS.find(item =>
    normalized.startsWith(`${item.value}-`) || normalized.startsWith(item.value),
  )
  return prefix?.label ?? code
}

export function nationalityLabel(code: string | null | undefined) {
  if (!code) return '—'
  return (
    NATIONALITY_OPTIONS.find(item => item.value === code.trim().toUpperCase())?.label ??
    code
  )
}

export const MARITAL_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'OTHER', label: 'Other' },
] as const

export const CONTACT_TYPE_OPTIONS = [
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'GUARDIAN', label: 'Guardian' },
] as const

export const ADDRESS_TYPE_OPTIONS = [
  { value: 'PRIMARY', label: 'Primary' },
  { value: 'SECONDARY', label: 'Secondary' },
] as const

export const REFERRAL_OPTIONS = [
  { value: 'FRIEND', label: 'Friend' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'SOCIAL', label: 'Social Media' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'ADVERTISEMENT', label: 'Advertisement' },
  { value: 'OTHER', label: 'Other' },
] as const
