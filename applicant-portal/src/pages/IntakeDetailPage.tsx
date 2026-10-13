import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  GraduationCap,
  Inbox,
  LayoutGrid,
  List,
  MapPin,
  Search,
} from 'lucide-react'
import { ApplicationStatusBadge } from '@/components/admissions/ApplicationStatusBadge'
import { ApplyOrContinueButton } from '@/components/admissions/ApplyOrContinueButton'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { getApplicantIntake, listApplicantProgrammes } from '@/lib/api/admissions'
import type { ApplicantIntake, ApplicantOffering } from '@/lib/api/types'
import {
  academicYearFromDate,
  campusImageForId,
  degreeLevelLabel,
  formatIntakeDate,
  getIntakeWindowStatus,
  inferIntakeSeason,
} from '@/lib/admissions-display'
import { cn } from '@/lib/utils'

type ViewMode = 'grid' | 'list'
type SortMode = 'name-asc' | 'name-desc' | 'order'

function daysUntil(iso: string) {
  const close = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.ceil((close - now) / (1000 * 60 * 60 * 24))
  return diff
}

export function IntakeDetailPage() {
  const { intakeId = '' } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intake, setIntake] = useState<ApplicantIntake | null>(null)
  const [offerings, setOfferings] = useState<ApplicantOffering[]>([])
  const [query, setQuery] = useState('')
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortMode, setSortMode] = useState<SortMode>('name-asc')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openFilter, setOpenFilter] = useState<string | null>('level')

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
        setSelectedId(programmes.items[0]?.id ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unable to load admissions.')
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

  const levelOptions = useMemo(() => {
    const values = new Set(
      offerings.map(item => degreeLevelLabel(item.programme.degreeLevel)),
    )
    return Array.from(values).sort()
  }, [offerings])

  const facultyOptions = useMemo(() => {
    const values = new Set(
      offerings
        .map(item => item.programme.programmeGrouping?.trim())
        .filter((value): value is string => Boolean(value)),
    )
    return Array.from(values).sort()
  }, [offerings])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = offerings.filter(item => {
      const level = degreeLevelLabel(item.programme.degreeLevel)
      const faculty = item.programme.programmeGrouping?.trim() ?? ''
      if (selectedLevels.length > 0 && !selectedLevels.includes(level)) return false
      if (selectedFaculties.length > 0 && !selectedFaculties.includes(faculty)) return false
      if (!q) return true
      return (
        item.programme.code.toLowerCase().includes(q) ||
        item.programme.name.toLowerCase().includes(q) ||
        faculty.toLowerCase().includes(q) ||
        (item.publishedDescription ?? '').toLowerCase().includes(q)
      )
    })

    rows.sort((a, b) => {
      if (sortMode === 'order') {
        return (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999)
      }
      const cmp = a.programme.name.localeCompare(b.programme.name)
      return sortMode === 'name-desc' ? -cmp : cmp
    })

    return rows
  }, [offerings, query, selectedLevels, selectedFaculties, sortMode])

  useEffect(() => {
    if (!selectedId) return
    if (!filtered.some(item => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null)
    }
  }, [filtered, selectedId])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
          <Skeleton className="h-[28rem] rounded-xl" />
          <Skeleton className="h-[28rem] rounded-xl" />
          <Skeleton className="h-[28rem] rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !intake) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-red-600">{error ?? 'Admissions not found.'}</p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-medium text-[#0c3cff] hover:underline"
        >
          Back to admissions
        </Link>
      </div>
    )
  }

  const status = getIntakeWindowStatus(
    intake.applicationOpenAt,
    intake.applicationCloseAt,
  )
  const year = academicYearFromDate(intake.applicationOpenAt)
  const season = inferIntakeSeason(intake.intakeName, intake.intakeCode)
  const termLabel = `${season} ${year}`
  const daysLeft = daysUntil(intake.applicationCloseAt)
  const selected = filtered.find(item => item.id === selectedId) ?? null
  const hasFilters = selectedLevels.length > 0 || selectedFaculties.length > 0

  function toggleValue(
    value: string,
    current: string[],
    setter: (next: string[]) => void,
  ) {
    setter(
      current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value],
    )
  }

  return (
    <div className="bg-[#f7f9fc] dark:bg-[#0b1220]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            to="/#admissions"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admissions
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6374ab] hover:text-[#0c3cff] dark:text-[#9eb0d8] dark:hover:text-[#93b4ff]"
          >
            <CircleHelp className="h-4 w-4" />
            Help
          </button>
        </div>

        <header className="mb-5">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8b9bb8] uppercase dark:text-[#9eb0d8]">
            {termLabel} Admissions
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#071759] dark:text-[#f4f7ff] sm:text-[2rem]">
            Choose a Programme
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2]">
            Explore the programmes available in the {termLabel} admission period
            and select the one you want to apply for.
          </p>
        </header>

        <div className="mb-6 flex gap-3 rounded-xl border border-[#d6e4ff] bg-[#eef4ff] px-4 py-3.5 dark:border-[#243044] dark:bg-[#151d2e]">
          <GraduationCap
            className="mt-0.5 h-5 w-5 shrink-0 text-[#0c3cff] dark:text-[#93b4ff]"
            strokeWidth={1.75}
          />
          <p className="text-sm leading-relaxed text-[#354a8d] dark:text-[#b6c4e2]">
            Not sure which programme to choose? You can view programme details,
            eligibility criteria, and important information before starting your
            application.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_280px] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
          {/* Filters */}
          <aside className="h-fit rounded-2xl border border-[#e4e9f4] bg-white p-4 shadow-[0_1px_2px_rgb(15_31_77/0.03)] dark:border-[#243044] dark:bg-[#121a2f]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
                Filters
              </h2>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLevels([])
                    setSelectedFaculties([])
                  }}
                  className="text-xs font-semibold text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
                >
                  Clear All
                </button>
              ) : (
                <span className="text-xs text-[#94a3b8] dark:text-[#64748b]">
                  Clear All
                </span>
              )}
            </div>

            <FilterSection
              title="Study Level"
              open={openFilter === 'level'}
              onToggle={() =>
                setOpenFilter(prev => (prev === 'level' ? null : 'level'))
              }
            >
              {levelOptions.length === 0 ? (
                <p className="text-xs text-[#94a3b8] dark:text-[#9eb0d8]">
                  No levels available
                </p>
              ) : (
                levelOptions.map(level => (
                  <label
                    key={level}
                    className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-[#354a8d] dark:text-[#b6c4e2]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLevels.includes(level)}
                      onChange={() =>
                        toggleValue(level, selectedLevels, setSelectedLevels)
                      }
                      className="h-4 w-4 rounded border-[#c5d0ef] text-[#0c3cff] focus:ring-[#0c3cff] dark:border-[#334155]"
                    />
                    {level}
                  </label>
                ))
              )}
            </FilterSection>

            {facultyOptions.length > 0 ? (
              <FilterSection
                title="Faculty / School"
                open={openFilter === 'faculty'}
                onToggle={() =>
                  setOpenFilter(prev => (prev === 'faculty' ? null : 'faculty'))
                }
              >
                {facultyOptions.map(faculty => (
                  <label
                    key={faculty}
                    className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-[#354a8d] dark:text-[#b6c4e2]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFaculties.includes(faculty)}
                      onChange={() =>
                        toggleValue(
                          faculty,
                          selectedFaculties,
                          setSelectedFaculties,
                        )
                      }
                      className="h-4 w-4 rounded border-[#c5d0ef] text-[#0c3cff] focus:ring-[#0c3cff] dark:border-[#334155]"
                    />
                    <span className="leading-snug">{faculty}</span>
                  </label>
                ))}
              </FilterSection>
            ) : null}
          </aside>

          {/* Programme list */}
          <section className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#dce5f6] bg-white px-3 dark:border-[#243044] dark:bg-[#121a2f]">
                <Search className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                <Input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search programmes (e.g. Computer Science, BBA)"
                  className="h-auto border-0 bg-transparent p-0 text-sm text-[#071759] shadow-none focus-visible:ring-0 dark:text-[#f4f7ff]"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sortMode}
                  onChange={event => setSortMode(event.target.value as SortMode)}
                  className="h-11 rounded-xl border border-[#dce5f6] bg-white px-3 text-sm text-[#19316f] outline-none dark:border-[#243044] dark:bg-[#121a2f] dark:text-[#e8eef8]"
                >
                  <option value="name-asc">Sort by: Name A–Z</option>
                  <option value="name-desc">Sort by: Name Z–A</option>
                  <option value="order">Sort by: Display order</option>
                </select>
                <div className="flex h-11 overflow-hidden rounded-xl border border-[#dce5f6] bg-white dark:border-[#243044] dark:bg-[#121a2f]">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 text-sm font-medium',
                      viewMode === 'grid'
                        ? 'bg-[#0c3cff] text-white'
                        : 'text-[#6374ab] hover:bg-[#f8faff] dark:text-[#9eb0d8] dark:hover:bg-[#1a2438]',
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 text-sm font-medium',
                      viewMode === 'list'
                        ? 'bg-[#0c3cff] text-white'
                        : 'text-[#6374ab] hover:bg-[#f8faff] dark:text-[#9eb0d8] dark:hover:bg-[#1a2438]',
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                    List
                  </button>
                </div>
              </div>
            </div>

            <p className="mb-3 text-sm text-[#6374ab] dark:text-[#9eb0d8]">
              {filtered.length} programme{filtered.length === 1 ? '' : 's'}{' '}
              available
            </p>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#c5d0ef] bg-white px-4 py-16 text-center text-sm text-[#6374ab] dark:border-[#334155] dark:bg-[#121a2f] dark:text-[#9eb0d8]">
                No programmes match your filters.
              </div>
            ) : (
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid gap-4 sm:grid-cols-2'
                    : 'flex flex-col gap-3',
                )}
              >
                {filtered.map(offering => (
                  <ProgrammeCard
                    key={offering.id}
                    offering={offering}
                    selected={offering.id === selectedId}
                    layout={viewMode}
                    onSelect={() => setSelectedId(offering.id)}
                    onViewDetails={() => navigate(`/offerings/${offering.id}`)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right sidebar */}
          <aside className="flex h-fit flex-col gap-4">
            <div className="rounded-2xl border border-[#e4e9f4] bg-white p-4 shadow-[0_1px_2px_rgb(15_31_77/0.03)] dark:border-[#243044] dark:bg-[#121a2f]">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef4ff] text-[#0c3cff] dark:bg-[#1e3a5f] dark:text-[#93b4ff]">
                  <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
                    {termLabel} Admissions
                  </p>
                  <div className="mt-2">
                    <ApplicationStatusBadge status={status} className="text-[11px]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e4e9f4] bg-white p-4 shadow-[0_1px_2px_rgb(15_31_77/0.03)] dark:border-[#243044] dark:bg-[#121a2f]">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef4ff] text-[#0c3cff] dark:bg-[#1e3a5f] dark:text-[#93b4ff]">
                  <Inbox className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#6374ab] dark:text-[#9eb0d8]">
                    Application Deadline
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#166534] dark:text-[#4ade80]">
                    {formatIntakeDate(intake.applicationCloseAt)}
                  </p>
                  {status === 'open' && daysLeft >= 0 ? (
                    <p className="mt-1 text-xs font-medium text-[#15803d] dark:text-[#86efac]">
                      Closes in {daysLeft} day{daysLeft === 1 ? '' : 's'}
                    </p>
                  ) : status === 'upcoming' ? (
                    <p className="mt-1 text-xs font-medium text-[#075985] dark:text-[#7dd3fc]">
                      Opens {formatIntakeDate(intake.applicationOpenAt)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
                      Applications closed
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#d6e4ff] bg-[#eef4ff] p-4 dark:border-[#243044] dark:bg-[#151d2e]">
              <h3 className="text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
                How to Apply?
              </h3>
              <ol className="mt-3 space-y-3">
                {[
                  {
                    title: 'Choose a programme',
                    body: 'Explore and select the programme you want to apply for.',
                  },
                  {
                    title: 'Review details',
                    body: 'Check eligibility criteria, fees, and important information.',
                  },
                  {
                    title: 'Start application',
                    body: 'Create your application and complete the required information.',
                  },
                  {
                    title: 'Submit and track',
                    body: 'Submit your application and monitor its status online.',
                  },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0c3cff] text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#354a8d] dark:text-[#b6c4e2]">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {selected && status === 'open' ? (
              <ApplyOrContinueButton
                intakeId={intake.id}
                offeringId={selected.id}
                createLabel="Start Application →"
                continueLabel="Continue Application →"
                className="h-12 w-full rounded-xl text-sm font-semibold"
              />
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-[#e8eef8] text-sm font-semibold text-[#94a3b8] dark:bg-[#1a2438] dark:text-[#64748b]"
              >
                {status === 'upcoming'
                  ? 'Applications Not Open Yet'
                  : status === 'closed'
                    ? 'Applications Closed'
                    : 'Select a Programme'}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function FilterSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-t border-[#eef2f8] py-3 first:border-t-0 first:pt-0 dark:border-[#243044]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-[#94a3b8] transition-transform dark:text-[#9eb0d8]',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? <div className="mt-2 space-y-0.5">{children}</div> : null}
    </div>
  )
}

function ProgrammeCard({
  offering,
  selected,
  layout,
  onSelect,
  onViewDetails,
}: {
  offering: ApplicantOffering
  selected: boolean
  layout: ViewMode
  onSelect: () => void
  onViewDetails: () => void
}) {
  const { programme } = offering
  const level = degreeLevelLabel(programme.degreeLevel)
  const faculty = programme.programmeGrouping?.trim() || 'General programmes'
  const description =
    offering.publishedDescription?.trim() ||
    'Review programme details, eligibility criteria, and fees before applying.'

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border bg-white text-left transition-shadow dark:bg-[#121a2f]',
        selected
          ? 'border-[#0c3cff] shadow-[0_0_0_1px_#0c3cff]'
          : 'border-[#e4e9f4] hover:border-[#c5d0ef] dark:border-[#243044] dark:hover:border-[#334155]',
        layout === 'list' && 'flex flex-col sm:flex-row',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'relative block w-full overflow-hidden bg-[#e8eef8] dark:bg-[#1a2438]',
          layout === 'grid' ? 'aspect-[16/9]' : 'sm:w-48 sm:shrink-0',
          layout === 'list' && 'aspect-[16/9] sm:aspect-auto sm:min-h-[9rem]',
        )}
        aria-pressed={selected}
        aria-label={`Select ${programme.name}`}
      >
        <img
          src={campusImageForId(offering.id)}
          alt=""
          className="h-full w-full object-cover"
        />
        {selected ? (
          <span className="absolute top-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-[#0c3cff] text-white shadow">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <button type="button" onClick={onSelect} className="text-left">
          <h3 className="text-base font-bold text-[#071759] dark:text-[#f4f7ff]">
            {programme.name}
          </h3>
          <p className="mt-0.5 text-xs text-[#6374ab] dark:text-[#9eb0d8]">
            {faculty}
          </p>
        </button>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          <MetaItem icon={GraduationCap} label="Study Level" value={level} />
          <MetaItem icon={BookOpen} label="Programme Code" value={programme.code} />
          <MetaItem icon={MapPin} label="Faculty" value={faculty} />
          <MetaItem icon={CalendarDays} label="Programme Type" value="Full Time" />
        </div>

        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2]">
          {description}
        </p>

        <button
          type="button"
          onClick={onViewDetails}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
        >
          View Full Details
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  )
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GraduationCap
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0c3cff] dark:text-[#93b4ff]"
        strokeWidth={1.75}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-[#8b9bb8] dark:text-[#9eb0d8]">
          {label}
        </p>
        <p className="truncate text-xs font-semibold text-[#071759] dark:text-[#f4f7ff]">
          {value}
        </p>
      </div>
    </div>
  )
}
