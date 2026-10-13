import { ArrowRight, BookOpen, Building2, GraduationCap, Users } from 'lucide-react'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1800&q=80'

const FEATURES = [
  { icon: GraduationCap, label: 'Wide Range of Programmes' },
  { icon: BookOpen, label: 'Quality Education for a Brighter Future' },
  { icon: Users, label: 'Supportive Learning Environment' },
  { icon: Building2, label: 'A Diverse Academic Community' },
] as const

export function AdmissionsHero() {
  return (
    <section className="relative overflow-hidden bg-[#eef4ff] dark:bg-[#0b1220]">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#e4edff] via-[#eef4ff] to-[#f5f8ff] dark:from-[#0b1220] dark:via-[#101a2e] dark:to-[#151d2e]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,_#d6e4ff_0%,_transparent_55%)] dark:bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,_#1e3a5f_0%,_transparent_55%)]"
        aria-hidden
      />

      <div
        className="absolute inset-y-0 right-0 hidden w-[56%] bg-cover bg-center lg:block"
        style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] bg-gradient-to-r from-[#eef4ff] from-0% via-[#eef4ff]/80 via-22% to-transparent to-55% dark:from-[#0b1220] dark:via-[#0b1220]/85 lg:block"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] bg-transparent dark:bg-[#0b1220]/35 lg:block"
        aria-hidden
      />

      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 lg:hidden dark:opacity-30"
        style={{ backgroundImage: `url('${HERO_IMAGE}')` }}
        aria-hidden
      />

      <p
        className="pointer-events-none absolute right-[9%] top-16 z-[1] hidden whitespace-pre-line text-center text-[2.6rem] leading-[1.05] text-[#4d6fff] dark:text-[#93b4ff] lg:block xl:right-[11%] xl:top-20 xl:text-[3.1rem]"
        style={{ fontFamily: '"Caveat", cursive', fontWeight: 600 }}
      >
        {`Learn\nGrow\nBelong`}
      </p>

      <div className="relative z-10 mx-auto flex min-h-[32rem] max-w-7xl flex-col justify-between px-4 pb-8 pt-10 sm:min-h-[34rem] sm:px-6 sm:pb-9 sm:pt-12 lg:min-h-[36rem] lg:px-8 lg:pb-10 lg:pt-14">
        <div className="max-w-[32rem]">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-[#7a8bb5] dark:text-[#9eb0d8]">
            ADMISSIONS OPEN
          </p>
          <h1 className="mt-3 text-[2.5rem] font-bold leading-[1.1] tracking-tight text-[#071759] dark:text-[#f4f7ff] sm:text-5xl lg:text-[3.35rem]">
            Your Future Starts Here
          </h1>
          <p className="mt-4 max-w-[27rem] text-[15px] leading-relaxed text-[#4f6294] dark:text-[#b6c4e2]">
            Explore our programmes, review admission requirements, and apply when you are ready.
            Your journey towards academic excellence begins with a single step.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#admissions"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#0c3cff] px-5 text-sm font-semibold text-white hover:bg-[#0934dc]"
            >
              Explore Admissions
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#programmes"
              className="inline-flex h-11 items-center rounded-md border border-[#0c3cff] bg-white/70 px-5 text-sm font-semibold text-[#0c3cff] hover:bg-white dark:border-[#60a5fa] dark:bg-[#121a2f]/80 dark:text-[#93b4ff] dark:hover:bg-[#1a2438]"
            >
              View Programmes
            </a>
          </div>
        </div>

        <div
          aria-label="Why Taleem"
          className="mt-12 grid grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        >
          {FEATURES.map(feature => (
            <div key={feature.label} className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#dce7ff] text-[#0c3cff] dark:bg-[#1e3a5f] dark:text-[#93b4ff]">
                <feature.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="text-[13px] font-semibold leading-snug text-[#0f1f4d] dark:text-[#e8eef8]">
                {feature.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
