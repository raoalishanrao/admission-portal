import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ApplicationSidebar } from '@/components/application/ApplicationSidebar'
import { ApplicationStepper } from '@/components/application/ApplicationStepper'
import { AcademicStep } from '@/components/application/steps/AcademicStep'
import { DeclarationStep } from '@/components/application/steps/DeclarationStep'
import { ProgrammeStep } from '@/components/application/steps/ProgrammeStep'
import { ProfileStep } from '@/components/application/steps/ProfileStep'
import { ReviewStep } from '@/components/application/steps/ReviewStep'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import {
  getAcademicStep,
  getDeclarationStep,
  getDeclarationTexts,
  getProfileStep,
  getProgrammeStep,
} from '@/lib/api/applications'
import { getApplicantIntake, getApplicantOffering } from '@/lib/api/admissions'
import {
  getApplicationBindingByApplicantId,
  submittedApplicationPath,
} from '@/lib/application-session'
import { APPLICATION_STEP_ORDER } from '@/lib/application-steps'
import type {
  ApplicantIntake,
  ApplicantOffering,
  ApplicationStepId,
} from '@/lib/api/types'
import { campusImageForId, degreeLevelLabel } from '@/lib/admissions-display'

export function ApplicationFlowPage() {
  const { applicantId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const preferredOfferingId = searchParams.get('offeringId')
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intake, setIntake] = useState<ApplicantIntake | null>(null)
  const [primaryOffering, setPrimaryOffering] = useState<ApplicantOffering | null>(null)
  const [currentStep, setCurrentStep] = useState<ApplicationStepId>('programme')
  const [completed, setCompleted] = useState<Partial<Record<ApplicationStepId, boolean>>>({})
  const binding = applicantId ? getApplicationBindingByApplicantId(applicantId) : null

  const refreshProgress = useCallback(async () => {
    if (!applicantId) return
    const [programme, academic, profile, declaration, declarationTexts] = await Promise.all([
      getProgrammeStep(applicantId).catch(() => null),
      getAcademicStep(applicantId).catch(() => null),
      getProfileStep(applicantId).catch(() => null),
      getDeclarationStep(applicantId).catch(() => null),
      getDeclarationTexts(applicantId).catch(() => []),
    ])

    const noDeclarations = !declarationTexts || declarationTexts.length === 0
    const nextCompleted: Partial<Record<ApplicationStepId, boolean>> = {
      programme: !!programme?.programmeStepSaved,
      academic: !!academic?.academicStepSaved,
      profile: !!profile?.profileStepSaved,
      declaration:
        noDeclarations ||
        !!(declaration?.declarationStepSaved && declaration.declarationAccepted),
      review: declaration?.applicationStatus === 'SUBMITTED',
    }
    setCompleted(nextCompleted)

    if (programme?.options?.length) {
      const first = [...programme.options].sort((a, b) => a.preferenceOrder - b.preferenceOrder)[0]
      if (first) {
        const offering = await getApplicantOffering(first.programmeOfferingId).catch(() => null)
        if (offering) setPrimaryOffering(offering)
      }
      if (programme.intakeSessionId) {
        const intakeData = await getApplicantIntake(programme.intakeSessionId)
        setIntake(intakeData)
      }
    }

    return { programme, academic, profile, declaration, nextCompleted }
  }, [applicantId])

  useEffect(() => {
    if (!isAuthenticated || !applicantId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const progress = await refreshProgress()
        if (cancelled) return

        let intakeId = progress?.programme?.intakeSessionId ?? binding?.intakeSessionId
        if (!intakeId && preferredOfferingId) {
          const offering = await getApplicantOffering(preferredOfferingId)
          intakeId = offering.intakeId
          if (!cancelled) setPrimaryOffering(offering)
        }

        if (intakeId) {
          const intakeData = await getApplicantIntake(intakeId)
          if (!cancelled) setIntake(intakeData)
        } else if (!cancelled) {
          setError('Unable to resolve intake for this application.')
        }

        const status = progress?.declaration?.applicationStatus?.toUpperCase()
        if (
          status &&
          ['SUBMITTED', 'COMPLETE', 'APPROVED', 'REJECTED'].includes(status)
        ) {
          if (!cancelled) {
            navigate(submittedApplicationPath(applicantId), { replace: true })
          }
          return
        }

        if (progress?.nextCompleted) {
          const firstIncomplete =
            APPLICATION_STEP_ORDER.find(
              step => step !== 'review' && !progress.nextCompleted[step],
            ) ?? 'review'
          if (!cancelled) setCurrentStep(firstIncomplete)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load application.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [applicantId, binding?.intakeSessionId, isAuthenticated, preferredOfferingId, refreshProgress])

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `/applications/${applicantId}` }}
      />
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-[40rem] w-full rounded-xl" />
      </div>
    )
  }

  if (error || !intake) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error ?? 'Application not found.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-[#0c3cff] hover:underline">
          Back to admissions
        </Link>
      </div>
    )
  }

  const image = campusImageForId(primaryOffering?.id ?? intake.id)

  function goNext(from: ApplicationStepId) {
    const map: Record<ApplicationStepId, ApplicationStepId | null> = {
      programme: 'academic',
      academic: 'profile',
      profile: 'declaration',
      declaration: 'review',
      review: null,
    }
    setCompleted(prev => ({ ...prev, [from]: true }))
    const next = map[from]
    if (next) setCurrentStep(next)
  }

  const backToIntakePath = primaryOffering
    ? `/offerings/${primaryOffering.id}`
    : `/intakes/${intake.id}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to={primaryOffering ? `/offerings/${primaryOffering.id}` : `/intakes/${intake.id}`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#0c3cff] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {primaryOffering ? 'Back to Programme Details' : 'Back to Intake'}
      </Link>

      {primaryOffering ? (
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div
            className="h-16 w-24 rounded-lg bg-cover bg-center"
            style={{ backgroundImage: `url('${image}')` }}
          />
          <div>
            <p className="text-xs font-medium text-[#6374ab]">
              {primaryOffering.programme.programmeGrouping || primaryOffering.programme.code}
            </p>
            <h1 className="text-2xl font-bold text-[#071759]">{primaryOffering.programme.name}</h1>
            <p className="mt-1 text-sm text-[#6374ab]">
              {degreeLevelLabel(primaryOffering.programme.degreeLevel)} · Full Time
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#071759]">Online Admissions</h1>
          <p className="mt-1 text-sm text-[#354a8d]">{intake.intakeName}</p>
        </div>
      )}

      {binding?.applicationReference ? (
        <p className="mb-4 text-xs text-[#6374ab]">
          Application reference:{' '}
          <span className="font-semibold text-[#071759]">{binding.applicationReference}</span>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-xl border border-[#e4e9f4] bg-white px-4 py-5 sm:px-6 sm:py-6">
          <ApplicationStepper
            currentStep={currentStep}
            completed={completed}
            onStepClick={step => {
              const targetIndex = APPLICATION_STEP_ORDER.indexOf(step)
              const allowed =
                targetIndex === 0 ||
                APPLICATION_STEP_ORDER.slice(0, targetIndex).every(id => completed[id]) ||
                completed[step]
              if (allowed) setCurrentStep(step)
            }}
          />

          <div className="mt-6">
            {currentStep === 'programme' ? (
              <ProgrammeStep
                applicantId={applicantId}
                intake={intake}
                preferredOfferingId={preferredOfferingId}
                onPrimaryOfferingChange={setPrimaryOffering}
                onBack={() => navigate(backToIntakePath)}
                onSaved={offering => {
                  if (offering) setPrimaryOffering(offering)
                  void refreshProgress()
                  goNext('programme')
                }}
              />
            ) : null}

            {currentStep === 'academic' ? (
              <AcademicStep
                applicantId={applicantId}
                onBack={() => setCurrentStep('programme')}
                onSaved={() => {
                  void refreshProgress()
                  goNext('academic')
                }}
              />
            ) : null}

            {currentStep === 'profile' ? (
              <ProfileStep
                applicantId={applicantId}
                defaultName={user?.name}
                onBack={() => setCurrentStep('academic')}
                onSaved={() => {
                  void refreshProgress()
                  goNext('profile')
                }}
              />
            ) : null}

            {currentStep === 'declaration' ? (
              <DeclarationStep
                applicantId={applicantId}
                onBack={() => setCurrentStep('profile')}
                onSaved={() => {
                  void refreshProgress()
                  goNext('declaration')
                }}
              />
            ) : null}

            {currentStep === 'review' ? (
              <ReviewStep
                applicantId={applicantId}
                applicationReference={binding?.applicationReference}
                onBack={() => setCurrentStep('declaration')}
                onSubmitted={payload => {
                  navigate(`/applications/${applicantId}/success`, {
                    replace: true,
                    state: {
                      ...payload,
                      intakeName: intake.intakeName,
                      programmeName: primaryOffering?.programme.name,
                    },
                  })
                }}
              />
            ) : null}
          </div>
        </section>

        <ApplicationSidebar
          intake={intake}
          primaryOffering={primaryOffering}
          currentStep={currentStep}
          completed={completed}
          onEditStep={step => setCurrentStep(step)}
        />
      </div>
    </div>
  )
}

export function ApplicationLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#6374ab]">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading application...
    </div>
  )
}
