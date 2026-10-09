import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
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
  return ['SUBMITTED', 'COMPLETE', 'APPROVED', 'REJECTED'].includes(
    status.toUpperCase(),
  )
}

function titleCaseStatus(value: string) {
  if (!value) return '—'
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function feeBadge(status: string) {
  const value = status.toUpperCase()
  if (value.includes('VERIFIED') || value === 'PAID') {
    return {
      className: 'bg-[#dcfce7] text-[#166534]',
      label: 'Fee verified',
      verified: true,
    }
  }
  if (value.includes('SUBMITTED') || value.includes('PENDING')) {
    return {
      className: 'bg-[#fff7ed] text-[#c2410c]',
      label: `Fee: ${titleCaseStatus(status)}`,
      verified: false,
    }
  }
  return {
    className: 'bg-[#f1f5f9] text-[#475569]',
    label: `Fee: ${titleCaseStatus(status)}`,
    verified: false,
  }
}

function appStatusBadge(status: string) {
  const value = status.toUpperCase()
  if (value === 'APPROVED') return 'bg-[#dbeafe] text-[#1d4ed8]'
  if (value === 'REJECTED') return 'bg-[#fee2e2] text-[#b91c1c]'
  if (value === 'SUBMITTED' || value === 'COMPLETE')
    return 'bg-[#e0e7ff] text-[#3730a3]'
  return 'bg-[#f1f5f9] text-[#475569]'
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
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load your application.',
          )
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
    return (
      <Navigate to="/sign-in" replace state={{ from: '/my-application' }} />
    )
  }

  const submitted = row ? isSubmittedStatus(row.applicationStatus) : false
  const approved = row?.applicationStatus.toUpperCase() === 'APPROVED'
  const fee = row ? feeBadge(row.processingFeeStatus) : null

  return (
    <div className="min-h-[70vh] bg-[#f4f6fb]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-[#0c3cff]">
              MY APPLICATION
            </p>
            <h1 className="mt-2 text-2xl font-bold text-[#071759] sm:text-3xl">
              My Application
            </h1>
            <p className="mt-2 text-sm text-[#6374ab]">
              You can have one active application at a time. Continue it here,
              or create one if you don&apos;t have any yet.
            </p>
          </div>
          {!loading && !row ? (
            <Link
              to="/#intakes"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 hover:bg-[#0934dc]"
            >
              <Plus className="h-4 w-4" />
              Create Application
            </Link>
          ) : null}
        </div>

        <div className="mt-8">
          {loading ? (
            <Skeleton className="h-48 w-full rounded-2xl" />
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          ) : !row ? (
            <div className="rounded-2xl border border-dashed border-[#dce5f6] bg-white px-6 py-14 text-center shadow-sm">
              <FileText className="mx-auto h-10 w-10 text-[#94a3b8]" />
              <h2 className="mt-4 text-lg font-semibold text-[#071759]">
                No application yet
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[#6374ab]">
                You don&apos;t have an application yet. Choose an intake and
                create one to get started.
              </p>
              <Link
                to="/#intakes"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0c3cff] px-5 text-sm font-medium text-white hover:bg-[#0934dc]"
              >
                Browse intakes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <article className="overflow-hidden rounded-2xl border border-[#e8edf7] bg-white shadow-sm">
              <div className="px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8efff] text-[#0c3cff]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-[#071759]">
                        {row.intakeName || 'Admission application'}
                      </p>
                      <p className="mt-1 text-sm text-[#6374ab]">
                        Ref: {row.applicationReference}
                        {row.updatedAt
                          ? ` · Updated ${formatIntakeDate(row.updatedAt)}`
                          : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${appStatusBadge(row.applicationStatus)}`}
                    >
                      {row.applicationStatus}
                    </span>
                    {fee ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${fee.className}`}
                      >
                        {fee.verified ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : null}
                        {fee.label}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 rounded-xl bg-[#f8faff] px-4 py-4 sm:grid-cols-3 sm:gap-0">
                  <div className="flex items-start gap-2.5 sm:border-r sm:border-[#e4e9f4] sm:pr-4">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0c3cff]" />
                    <div>
                      <p className="text-xs text-[#8b9bb8]">Application status</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#071759]">
                        {titleCaseStatus(row.applicationStatus)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 sm:border-r sm:border-[#e4e9f4] sm:px-4">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#0c3cff]" />
                    <div>
                      <p className="text-xs text-[#8b9bb8]">Fee status</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#071759]">
                        {titleCaseStatus(row.processingFeeStatus)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 sm:pl-4">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#0c3cff]" />
                    <div>
                      <p className="text-xs text-[#8b9bb8]">Last updated</p>
                      <p className="mt-0.5 text-sm font-semibold text-[#071759]">
                        {row.updatedAt
                          ? formatIntakeDate(row.updatedAt)
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {submitted ? (
                    <>
                      <Link
                        to={submittedApplicationPath(row.applicantId)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 hover:bg-[#0934dc]"
                      >
                        View details
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/applications/${row.applicantId}/processing-fee/challan`}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                      >
                        <Printer className="h-4 w-4" />
                        Fee Challan
                      </Link>
                      {approved ? (
                        <Link
                          to={`/applications/${row.applicantId}/admit-card`}
                          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                        >
                          <IdCard className="h-4 w-4" />
                          Admit card
                        </Link>
                      ) : null}
                      <Link
                        to="/results"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                      >
                        <Trophy className="h-4 w-4" />
                        Results
                      </Link>
                      <Link
                        to="/offer"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                      >
                        <GraduationCap className="h-4 w-4" />
                        Offer
                      </Link>
                    </>
                  ) : (
                    <Link
                      to={applicationPath(row.applicantId)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 hover:bg-[#0934dc]"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
    </div>
  )
}
