import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  GraduationCap,
} from 'lucide-react'
import { ApplicationStatusBadge } from '@/components/admissions/ApplicationStatusBadge'
import type { ApplicantIntake, ApplicantOffering } from '@/lib/api/types'
import {
  CAMPUS_IMAGE_FALLBACK,
  campusImageForId,
  degreeLevelLabel,
  degreeLevelSortKey,
  formatIntakeDate,
  getIntakeWindowStatus,
  intakeTermLabel,
} from '@/lib/admissions-display'
import { cn } from '@/lib/utils'

type Props = {
  intake: ApplicantIntake
  programmes: ApplicantOffering[]
  programmesCount: number | null
  onSelect: () => void
}

export function IntakeCard({
  intake,
  programmes,
  programmesCount,
  onSelect,
}: Props) {
  const navigate = useNavigate()
  const status = getIntakeWindowStatus(
    intake.applicationOpenAt,
    intake.applicationCloseAt,
  )
  const image = campusImageForId(intake.id)
  const termLabel = intakeTermLabel(
    intake.intakeName,
    intake.intakeCode,
    intake.applicationOpenAt,
  )
  const count = programmesCount ?? programmes.length
  const isOpen = status === 'open'

  const groupedPreview = useMemo(() => {
    const sorted = [...programmes].sort((a, b) => {
      const levelDiff =
        degreeLevelSortKey(a.programme.degreeLevel) -
        degreeLevelSortKey(b.programme.degreeLevel)
      if (levelDiff !== 0) return levelDiff
      return a.programme.name.localeCompare(b.programme.name)
    })
    const groups: Array<{ label: string; items: ApplicantOffering[] }> = []
    for (const offering of sorted.slice(0, 6)) {
      const label = degreeLevelLabel(offering.programme.degreeLevel)
      const last = groups[groups.length - 1]
      if (last && last.label === label) last.items.push(offering)
      else groups.push({ label, items: [offering] })
    }
    return groups
  }, [programmes])

  const previewCount = groupedPreview.reduce((n, g) => n + g.items.length, 0)

  const description =
    status === 'open'
      ? `Explore programmes for ${termLabel} and start your application.`
      : status === 'upcoming'
        ? `Applications for ${termLabel} will open soon. Browse programmes and get ready to apply.`
        : `The application window for ${termLabel} has closed.`

  return (
    <article className="overflow-hidden rounded-2xl border border-[#e4e9f4] bg-white shadow-[0_1px_3px_rgb(15_31_77/0.04)] dark:border-[#243044] dark:bg-[#121a2f] dark:shadow-[0_1px_3px_rgb(0_0_0/0.35)]">
      <div className="flex flex-col lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <ApplicationStatusBadge status={status} className="w-fit text-[11px]" />
            <p className="text-sm font-medium text-[#8b9bb8] dark:text-[#9eb0d8]">
              {termLabel}
            </p>
          </div>

          <h3 className="mt-4 text-xl font-bold text-[#071759] dark:text-[#f4f7ff] sm:text-2xl">
            Apply for {termLabel}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2]">
            {description}
          </p>

          <div className="mt-5 space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-[#354a8d] dark:text-[#b6c4e2]">
              <CalendarDays
                className="h-4 w-4 shrink-0 text-[#0c3cff] dark:text-[#93b4ff]"
                strokeWidth={1.75}
              />
              <span>
                Last date to apply{' '}
                <span className="font-semibold text-[#071759] dark:text-[#f4f7ff]">
                  {formatIntakeDate(intake.applicationCloseAt)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[#354a8d] dark:text-[#b6c4e2]">
              <GraduationCap
                className="h-4 w-4 shrink-0 text-[#0c3cff] dark:text-[#93b4ff]"
                strokeWidth={1.75}
              />
              <span className="font-semibold text-[#071759] dark:text-[#f4f7ff]">
                {programmesCount == null
                  ? 'Loading programmes…'
                  : `${count} programme${count === 1 ? '' : 's'} available`}
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#dce5f6] bg-[#f5f8ff] p-4 sm:p-5 dark:border-[#243044] dark:bg-[#151d2e]">
            <p className="text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
              Choose what you want to study
            </p>

            {previewCount === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-[#c5d0ef] bg-white/70 px-3 py-6 text-center text-sm text-[#6374ab] dark:border-[#334155] dark:bg-[#121a2f]/70 dark:text-[#9eb0d8]">
                {programmesCount == null
                  ? 'Loading programmes…'
                  : 'No programmes listed yet.'}
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {groupedPreview.map(group => (
                  <div key={group.label}>
                    <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b9bb8] dark:text-[#9eb0d8]">
                      {group.label}
                    </p>
                    <ul className="divide-y divide-[#dce5f6] overflow-hidden rounded-lg border border-[#dce5f6] bg-white dark:divide-[#243044] dark:border-[#243044] dark:bg-[#0f1729]">
                      {group.items.map(offering => (
                        <li key={offering.id}>
                          <button
                            type="button"
                            onClick={() => navigate(`/offerings/${offering.id}`)}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors',
                              'hover:bg-[#f8faff] dark:hover:bg-[#1a2438]',
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
                                {offering.programme.name}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-[#6374ab] dark:text-[#9eb0d8]">
                                {offering.programme.code}
                              </p>
                            </div>
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-[#0c3cff] dark:text-[#93b4ff]"
                              strokeWidth={2}
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {count > previewCount ? (
              <button
                type="button"
                onClick={onSelect}
                className="mt-3 text-sm font-semibold text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
              >
                View all {count} programmes →
              </button>
            ) : null}
          </div>

          <div className="mt-5">
            {isOpen ? (
              <button
                type="button"
                onClick={onSelect}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0b1220] px-5 text-sm font-semibold text-white hover:bg-[#151d2e] dark:bg-[#0c3cff] dark:hover:bg-[#0934dc] sm:w-auto sm:min-w-[14rem]"
              >
                Explore Programmes
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : status === 'upcoming' ? (
              <button
                type="button"
                onClick={onSelect}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#0c3cff] bg-white px-4 text-sm font-semibold text-[#0c3cff] hover:bg-[#f8faff] dark:border-[#60a5fa] dark:bg-[#121a2f] dark:text-[#93b4ff] dark:hover:bg-[#1a2438]"
              >
                Browse Programmes
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-11 cursor-not-allowed items-center rounded-lg bg-[#e8eef8] px-4 text-sm font-semibold text-[#94a3b8] dark:bg-[#1a2438] dark:text-[#64748b]"
              >
                Applications Closed
              </button>
            )}
          </div>
        </div>

        {/* Side image: stretch to full card height, cover without awkward crop strip */}
        <button
          type="button"
          onClick={status === 'closed' ? undefined : onSelect}
          disabled={status === 'closed'}
          className={cn(
            'relative hidden shrink-0 overflow-hidden lg:block lg:w-56 xl:w-64',
            status === 'closed' && 'cursor-not-allowed opacity-70',
          )}
          aria-label={`Open ${termLabel}`}
        >
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            onError={event => {
              const el = event.currentTarget
              if (el.src !== CAMPUS_IMAGE_FALLBACK) el.src = CAMPUS_IMAGE_FALLBACK
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-white/10 dark:to-[#121a2f]/25"
            aria-hidden
          />
        </button>
      </div>
    </article>
  )
}
