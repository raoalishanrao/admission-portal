import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, Trophy } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { listApplicantResults } from '@/lib/api/results'
import { formatIntakeDateTime } from '@/lib/admissions-display'
import type { ApplicantTestResult } from '@/lib/api/types'

function resultBadge(status: string) {
  const value = status.toUpperCase()
  if (value === 'PASS') return 'bg-[#dcfce7] text-[#166534]'
  if (value === 'FAIL') return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#f1f5f9] text-[#475569]'
}

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
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
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
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759]"
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
        <div className="mt-10 rounded-xl border border-red-200 bg-white px-5 py-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-[#e4e9f4] bg-white px-5 py-10 text-center">
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
          {rows.map((row) => {
            const session = sessionSummary(row)
            return (
              <article
                key={row.id}
                className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#071759]">
                      Ref: {row.applicationReference}
                    </p>
                    <p className="mt-1 text-xs text-[#6374ab]">
                      Published{' '}
                      {row.publishedAt
                        ? formatIntakeDateTime(row.publishedAt)
                        : '—'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${resultBadge(row.resultStatus)}`}
                  >
                    {row.resultStatus}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-[#6374ab]">Score</p>
                    <p className="mt-1 text-sm font-semibold text-[#071759]">
                      {formatNumber(row.testScore)} /{' '}
                      {formatNumber(row.totalMarks)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6374ab]">Percentage</p>
                    <p className="mt-1 text-sm font-semibold text-[#071759]">
                      {formatNumber(row.percentage)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6374ab]">Test session</p>
                    {session ? (
                      <div className="mt-1 space-y-0.5 text-sm text-[#071759]">
                        {session.venue ? (
                          <p className="font-semibold">{session.venue}</p>
                        ) : null}
                        {session.schedule ? (
                          <p className="text-[#354a8d]">{session.schedule}</p>
                        ) : null}
                        {session.room ? (
                          <p className="text-[#6374ab]">Room {session.room}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm font-medium text-[#071759]">—</p>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
