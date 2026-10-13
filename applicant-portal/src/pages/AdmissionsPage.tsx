import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Info } from 'lucide-react'
import { AdmissionsHero } from '@/components/admissions/AdmissionsHero'
import { IntakeCard } from '@/components/admissions/IntakeCard'
import { Skeleton } from '@/components/ui/skeleton'
import { listApplicantIntakes, listApplicantProgrammes } from '@/lib/api/admissions'
import type { ApplicantIntake, ApplicantOffering } from '@/lib/api/types'

export function AdmissionsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intakes, setIntakes] = useState<ApplicantIntake[]>([])
  const [programmesByIntake, setProgrammesByIntake] = useState<
    Record<string, ApplicantOffering[]>
  >({})
  const [programmeCounts, setProgrammeCounts] = useState<Record<string, number>>(
    {},
  )
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await listApplicantIntakes({ page: 1, limit: 50 })
        if (cancelled) return
        setIntakes(data.items)

        const rows = await Promise.all(
          data.items.map(async intake => {
            try {
              const programmes = await listApplicantProgrammes(intake.id, {
                page: 1,
                limit: 8,
              })
              return [
                intake.id,
                programmes.items,
                programmes.meta.total,
              ] as const
            } catch {
              return [intake.id, [] as ApplicantOffering[], 0] as const
            }
          }),
        )
        if (cancelled) return
        setProgrammesByIntake(
          Object.fromEntries(rows.map(([id, items]) => [id, items])),
        )
        setProgrammeCounts(
          Object.fromEntries(rows.map(([id, , total]) => [id, total])),
        )
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unable to load admissions.')
        setIntakes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const sorted = useMemo(() => {
    const rank = (openAt: string, closeAt: string) => {
      const now = Date.now()
      const open = new Date(openAt).getTime()
      const close = new Date(closeAt).getTime()
      if (now >= open && now <= close) return 0
      if (now < open) return 1
      return 2
    }
    return [...intakes].sort((a, b) => {
      const diff =
        rank(a.applicationOpenAt, a.applicationCloseAt) -
        rank(b.applicationOpenAt, b.applicationCloseAt)
      if (diff !== 0) return diff
      return (
        new Date(b.applicationOpenAt).getTime() -
        new Date(a.applicationOpenAt).getTime()
      )
    })
  }, [intakes])

  const visible = showAll ? sorted : sorted.slice(0, 3)

  return (
    <div className="bg-white dark:bg-[#0b1220]">
      <AdmissionsHero />

      <section
        id="admissions"
        className="scroll-mt-24 bg-white py-12 sm:py-14 dark:bg-[#0b1220]"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8b9bb8] dark:text-[#9eb0d8]">
                APPLY NOW
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#071759] dark:text-[#f4f7ff] sm:text-[1.75rem]">
                Find Your Programme
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2]">
                Choose a programme and apply for admission during an available
                application period.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAll(prev => !prev)}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
            >
              {showAll ? 'Show less' : 'View all'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-8 flex gap-3 rounded-xl border border-[#d6e4ff] bg-[#eef4ff] px-4 py-3.5 dark:border-[#243044] dark:bg-[#151d2e]">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[#0c3cff] dark:text-[#93b4ff]"
              strokeWidth={1.75}
            />
            <div>
              <p className="text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
                How admissions work
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#354a8d] dark:text-[#b6c4e2]">
                Each admission period has its own deadlines and available
                programmes. Pick a programme below to review details and start
                your application.
              </p>
            </div>
          </div>

          <div id="programmes" className="space-y-5 scroll-mt-24">
            {loading ? (
              <>
                <Skeleton className="h-[28rem] w-full rounded-2xl" />
                <Skeleton className="h-[28rem] w-full rounded-2xl" />
              </>
            ) : error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
                {error}
              </p>
            ) : sorted.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#dce5f6] bg-[#f8faff] px-4 py-12 text-center text-sm text-[#6374ab]">
                No admissions are open right now.
              </p>
            ) : (
              visible.map(intake => (
                <IntakeCard
                  key={intake.id}
                  intake={intake}
                  programmes={programmesByIntake[intake.id] ?? []}
                  programmesCount={programmeCounts[intake.id] ?? null}
                  onSelect={() => navigate(`/intakes/${intake.id}`)}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
