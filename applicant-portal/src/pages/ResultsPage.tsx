import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Trophy,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { listApplicantResults } from '@/lib/api/results'
import { formatIntakeDateTime } from '@/lib/admissions-display'
import type { ApplicantTestResult } from '@/lib/api/types'

function formatNumber(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

function formatSessionDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatSessionTime(value: string | null | undefined) {
  if (!value) return null
  const parts = String(value).split(':')
  if (parts.length < 2) return value
  const hours = Number(parts[0])
  const minutes = parts[1]
  if (Number.isNaN(hours)) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes} ${suffix}`
}

function sessionSummary(row: ApplicantTestResult) {
  const venue =
    row.testVenue?.trim() ||
    [row.centreName, row.centreLocation].filter(Boolean).join(', ') ||
    null
  const date = formatSessionDate(row.testDate)
  const time = formatSessionTime(row.testTime)
  const room = row.room?.trim() || null

  if (!venue && !date && !time && !room) return null

  return {
    venue,
    schedule: [date, time].filter(Boolean).join(' · ') || null,
    room,
  }
}

function ResultStatusBadge({ status }: { status: string }) {
  const value = status.toUpperCase()
  if (value === 'PASS') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#166534]">
        <CheckCircle2 className="h-3.5 w-3.5" />
        PASS
      </span>
    )
  }
  if (value === 'FAIL') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fee2e2] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#b91c1c]">
        <XCircle className="h-3.5 w-3.5" />
        FAIL
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-[#f1f5f9] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#475569]">
      {status || '—'}
    </span>
  )
}

function ResultCard({ row }: { row: ApplicantTestResult }) {
  const session = sessionSummary(row)
  const passed = row.resultStatus?.toUpperCase() === 'PASS'

  return (
    <article className="overflow-hidden rounded-2xl border border-[#e8edf7] bg-white shadow-sm">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8efff] text-[#0c3cff]">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#8b9bb8]">
                Entry test result
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-[#071759]">
                Ref: {row.applicationReference}
              </h2>
              <p className="mt-1 text-xs text-[#6374ab]">
                Published{' '}
                {row.publishedAt ? formatIntakeDateTime(row.publishedAt) : '—'}
              </p>
            </div>
          </div>
          <ResultStatusBadge status={row.resultStatus} />
        </div>

        <div className="mt-5 grid gap-4 rounded-xl bg-[#f5f8ff] p-4 sm:grid-cols-2 sm:gap-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8efff] text-[#0c3cff]">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#8b9bb8]">Your score</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-[#071759] sm:text-3xl">
                {formatNumber(row.testScore)}{' '}
                <span className="text-[#94a3b8]">/</span>{' '}
                {formatNumber(row.totalMarks)}
              </p>
              <p className="mt-0.5 text-sm text-[#6374ab]">
                {formatNumber(row.percentage)}%
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8efff] text-[#0c3cff]">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#8b9bb8]">Test session</p>
              {session ? (
                <div className="mt-1 space-y-1.5">
                  <p className="text-sm font-semibold text-[#071759]">
                    {session.venue || '—'}
                  </p>
                  {session.schedule ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-[#6374ab]">
                      <Calendar className="h-3.5 w-3.5 text-[#0c3cff]" />
                      {session.schedule}
                    </p>
                  ) : null}
                  {session.room ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-[#6374ab]">
                      <MapPin className="h-3.5 w-3.5 text-[#0c3cff]" />
                      Room {session.room}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-sm text-[#6374ab]">—</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[#eff6ff] px-4 py-3.5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#071759]">
            <Info className="h-4 w-4 text-[#0c3cff]" />
            What happens next?
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#6374ab]">
            {passed
              ? 'Passing the entry test does not necessarily guarantee admission. Check your application for merit and admission updates.'
              : 'This result does not meet the pass criteria. Contact admissions if you believe there is an error, or follow any reappear guidance they publish.'}
          </p>
        </div>

        {passed ? (
          <Link
            to="/offer"
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#0c3cff] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-[#0934dc] sm:w-auto"
          >
            View admission offer
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export function ResultsPage() {
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ApplicantTestResult[]>([])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listApplicantResults()
      setRows(data)
    } catch (err) {
      setRows([])
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to load results.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void load()
  }, [isAuthenticated])

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: '/results' }} />
  }

  return (
    <div className="min-h-[70vh] bg-[#f4f6fb]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/my-application"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c3cff]"
            >
              <ArrowLeft className="h-4 w-4" />
              My application
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[#071759] sm:text-3xl">
              Entry test results
            </h1>
            <p className="mt-1 text-sm text-[#6374ab]">
              Published scores for your applications appear here after admissions
              releases them.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-16 flex items-center justify-center gap-2 text-sm text-[#6374ab]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading results…
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-white px-5 py-6 text-center shadow-sm">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[#e4e9f4] bg-white px-5 py-10 text-center shadow-sm">
            <Trophy className="mx-auto h-8 w-8 text-[#94a3b8]" />
            <p className="mt-3 text-sm font-medium text-[#071759]">
              No published results yet
            </p>
            <p className="mt-1 text-sm text-[#6374ab]">
              Check back after you sit the entry test and scores are released.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {rows.map((row) => (
              <ResultCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
