import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  GraduationCap,
  IdCard,
  Plus,
  Printer,
  Trophy,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { listMyApplications } from '@/lib/api/my-applications'
import {
  applicationPath,
  submittedApplicationPath,
  upsertApplicationBinding,
} from '@/lib/application-session'
import { formatIntakeDate } from '@/lib/admissions-display'
import type { ApplicantOwnedApplication } from '@/lib/api/types'

function isSubmittedStatus(status: string) {
  return ['SUBMITTED', 'COMPLETE', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())
}

export function MyApplicationPage() {
  const { isAuthenticated, user, setApplicantId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [row, setRow] = useState<ApplicantOwnedApplication | null>(null)
  const [error, setError] = useState<string | null>(null)

  const userEmail = user?.email
  const userApplicantId = user?.applicantId

  useEffect(() => {
    if (!isAuthenticated || !userEmail) return
    const email = userEmail
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const apps = await listMyApplications()
        const active = apps[0] ?? null
        if (cancelled) return

        if (active) {
          upsertApplicationBinding({
            applicantId: active.applicantId,
            applicationReference: active.applicationReference,
            intakeSessionId: active.intakeSessionId,
            email,
            updatedAt: active.updatedAt,
          })
          if (active.applicantId !== userApplicantId) {
            setApplicantId(active.applicantId)
          }
        }
        setRow(active)
      } catch (err) {
        if (!cancelled) {
          setRow(null)
          setError(err instanceof Error ? err.message : 'Unable to load your application.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, setApplicantId, userApplicantId, userEmail])

  if (!isAuthenticated || !user) {
    return <Navigate to="/sign-in" replace state={{ from: '/my-application' }} />
  }

  const submitted = row ? isSubmittedStatus(row.applicationStatus) : false

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-[#0c3cff]">MY APPLICATION</p>
          <h1 className="mt-2 text-2xl font-bold text-[#071759] sm:text-3xl">My Application</h1>
          <p className="mt-2 text-sm text-[#354a8d]">
            You can have one active application at a time. Continue it here, or create one if you
            don&apos;t have any yet.
          </p>
        </div>
        {!loading && !row ? (
          <Link
            to="/#intakes"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc]"
          >
            <Plus className="h-4 w-4" />
            Create Application
          </Link>
        ) : null}
      </div>

      <div className="mt-8">
        {loading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white px-6 py-8 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : !row ? (
          <div className="rounded-xl border border-dashed border-[#dce5f6] bg-white px-6 py-14 text-center">
            <FileText className="mx-auto h-10 w-10 text-[#94a3b8]" />
            <h2 className="mt-4 text-lg font-semibold text-[#071759]">No application yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6374ab]">
              You don&apos;t have an application yet. Choose an intake and create one to get
              started.
            </p>
            <Link
              to="/#intakes"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-[#0c3cff] px-5 text-sm font-medium text-white hover:bg-[#0934dc]"
            >
              Browse intakes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-[#071759]">
                  {row.intakeName || 'Admission application'}
                </p>
                <p className="mt-1 text-xs text-[#6374ab]">
                  Ref: {row.applicationReference}
                  {row.updatedAt ? ` · Updated ${formatIntakeDate(row.updatedAt)}` : null}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-[#dbeafe] px-2.5 py-1 text-[11px] font-semibold text-[#1d4ed8]">
                    {row.applicationStatus}
                  </span>
                  <span className="inline-flex rounded-full bg-[#fff7ed] px-2.5 py-1 text-[11px] font-semibold text-[#c2410c]">
                    Fee: {row.processingFeeStatus}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {submitted ? (
                  <>
                    <Link
                      to={submittedApplicationPath(row.applicantId)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc]"
                    >
                      View details
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to={`/applications/${row.applicantId}/processing-fee/challan`}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                    >
                      <Printer className="h-4 w-4" />
                      Fee Challan
                    </Link>
                    {row.applicationStatus.toUpperCase() === 'APPROVED' ? (
                      <Link
                        to={`/applications/${row.applicantId}/admit-card`}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                      >
                        <IdCard className="h-4 w-4" />
                        Admit card
                      </Link>
                    ) : null}
                    <Link
                      to="/results"
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                    >
                      <Trophy className="h-4 w-4" />
                      Results
                    </Link>
                    <Link
                      to="/offer"
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                    >
                      <GraduationCap className="h-4 w-4" />
                      Offer
                    </Link>
                  </>
                ) : (
                  <Link
                    to={applicationPath(row.applicantId)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc]"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
