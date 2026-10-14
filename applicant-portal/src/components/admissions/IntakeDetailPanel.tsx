import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, GraduationCap, Layers, Loader2 } from 'lucide-react'
import { ApplicationStatusBadge } from '@/components/admissions/ApplicationStatusBadge'
import { ApplyNowButton } from '@/components/admissions/ApplyNowButton'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getApplicantIntake,
  listApplicantProgrammes,
} from '@/lib/api/admissions'
import type { ApplicantIntake, ApplicantOffering } from '@/lib/api/types'
import {
  academicYearFromDate,
  degreeLevelLabel,
  formatIntakeDateTime,
  getIntakeWindowStatus,
  programmeAccent,
  programmeInitials,
} from '@/lib/admissions-display'
import { cn } from '@/lib/utils'

type TabId = 'overview' | 'programmes' | 'dates' | 'support'

type Props = {
  intakeId: string | null
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'programmes', label: 'Programmes' },
  { id: 'dates', label: 'Important Dates' },
  { id: 'support', label: 'Support' },
]

export function IntakeDetailPanel({ intakeId }: Props) {
  const [tab, setTab] = useState<TabId>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intake, setIntake] = useState<ApplicantIntake | null>(null)
  const [offerings, setOfferings] = useState<ApplicantOffering[]>([])

  useEffect(() => {
    if (!intakeId) {
      setIntake(null)
      setOfferings([])
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setTab('overview')

    Promise.all([
      getApplicantIntake(intakeId),
      listApplicantProgrammes(intakeId, { page: 1, limit: 100 }),
    ])
      .then(([intakeData, programmes]) => {
        if (cancelled) return
        setIntake(intakeData)
        setOfferings(programmes.items)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unable to load admissions details.')
        setIntake(null)
        setOfferings([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [intakeId])

  if (!intakeId) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center rounded-xl border border-dashed border-[#dce5f6] bg-white px-6 text-center text-sm text-[#6374ab]">
        Select admissions to view programmes and application details.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 rounded-xl border border-[#e4e9f4] bg-white p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (error || !intake) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700">
        {error ?? 'Admissions not found.'}
      </div>
    )
  }

  const status = getIntakeWindowStatus(intake.applicationOpenAt, intake.applicationCloseAt)
  const year = academicYearFromDate(intake.applicationOpenAt)
  const degreeSummary = summarizeDegrees(offerings)

  return (
    <div className="rounded-xl border border-[#e4e9f4] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#e8edf5] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-[#071759]">{intake.intakeName}</h2>
            <ApplicationStatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-[#6374ab]">
            {intake.intakeCode} · {year}
          </p>
        </div>
        <ApplyNowButton />
      </div>

      <div className="border-b border-[#e8edf5] px-5 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                tab === item.id
                  ? 'border-[#0c3cff] text-[#0c3cff]'
                  : 'border-transparent text-[#6374ab] hover:text-[#071759]',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
        {tab === 'overview' && (
          <>
            <p className="text-sm leading-relaxed text-[#354a8d]">
              Explore programmes offered for this admission period, review important application
              dates, and check entry criteria and fees for each programme. Applications will be
              enabled in a later release.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile
                icon={<CalendarDays className="h-4 w-4" />}
                label="Application Opens"
                value={formatIntakeDateTime(intake.applicationOpenAt)}
              />
              <InfoTile
                icon={<CalendarDays className="h-4 w-4" />}
                label="Application Closes"
                value={formatIntakeDateTime(intake.applicationCloseAt)}
              />
              <InfoTile
                icon={<Layers className="h-4 w-4" />}
                label="Total Programmes"
                value={`${offerings.length}`}
                hint={degreeSummary}
              />
            </div>

            <ProgrammeList
              offerings={offerings}
              featured
              onViewAll={() => setTab('programmes')}
            />
          </>
        )}

        {tab === 'programmes' && <ProgrammeList offerings={offerings} />}

        {tab === 'dates' && (
          <div className="space-y-3">
            <DateRow label="Applications open" value={formatIntakeDateTime(intake.applicationOpenAt)} />
            <DateRow label="Applications close" value={formatIntakeDateTime(intake.applicationCloseAt)} />
            {intake.publishedAt && (
              <DateRow label="Published" value={formatIntakeDateTime(intake.publishedAt)} />
            )}
          </div>
        )}

        {tab === 'support' && (
          <div className="rounded-lg border border-[#e4e9f4] bg-[#f8faff] px-4 py-5 text-sm text-[#354a8d]">
            <p className="font-semibold text-[#071759]">Need help with admissions?</p>
            <p className="mt-2">
              Contact your institution admissions office for guidance on eligibility, documents, and
              deadlines. Programme criteria and fees are listed on each programme detail.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-[#d6e4ff] bg-[#eef4ff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#0c3cff]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-[#071759]">Ready to apply?</p>
              <p className="mt-0.5 text-sm text-[#354a8d]">
                Browse programmes now. Online applications will be available soon.
              </p>
            </div>
          </div>
          <ApplyNowButton size="sm" />
        </div>
      </div>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-[#dce5f6] bg-[#f8faff] px-4 py-3">
      <div className="flex items-center gap-2 text-[#0c3cff]">{icon}</div>
      <p className="mt-2 text-xs font-medium tracking-wide text-[#6374ab] uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#071759]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[#6374ab]">{hint}</p> : null}
    </div>
  )
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e4e9f4] px-4 py-3">
      <span className="text-sm text-[#354a8d]">{label}</span>
      <span className="text-sm font-semibold text-[#071759]">{value}</span>
    </div>
  )
}

function ProgrammeList({
  offerings,
  featured,
  onViewAll,
}: {
  offerings: ApplicantOffering[]
  featured?: boolean
  onViewAll?: () => void
}) {
  const rows = featured ? offerings.slice(0, 3) : offerings

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#071759]">
          {featured ? 'Featured Programmes' : 'All Programmes'}
        </h3>
        {featured && offerings.length > 3 && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-sm font-medium text-[#0c3cff] hover:underline"
          >
            View all programmes
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#dce5f6] px-4 py-8 text-center text-sm text-[#6374ab]">
          No published programmes yet.
        </p>
      ) : (
        <ul className="divide-y divide-[#e8edf5] overflow-hidden rounded-xl border border-[#e4e9f4]">
          {rows.map((offering, index) => {
            const { programme } = offering
            return (
              <li key={offering.id}>
                <Link
                  to={`/offerings/${offering.id}`}
                  state={{ from: '/#admissions' }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f8faff]"
                >
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-bold',
                      programmeAccent(index),
                    )}
                  >
                    {programmeInitials(programme.code, programme.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#071759]">
                      {programme.code}
                    </span>
                    <span className="block truncate text-xs text-[#6374ab]">{programme.name}</span>
                  </span>
                  <Badge variant="secondary" className="rounded-full bg-[#edf3ff] text-[#19316f]">
                    {degreeLevelLabel(programme.degreeLevel)}
                  </Badge>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function summarizeDegrees(offerings: ApplicantOffering[]) {
  const labels = new Set(offerings.map(item => degreeLevelLabel(item.programme.degreeLevel)))
  if (labels.size === 0) return 'No programmes yet'
  return Array.from(labels).join(' & ')
}

export function IntakeDetailLoadingHint() {
  return (
    <div className="flex items-center gap-2 text-sm text-[#6374ab]">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading admissions…
    </div>
  )
}
