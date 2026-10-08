export type ApplicationBinding = {
  applicantId: string
  applicationId?: string
  applicationReference: string
  intakeSessionId: string
  email: string
  updatedAt: string
}

export type ApplicantIdentityCache = {
  email: string
  applicantName: string
  mobileNumber: string
  cnicNumber?: string
  passportNumber?: string
  lastApplicantId?: string
  updatedAt: string
}

const BINDINGS_KEY = 'taleem_applicant_application_bindings'
const IDENTITY_KEY = 'taleem_applicant_identity_cache'

function readBindings(): ApplicationBinding[] {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ApplicationBinding[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeBindings(items: ApplicationBinding[]) {
  localStorage.setItem(BINDINGS_KEY, JSON.stringify(items))
}

export function upsertApplicationBinding(
  binding: Omit<ApplicationBinding, 'updatedAt'> & { updatedAt?: string },
) {
  const next: ApplicationBinding = {
    ...binding,
    email: binding.email.trim().toLowerCase(),
    updatedAt: binding.updatedAt ?? new Date().toISOString(),
  }
  const items = readBindings().filter(
    item =>
      !(
        item.intakeSessionId === next.intakeSessionId &&
        item.email === next.email
      ) && item.applicantId !== next.applicantId,
  )
  items.push(next)
  writeBindings(items)

  const identity = getApplicantIdentity(next.email)
  if (identity) {
    saveApplicantIdentity({
      ...identity,
      lastApplicantId: next.applicantId,
    })
  }

  return next
}

export function getApplicationBindingForIntake(email: string, intakeSessionId: string) {
  const normalized = email.trim().toLowerCase()
  return (
    readBindings().find(
      item => item.email === normalized && item.intakeSessionId === intakeSessionId,
    ) ?? null
  )
}

export function getApplicationBindingByApplicantId(applicantId: string) {
  return readBindings().find(item => item.applicantId === applicantId) ?? null
}

export function getLatestApplicationBinding(email: string) {
  const normalized = email.trim().toLowerCase()
  const matches = readBindings()
    .filter(item => item.email === normalized)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return matches[0] ?? null
}

/** One application at a time — any binding for this email counts as active. */
export function getActiveApplication(email: string) {
  return getLatestApplicationBinding(email)
}

export function hasActiveApplication(email: string) {
  return getActiveApplication(email) != null
}

export function listApplicationBindingsForEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return readBindings()
    .filter(item => item.email === normalized)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveApplicantIdentity(
  identity: Omit<ApplicantIdentityCache, 'updatedAt'> & { updatedAt?: string },
) {
  const next: ApplicantIdentityCache = {
    ...identity,
    email: identity.email.trim().toLowerCase(),
    updatedAt: identity.updatedAt ?? new Date().toISOString(),
  }
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(next))
  return next
}

export function getApplicantIdentity(email: string): ApplicantIdentityCache | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ApplicantIdentityCache
    if (parsed.email?.trim().toLowerCase() !== email.trim().toLowerCase()) return null
    return parsed
  } catch {
    return null
  }
}

export function clearApplicationBindings() {
  localStorage.removeItem(BINDINGS_KEY)
}

export function applicationPath(applicantId: string, offeringId?: string | null) {
  return offeringId
    ? `/applications/${applicantId}?offeringId=${encodeURIComponent(offeringId)}`
    : `/applications/${applicantId}`
}

export function submittedApplicationPath(applicantId: string) {
  return `/applications/${applicantId}/view`
}
