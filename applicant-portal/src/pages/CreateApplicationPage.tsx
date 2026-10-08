import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Headphones,
  IdCard,
  Loader2,
  Mail,
  Phone,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import {
  getApplicantIntake,
  getApplicantOffering,
  startOfferingApplication,
} from '@/lib/api/admissions'
import { getProgrammeStep } from '@/lib/api/applications'
import { registerApplicant } from '@/lib/api/registration'
import {
  applicationPath,
  getActiveApplication,
  getApplicantIdentity,
  getApplicationBindingForIntake,
  listApplicationBindingsForEmail,
  saveApplicantIdentity,
  upsertApplicationBinding,
} from '@/lib/application-session'
import type { ApplicantIntake, ApplicantOffering, RegistrationResponse } from '@/lib/api/types'
import {
  campusImageForId,
  degreeLevelLabel,
  formatCnic,
  looksLikeCnic,
  normalizeMobileNumber,
} from '@/lib/admissions-display'

type FieldErrors = {
  applicantName?: string
  registeredEmail?: string
  identity?: string
  mobileNumber?: string
  form?: string
}

export function CreateApplicationPage() {
  const { intakeId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const offeringId = searchParams.get('offeringId')
  const navigate = useNavigate()
  const { isAuthenticated, user, setApplicantId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intake, setIntake] = useState<ApplicantIntake | null>(null)
  const [offering, setOffering] = useState<ApplicantOffering | null>(null)

  const [applicantName, setApplicantName] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [identity, setIdentity] = useState('')
  const [mobileLocal, setMobileLocal] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [showApplicantIdRecovery, setShowApplicantIdRecovery] = useState(false)
  const [recoveryApplicantId, setRecoveryApplicantId] = useState('')

  const fieldErrors = useMemo(
    () =>
      validateForm(
        {
          applicantName,
          registeredEmail,
          identity,
          mobileLocal,
        },
        { requireIdentity: !isAuthenticated },
      ),
    [applicantName, registeredEmail, identity, mobileLocal, isAuthenticated],
  )

  useEffect(() => {
    if (!intakeId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const intakeData = await getApplicantIntake(intakeId)
        if (cancelled) return
        setIntake(intakeData)

        if (offeringId) {
          try {
            const offeringData = await getApplicantOffering(offeringId)
            if (!cancelled) setOffering(offeringData)
          } catch {
            if (!cancelled) setOffering(null)
          }
        }
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unable to load application context.')
        setIntake(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [intakeId, offeringId])

  useEffect(() => {
    if (!user) return
    setRegisteredEmail(user.email)
    setApplicantName(prev => prev || user.name)
    const cached = getApplicantIdentity(user.email)
    if (cached) {
      setApplicantName(cached.applicantName || user.name)
      const mobile = cached.mobileNumber.replace(/^\+92/, '').replace(/^0/, '')
      setMobileLocal(mobile)
      if (cached.cnicNumber) setIdentity(cached.cnicNumber)
      else if (cached.passportNumber) setIdentity(cached.passportNumber)
    }
  }, [user])

  // Logged-in users: one application at a time — open existing, or start only if none.
  useEffect(() => {
    if (!isAuthenticated || !user || !intake || loading || redirectTo) return

    const email = user.email
    const currentIntakeId = intake.id
    const knownApplicantId = user.applicantId
    let cancelled = false

    async function resolveLoggedIn() {
      setResolving(true)
      try {
        const active = getActiveApplication(email)
        if (active) {
          if (!cancelled) setRedirectTo(applicationPath(active.applicantId, offeringId))
          return
        }

        const existing = getApplicationBindingForIntake(email, currentIntakeId)
        if (existing) {
          if (!cancelled) setRedirectTo(applicationPath(existing.applicantId, offeringId))
          return
        }

        const candidates = new Set<string>()
        for (const binding of listApplicationBindingsForEmail(email)) {
          candidates.add(binding.applicantId)
        }
        if (knownApplicantId) candidates.add(knownApplicantId)
        const identity = getApplicantIdentity(email)
        if (identity?.lastApplicantId) candidates.add(identity.lastApplicantId)

        for (const applicantId of candidates) {
          try {
            const programme = await getProgrammeStep(applicantId)
            upsertApplicationBinding({
              applicantId,
              applicationReference: applicantId,
              intakeSessionId: programme.intakeSessionId || currentIntakeId,
              email,
            })
            setApplicantId(applicantId)
            if (!cancelled) setRedirectTo(applicationPath(applicantId, offeringId))
            return
          } catch {
            // Try next candidate
          }
        }

        // Only auto-start a brand-new application when none exists yet.
        if (identity?.mobileNumber && identity.applicantName) {
          try {
            if (offeringId) {
              await startOfferingApplication(offeringId)
            }
            const result = await createApplicationForUser({
              intakeId: currentIntakeId,
              applicantName: identity.applicantName,
              email,
              mobileNumber: identity.mobileNumber,
              cnicNumber: identity.cnicNumber,
              passportNumber: identity.passportNumber,
            })
            setApplicantId(result.applicantId)
            if (!cancelled) setRedirectTo(applicationPath(result.applicantId, offeringId))
            return
          } catch (err: unknown) {
            if (!cancelled && err instanceof ApiError) {
              setErrors({ form: err.message })
            }
          }
        }
      } finally {
        if (!cancelled) setResolving(false)
      }
    }

    void resolveLoggedIn()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user, intake, loading, offeringId, redirectTo, setApplicantId])

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />
  }

  function showError(field: keyof FieldErrors) {
    return (submitted || touched[field]) && errors[field]
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return
    if (!intake) return

    const emailForCreate = (
      isAuthenticated && user ? user.email : registeredEmail
    )
      .trim()
      .toLowerCase()
    const active = getActiveApplication(emailForCreate)
    if (active) {
      navigate(applicationPath(active.applicantId, offeringId), { replace: true })
      return
    }

    setSaving(true)
    try {
      if (isAuthenticated && offeringId) {
        await startOfferingApplication(offeringId)
      }
      const identityValue = identity.trim()
      const result = await createApplicationForUser({
        intakeId: intake.id,
        applicantName: applicantName.trim(),
        email: emailForCreate,
        mobileNumber: normalizeMobileNumber(mobileLocal),
        ...(identityValue
          ? looksLikeCnic(identityValue)
            ? { cnicNumber: formatCnic(identityValue) }
            : { passportNumber: identityValue }
          : {}),
      })

      setApplicantId(result.applicantId)
      const appPath = applicationPath(result.applicantId, offeringId)

      if (isAuthenticated || result.iamOnboardStatus === 'ACCESS_GRANTED') {
        navigate(appPath, { replace: true })
        return
      }

      navigate('/verify-email', {
        replace: true,
        state: {
          email: emailForCreate,
          applicationReference: result.applicationReference,
          verificationEmailSent: result.verificationEmailSent,
          intakeName: intake.intakeName,
          applicantId: result.applicantId,
          continuePath: appPath,
        },
      })
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const recoveredId = extractApplicantIdFromError(err)
        if (recoveredId) {
          upsertApplicationBinding({
            applicantId: recoveredId,
            applicationReference: recoveredId,
            intakeSessionId: intake.id,
            email: emailForCreate,
          })
          setApplicantId(recoveredId)
          navigate(applicationPath(recoveredId, offeringId), { replace: true })
          return
        }
        if (err.statusCode === 409 || /already|exist|duplicate|conflict/i.test(err.message)) {
          setErrors({
            form: `${err.message} If you already started this application, open it from your previous session or paste your Applicant ID below.`,
          })
          setShowApplicantIdRecovery(true)
          return
        }
        setErrors({ form: err.message })
        return
      }
      setErrors({
        form: err instanceof Error ? err.message : 'Unable to create application. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || (isAuthenticated && resolving)) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-xl border border-[#e4e9f4] bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-[#0c3cff]" />
          <p className="mt-3 text-sm text-[#354a8d]">
            {isAuthenticated ? 'Opening your application...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (error || !intake) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error ?? 'Intake not found.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-[#0c3cff] hover:underline">
          Back to admissions
        </Link>
      </div>
    )
  }

  const level = offering ? degreeLevelLabel(offering.programme.degreeLevel) : null
  const department = offering?.programme.programmeGrouping || null
  const image = campusImageForId(offering?.id ?? intakeId)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav className="mb-6 text-sm text-[#6374ab]">
        <Link to="/" className="hover:text-[#0c3cff]">
          Home
        </Link>
        <span className="mx-2">›</span>
        <Link to="/" className="hover:text-[#0c3cff]">
          Admissions
        </Link>
        <span className="mx-2">›</span>
        <Link to={`/intakes/${intake.id}`} className="hover:text-[#0c3cff]">
          {intake.intakeName}
        </Link>
        {offering ? (
          <>
            <span className="mx-2">›</span>
            <Link to={`/offerings/${offering.id}`} className="hover:text-[#0c3cff]">
              {offering.programme.code}
            </Link>
          </>
        ) : null}
        <span className="mx-2">›</span>
        <span className="text-[#071759]">
          {isAuthenticated ? 'Start Application' : 'Create Application'}
        </span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-[#e4e9f4] bg-white">
            <div
              className="h-36 bg-cover bg-center"
              style={{ backgroundImage: `url('${image}')` }}
            />
            <div className="space-y-3 p-5">
              <div>
                <h2 className="text-xl font-bold text-[#071759]">
                  {offering?.programme.code ?? intake.intakeCode}
                </h2>
                <p className="text-sm text-[#354a8d]">
                  {offering?.programme.name ?? intake.intakeName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {level ? (
                  <Badge variant="secondary" className="rounded-full bg-[#edf3ff] text-[#19316f]">
                    {level}
                  </Badge>
                ) : null}
                {department ? (
                  <Badge variant="secondary" className="rounded-full bg-[#edf3ff] text-[#19316f]">
                    {department}
                  </Badge>
                ) : null}
              </div>

              <ol className="space-y-4 border-t border-[#e8edf5] pt-4">
                {isAuthenticated ? (
                  <>
                    <StepItem
                      step={1}
                      active
                      title="Confirm Details"
                      description="Quick confirmation so we can open your application."
                    />
                    <StepItem
                      step={2}
                      title="Programme Selection"
                      description="Choose your preferred programmes."
                    />
                    <StepItem
                      step={3}
                      title="Complete Application"
                      description="Finish academic, profile, and declaration steps."
                    />
                    <StepItem
                      step={4}
                      title="Submit"
                      description="Review and submit for admissions review."
                    />
                  </>
                ) : (
                  <>
                    <StepItem
                      step={1}
                      active
                      title="Create Application"
                      description="Register your account to start the application."
                    />
                    <StepItem
                      step={2}
                      title="Verify Email"
                      description="We'll send a verification link to your email."
                    />
                    <StepItem
                      step={3}
                      title="Sign In"
                      description="Log in using your registered credentials."
                    />
                    <StepItem
                      step={4}
                      title="Complete Application"
                      description="Fill in the application in simple steps."
                    />
                  </>
                )}
              </ol>
            </div>
          </div>

          <div className="rounded-xl border border-[#d6e4ff] bg-[#eef4ff] p-5">
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-[#0c3cff]" />
              <h3 className="font-semibold text-[#071759]">Need Help?</h3>
            </div>
            <p className="mt-2 text-sm text-[#354a8d]">
              Contact support if you need help with your applicant account.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#0c3cff] bg-white text-sm font-medium text-[#0c3cff]"
            >
              Contact Support
            </button>
          </div>
        </aside>

        <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#6374ab]">
            {isAuthenticated ? 'START APPLICATION' : 'CREATE APPLICATION'}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#071759] sm:text-3xl">
            {isAuthenticated ? 'Continue Your Application' : 'Register Your Account'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#354a8d]">
            {isAuthenticated
              ? `You're signed in as ${user?.email}. Add your mobile number once so we can open the application stepper for ${intake.intakeName}.`
              : `Create your account to start your application for ${intake.intakeName}. Please provide the following information to continue.`}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            {!isAuthenticated ? (
              <>
                <Field
                  label="Full Name"
                  error={showError('applicantName') ? errors.applicantName : undefined}
                >
                  <User className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  <Input
                    value={applicantName}
                    onChange={e => setApplicantName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, applicantName: true }))}
                    placeholder="Enter your full name (as per CNIC / Passport)"
                    className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  />
                </Field>

                <Field
                  label="Email Address"
                  error={showError('registeredEmail') ? errors.registeredEmail : undefined}
                >
                  <Mail className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  <Input
                    type="email"
                    value={registeredEmail}
                    onChange={e => setRegisteredEmail(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, registeredEmail: true }))}
                    placeholder="Enter your email address"
                    className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  />
                </Field>
              </>
            ) : null}

            <Field
              label="CNIC / Passport Number"
              error={showError('identity') ? errors.identity : undefined}
              required={!isAuthenticated}
            >
              <IdCard className="h-4 w-4 shrink-0 text-[#94a3b8]" />
              <Input
                value={identity}
                onChange={e => {
                  const next = e.target.value
                  setIdentity(/^\d/.test(next.replace(/\D/g, '')) ? formatCnic(next) : next)
                }}
                onBlur={() => setTouched(prev => ({ ...prev, identity: true }))}
                placeholder="Enter CNIC or Passport number"
                className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </Field>

            <Field
              label="Mobile Number"
              error={showError('mobileNumber') ? errors.mobileNumber : undefined}
            >
              <span className="shrink-0 rounded-md bg-[#f1f5fb] px-2 py-1 text-xs font-semibold text-[#19316f]">
                +92
              </span>
              <Phone className="h-4 w-4 shrink-0 text-[#94a3b8]" />
              <Input
                value={mobileLocal}
                onChange={e => setMobileLocal(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
                onBlur={() => setTouched(prev => ({ ...prev, mobileNumber: true }))}
                placeholder="Enter your mobile number"
                className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </Field>

            {errors.form ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errors.form}</p>
            ) : null}

            {showApplicantIdRecovery ? (
              <div className="space-y-3 rounded-xl border border-[#dce5f6] bg-[#f8faff] p-4">
                <p className="text-sm font-semibold text-[#071759]">Open existing application</p>
                <Input
                  value={recoveryApplicantId}
                  onChange={e => setRecoveryApplicantId(e.target.value.trim())}
                  placeholder="Paste Applicant ID (UUID)"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full border-[#0c3cff] text-[#0c3cff]"
                  onClick={() => {
                    if (!recoveryApplicantId || !intake || !user) return
                    upsertApplicationBinding({
                      applicantId: recoveryApplicantId,
                      applicationReference: recoveryApplicantId,
                      intakeSessionId: intake.id,
                      email: user.email,
                    })
                    setApplicantId(recoveryApplicantId)
                    navigate(applicationPath(recoveryApplicantId, offeringId), { replace: true })
                  }}
                >
                  Open Stepper
                </Button>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={saving}
              className="h-12 w-full bg-[#0c3cff] text-base font-semibold hover:bg-[#0934dc]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isAuthenticated ? 'Opening application...' : 'Creating application...'}
                </>
              ) : isAuthenticated ? (
                'Open Application Stepper'
              ) : (
                'Create Application'
              )}
            </Button>
          </form>

          {!isAuthenticated ? (
            <>
              <div className="mt-8 flex items-center gap-3 text-sm text-[#6374ab]">
                <span className="h-px flex-1 bg-[#e4e9f4]" />
                OR
                <span className="h-px flex-1 bg-[#e4e9f4]" />
              </div>
              <p className="mt-4 text-center text-sm text-[#354a8d]">
                Already have an account?{' '}
                <Link
                  to="/sign-in"
                  state={{
                    from: offeringId
                      ? `/apply/${intake.id}?offeringId=${encodeURIComponent(offeringId)}`
                      : `/apply/${intake.id}`,
                  }}
                  className="font-semibold text-[#0c3cff] hover:underline"
                >
                  Sign In
                </Link>
              </p>
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}

async function createApplicationForUser(input: {
  intakeId: string
  applicantName: string
  email: string
  mobileNumber: string
  cnicNumber?: string
  passportNumber?: string
}): Promise<RegistrationResponse> {
  const body = {
    intakeSessionId: input.intakeId,
    applicantName: input.applicantName,
    registeredEmail: input.email.trim().toLowerCase(),
    mobileNumber: input.mobileNumber,
    ...(input.cnicNumber ? { cnicNumber: input.cnicNumber } : {}),
    ...(input.passportNumber ? { passportNumber: input.passportNumber } : {}),
  }

  const result = await registerApplicant(body)

  upsertApplicationBinding({
    applicantId: result.applicantId,
    applicationId: result.applicationId,
    applicationReference: result.applicationReference,
    intakeSessionId: result.intakeSessionId,
    email: body.registeredEmail,
  })

  saveApplicantIdentity({
    email: body.registeredEmail,
    applicantName: body.applicantName,
    mobileNumber: body.mobileNumber,
    cnicNumber: body.cnicNumber,
    passportNumber: body.passportNumber,
    lastApplicantId: result.applicantId,
  })

  return result
}

function extractApplicantIdFromError(error: ApiError): string | null {
  const details = error.details as
    | {
        data?: { applicantId?: string }
        applicantId?: string
        message?: string | string[]
      }
    | null
  if (details?.data?.applicantId) return details.data.applicantId
  if (details?.applicantId) return details.applicantId

  const message = Array.isArray(details?.message)
    ? details.message.join(' ')
    : typeof details?.message === 'string'
      ? details.message
      : error.message
  const match = message.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  )
  return match?.[0] ?? null
}

function Field({
  label,
  error,
  children,
  required = true,
}: {
  label: string
  error?: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#334155]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <div
        className={`flex h-11 items-center gap-2 rounded-lg border bg-white px-3 ${
          error ? 'border-red-500' : 'border-[#dce5f6]'
        }`}
      >
        {children}
      </div>
      {error ? <p className="mt-1.5 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function StepItem({
  step,
  title,
  description,
  active,
}: {
  step: number
  title: string
  description: string
  active?: boolean
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
          active ? 'bg-[#0c3cff] text-white' : 'bg-[#e8edf5] text-[#6374ab]'
        }`}
      >
        {step}
      </span>
      <div>
        <p className={`text-sm font-semibold ${active ? 'text-[#0c3cff]' : 'text-[#071759]'}`}>
          {title}
        </p>
        <p className="mt-0.5 text-xs text-[#6374ab]">{description}</p>
      </div>
    </li>
  )
}

function validateForm(
  values: {
    applicantName: string
    registeredEmail: string
    identity: string
    mobileLocal: string
  },
  options: { requireIdentity: boolean },
) {
  const next: FieldErrors = {}
  if (!values.applicantName.trim() || values.applicantName.trim().length < 2) {
    next.applicantName = 'Enter your full name (at least 2 characters).'
  }
  if (!values.registeredEmail.trim()) next.registeredEmail = 'Email address is required.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.registeredEmail.trim())) {
    next.registeredEmail = 'Enter a valid email address.'
  }

  if (options.requireIdentity && !values.identity.trim()) {
    next.identity = 'CNIC or passport number is required.'
  }

  const mobileDigits = values.mobileLocal.replace(/\D/g, '')
  if (!mobileDigits) next.mobileNumber = 'Mobile number is required.'
  else if (mobileDigits.length < 10) next.mobileNumber = 'Enter a valid mobile number.'

  return next
}
