import type { ApplicantWindowStatus } from '@/lib/api/types'

export function getIntakeWindowStatus(
  openAt: string,
  closeAt: string,
  now = new Date(),
): ApplicantWindowStatus {
  const open = new Date(openAt).getTime()
  const close = new Date(closeAt).getTime()
  const current = now.getTime()
  if (current < open) return 'upcoming'
  if (current > close) return 'closed'
  return 'open'
}

export function formatIntakeDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatIntakeDateTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function academicYearFromDate(iso: string) {
  const year = new Date(iso).getFullYear()
  return String(year)
}

/** Prefer year embedded in intake name/code (e.g. "Fall 2027") over application-open date. */
export function intakeDisplayYear(intakeName: string, intakeCode: string, openAt: string) {
  const match = `${intakeName} ${intakeCode}`.match(/\b(20\d{2})\b/)
  if (match?.[1]) return match[1]
  return academicYearFromDate(openAt)
}

export function intakeTermLabel(intakeName: string, intakeCode: string, openAt: string) {
  const trimmed = intakeName.trim()
  if (trimmed) return trimmed
  return `${inferIntakeSeason(intakeName, intakeCode)} ${intakeDisplayYear(intakeName, intakeCode, openAt)}`
}

export function degreeLevelSortKey(level: string) {
  const label = degreeLevelLabel(level).toLowerCase()
  if (label === 'bachelor') return 0
  if (label === 'master') return 1
  if (label === 'doctorate') return 2
  return 3
}

export function programmeInitials(code: string, name: string) {
  const fromCode = code.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  if (fromCode.length >= 2) return fromCode.slice(0, 3)
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}

const accentPalette = [
  'bg-[#dbeafe] text-[#1d4ed8]',
  'bg-[#dcfce7] text-[#15803d]',
  'bg-[#ede9fe] text-[#6d28d9]',
  'bg-[#ffedd5] text-[#c2410c]',
  'bg-[#e0f2fe] text-[#0369a1]',
]

export function programmeAccent(index: number) {
  return accentPalette[index % accentPalette.length]
}

export function degreeLevelLabel(level: string) {
  const normalized = level.toLowerCase()
  if (normalized.includes('bachelor') || normalized === 'ug' || normalized.includes('under')) {
    return 'Bachelor'
  }
  if (normalized.includes('master') || normalized === 'pg' || normalized.includes('post')) {
    return 'Master'
  }
  if (normalized.includes('doctor') || normalized.includes('phd')) return 'Doctorate'
  return level
}

export function inferIntakeSeason(intakeName: string, intakeCode: string) {
  const source = `${intakeName} ${intakeCode}`.toLowerCase()
  if (source.includes('fall') || source.includes('autumn')) return 'Fall'
  if (source.includes('spring')) return 'Spring'
  if (source.includes('summer')) return 'Summer'
  if (source.includes('winter')) return 'Winter'
  return 'General'
}

export function normalizeMobileNumber(raw: string, countryCode = '+92') {
  const digits = raw.replace(/\D/g, '')
  if (raw.trim().startsWith('+') && digits.length >= 10) return `+${digits}`
  if (digits.startsWith('92') && digits.length >= 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length >= 11) return `${countryCode}${digits.slice(1)}`
  if (digits.length === 10) return `${countryCode}${digits}`
  return raw.trim()
}

export function looksLikeCnic(value: string) {
  return /^\d{5}-\d{7}-\d$/.test(value.trim()) || /^\d{13}$/.test(value.replace(/-/g, ''))
}

export function formatCnic(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

/** Campus / campus-life images (verified Unsplash 200). Used for intake side panel + programme cards. */
const CAMPUS_IMAGES = [
  'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
]

export function campusImageForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % CAMPUS_IMAGES.length
  }
  return CAMPUS_IMAGES[hash]!
}

/** Soft solid fallback when a remote image fails to load. */
export const CAMPUS_IMAGE_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#dbeafe"/>
          <stop offset="100%" stop-color="#eef4ff"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
    </svg>`,
  )

