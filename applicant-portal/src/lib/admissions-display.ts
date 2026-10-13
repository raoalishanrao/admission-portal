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

const CAMPUS_IMAGES = [
  'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=800&q=80',
]

export function campusImageForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i) * (i + 1)) % CAMPUS_IMAGES.length
  return CAMPUS_IMAGES[hash]
}

