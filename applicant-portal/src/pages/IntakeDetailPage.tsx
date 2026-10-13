import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CalendarDays,
  GraduationCap,
  Headphones,
  Layers,
  Search,
} from 'lucide-react'
import { ApplicationStatusBadge } from '@/components/admissions/ApplicationStatusBadge'
import { ApplyOrContinueButton } from '@/components/admissions/ApplyOrContinueButton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getApplicantIntake, listApplicantProgrammes } from '@/lib/api/admissions'
import type { ApplicantIntake, ApplicantOffering } from '@/lib/api/types'
import {
  academicYearFromDate,
  campusImageForId,
  degreeLevelLabel,
  formatIntakeDate,
  formatIntakeDateTime,
  getIntakeWindowStatus,
  inferIntakeSeason,
} from '@/lib/admissions-display'
import { cn } from '@/lib/utils'

type TabId = 'programmes' | 'about' | 'dates' | 'admission' | 'support'

const tabs: { id: TabId; label: string }[] = [
  { id: 'programmes', label: 'Available Programmes' },
  { id: 'about', label: 'About This Intake' },
  { id: 'dates', label: 'Important Dates' },
  { id: 'admission', label: 'Admission Information' },
  { id: 'support', label: 'Contact & Support' },
]

export function IntakeDetailPage() {
  const { intakeId = '' } = useParams()
  const [tab, setTab] = useState<TabId>('programmes')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intake, setIntake] = useState<ApplicantIntake | null>(null)
  const [offerings, setOfferings] = useState<ApplicantOffering[]>([])
  const [query, setQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')

  useEffect(() => {
    if (!intakeId) return
    let cancelled = false
    setLoading(true)
    setError(null)

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
        setError(err instanceof Error ? err.message : 'Unable to load intake.')
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

  const levels = useMemo(() => {
    const values = new Set(offerings.map(item => degreeLevelLabel(item.programme.degreeLevel)))
    return Array.from(values).sort()
  }, [offerings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return offerings.filter(item => {
      const level = degreeLevelLabel(item.programme.degreeLevel)
      if (levelFilter !== 'all' && level !== levelFilter) return false
      if (!q) return true
      return (
        item.programme.code.toLowerCase().includes(q) ||
        item.programme.name.toLowerCase().includes(q) ||
        item.publishedDescription.toLowerCase().includes(q)
      )
    })
  }, [offerings, query, levelFilter])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !intake) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-red-600">{error ?? 'Intake not found.'}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-[#0c3cff] hover:underline">
          Back to admissions
        </Link>
      </div>
    )
  }

  const status = getIntakeWindowStatus(intake.applicationOpenAt, intake.applicationCloseAt)
  const year = academicYearFromDate(intake.applicationOpenAt)
  const season = inferIntakeSeason(intake.intakeName, intake.intakeCode)
  const heroImage = campusImageForId(intake.id)

  return (
    <div>
      <section className="border-b border-[#dce5f6] bg-gradient-to-r from-[#eef4ff] via-[#f7f9ff] to-[#eef4ff]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <nav className="mb-4 text-sm text-[#6374ab]">
            <Link to="/" className="hover:text-[#0c3cff]">
              Home
            </Link>
            <span className="mx-2">›</span>
            <Link to="/" className="hover:text-[#0c3cff]">
              Admissions
            </Link>
            <span className="mx-2">›</span>
            <span className="text-[#071759]">{intake.intakeName}</span>
          </nav>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#0c3cff]">INTAKE</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#071759] sm:text-4xl">
                {intake.intakeName}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#354a8d]">
                Explore programmes offered in this intake and start your application when you are
                ready. Review key dates and programme details before applying.
              </p>
            </div>
            <div
              className="relative h-44 overflow-hidden rounded-xl bg-cover bg-center shadow-sm sm:h-52"
              style={{
                backgroundImage: `linear-gradient(90deg, rgb(238 244 255 / 0.2), transparent), url('${heroImage}')`,
              }}
            >
              <p
                className="absolute bottom-4 right-5 text-2xl italic text-white/90"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                Learn · Grow · Belong
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-xl border border-[#dce5f6] bg-white/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem icon={<CalendarDays className="h-4 w-4" />} label="Academic Year" value={year} />
            <MetaItem icon={<Layers className="h-4 w-4" />} label="Intake Type" value={season} />
            <MetaItem
              icon={<CalendarDays className="h-4 w-4" />}
              label="Application Period"
              value={`${formatIntakeDate(intake.applicationOpenAt)} - ${formatIntakeDate(intake.applicationCloseAt)}`}
            />
            <MetaItem
              icon={<GraduationCap className="h-4 w-4" />}
              label="Programmes Available"
              value={`${offerings.length} Programme${offerings.length === 1 ? '' : 's'}`}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#e8edf5]">
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

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            {tab === 'programmes' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border border-[#e4e9f4] bg-white p-3 sm:flex-row sm:items-center">
                  <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#e2e8f0] px-3">
                    <Search className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                    <Input
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder="Search programmes..."
                      className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <select
                    value={levelFilter}
                    onChange={event => setLevelFilter(event.target.value)}
                    className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm text-[#19316f] outline-none"
                  >
                    <option value="all">Degree Level</option>
                    {levels.map(level => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <p className="shrink-0 px-1 text-sm font-medium text-[#6374ab]">
                    {filtered.length} Programme{filtered.length === 1 ? '' : 's'}
                  </p>
                </div>

                {filtered.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#dce5f6] bg-white px-4 py-10 text-center text-sm text-[#6374ab]">
                    No programmes match your filters.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {filtered.map(offering => (
                      <ProgrammeCard key={offering.id} offering={offering} intakeId={intake.id} />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {tab === 'about' && (
              <ContentCard title="About this intake">
                <p>
                  {intake.intakeName} ({intake.intakeCode}) is currently published for applicants. Browse
                  available programmes, review important dates, and begin your application when the
                  window is open.
                </p>
              </ContentCard>
            )}

            {tab === 'dates' && (
              <ContentCard title="Important dates">
                <DateList intake={intake} />
              </ContentCard>
            )}

            {tab === 'admission' && (
              <ContentCard title="Admission information">
                <p>
                  Each programme may have its own admission criteria and fees. Open a programme to
                  review requirements before you create an application.
                </p>
              </ContentCard>
            )}

            {tab === 'support' && (
              <ContentCard title="Contact & support">
                <p>
                  Need help choosing a programme or starting your application? Contact your
                  institution admissions office for guidance on eligibility, documents, and
                  deadlines.
                </p>
              </ContentCard>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-[#e4e9f4] bg-white p-5">
              <h3 className="font-semibold text-[#071759]">Intake Overview</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <OverviewRow label="Academic Year" value={year} />
                <OverviewRow label="Intake Type" value={season} />
                <OverviewRow
                  label="Application Period"
                  value={`${formatIntakeDate(intake.applicationOpenAt)} - ${formatIntakeDate(intake.applicationCloseAt)}`}
                />
                <OverviewRow label="Total Programmes" value={String(offerings.length)} />
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-[#e8edf5] pt-4">
                <span className="text-sm text-[#6374ab]">Application Status</span>
                <ApplicationStatusBadge
                  status={status}
                  className={status === 'open' ? 'bg-[#dcfce7] text-[#166534]' : undefined}
                />
              </div>
              {status === 'open' ? (
                <ApplyOrContinueButton
                  intakeId={intake.id}
                  className="mt-4 w-full"
                />
              ) : null}
            </div>

            <div className="rounded-xl border border-[#e4e9f4] bg-white p-5">
              <h3 className="font-semibold text-[#071759]">Important Dates</h3>
              <div className="mt-4">
                <DateList intake={intake} compact />
              </div>
            </div>

            <div className="rounded-xl border border-[#d6e4ff] bg-[#eef4ff] p-5">
              <div className="flex items-center gap-2 text-[#0c3cff]">
                <Headphones className="h-5 w-5" />
                <h3 className="font-semibold text-[#071759]">Need Help?</h3>
              </div>
              <p className="mt-2 text-sm text-[#354a8d]">
                Our admissions team can help with programme selection and application questions.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-[#0c3cff] bg-white text-sm font-medium text-[#0c3cff]"
              >
                Contact Support
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-[#0c3cff]">{icon}</span>
      <div>
        <p className="text-xs font-medium text-[#6374ab]">{label}</p>
        <p className="text-sm font-semibold text-[#071759]">{value}</p>
      </div>
    </div>
  )
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[#6374ab]">{label}</dt>
      <dd className="text-right font-medium text-[#071759]">{value}</dd>
    </div>
  )
}

function ContentCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
      <h2 className="text-lg font-semibold text-[#071759]">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#354a8d]">{children}</div>
    </div>
  )
}

function DateList({ intake, compact }: { intake: ApplicantIntake; compact?: boolean }) {
  const rows = [
    { label: 'Application Opens', value: formatIntakeDateTime(intake.applicationOpenAt) },
    { label: 'Application Closes', value: formatIntakeDateTime(intake.applicationCloseAt) },
  ]
  if (intake.publishedAt) {
    rows.push({ label: 'Published', value: formatIntakeDateTime(intake.publishedAt) })
  }

  return (
    <ul className={cn('space-y-3', compact && 'space-y-2.5')}>
      {rows.map(row => (
        <li key={row.label} className="flex items-start justify-between gap-3 text-sm">
          <span className="text-[#6374ab]">{row.label}</span>
          <span className="text-right font-medium text-[#071759]">{row.value}</span>
        </li>
      ))}
    </ul>
  )
}

function ProgrammeCard({
  offering,
  intakeId,
}: {
  offering: ApplicantOffering
  intakeId: string
}) {
  const level = degreeLevelLabel(offering.programme.degreeLevel)
  const department = offering.programme.programmeGrouping || 'General'
  const image = campusImageForId(offering.id)

  return (
    <li className="overflow-hidden rounded-xl border border-[#e4e9f4] bg-white">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch">
        <div
          className="h-28 w-full shrink-0 rounded-lg bg-cover bg-center sm:h-auto sm:w-36"
          style={{ backgroundImage: `url('${image}')` }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-[#071759]">{offering.programme.code}</h3>
          <p className="text-sm text-[#354a8d]">{offering.programme.name}</p>
          <p className="mt-2 line-clamp-2 text-sm text-[#6374ab]">
            {offering.publishedDescription ||
              'View programme details, criteria, and fees before applying.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary" className="rounded-full bg-[#edf3ff] text-[#19316f]">
              {level}
            </Badge>
            <Badge variant="secondary" className="rounded-full bg-[#edf3ff] text-[#19316f]">
              {department}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-col justify-between gap-3 sm:w-44 sm:items-end">
          <dl className="space-y-1.5 text-xs text-[#6374ab] sm:text-right">
            <div>
              <dt className="inline">Degree Level: </dt>
              <dd className="inline font-medium text-[#071759]">{level}</dd>
            </div>
            <div>
              <dt className="inline">Department: </dt>
              <dd className="inline font-medium text-[#071759]">{department}</dd>
            </div>
          </dl>
          <div className="flex w-full flex-col gap-2 sm:items-end">
            <Link
              to={`/offerings/${offering.id}`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc]"
            >
              View Programme →
            </Link>
            <ApplyOrContinueButton
              intakeId={intakeId}
              offeringId={offering.id}
              size="sm"
              className="bg-transparent px-0 text-[#0c3cff] hover:bg-transparent hover:underline"
              createLabel="Create Application"
              continueLabel="Continue Application"
            />
          </div>
        </div>
      </div>
    </li>
  )
}
