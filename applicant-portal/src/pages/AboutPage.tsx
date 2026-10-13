import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Building2, GraduationCap, Users } from 'lucide-react'

const PILLARS = [
  {
    icon: GraduationCap,
    title: 'Academic excellence',
    body: 'Programmes designed to prepare students for professional careers and further study.',
  },
  {
    icon: BookOpen,
    title: 'Clear admissions path',
    body: 'Explore offerings, check requirements, apply online, and track your application in one place.',
  },
  {
    icon: Users,
    title: 'Student support',
    body: 'Guidance through fees, documents, entry tests, and offer acceptance.',
  },
  {
    icon: Building2,
    title: 'Campus community',
    body: 'A diverse learning environment focused on growth, belonging, and opportunity.',
  },
] as const

export function AboutPage() {
  return (
    <div className="bg-white dark:bg-[#0b1220]">
      <section className="border-b border-[#e4e9f4] bg-[#eef4ff] dark:border-[#243044] dark:bg-[#101a2e]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8b9bb8] dark:text-[#9eb0d8]">
            ABOUT US
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#071759] dark:text-[#f4f7ff] sm:text-4xl">
            Iqra University Admissions
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2] sm:text-base">
            We help prospective students discover programmes, understand
            requirements, and complete their admission application online —
            from first enquiry through offer and fee confirmation.
          </p>
          <Link
            to="/#admissions"
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-md bg-[#0c3cff] px-5 text-sm font-semibold text-white hover:bg-[#0934dc]"
          >
            Explore admissions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <h2 className="text-xl font-bold text-[#071759] dark:text-[#f4f7ff]">
          What we stand for
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(item => (
            <div
              key={item.title}
              className="rounded-2xl border border-[#e4e9f4] bg-white p-5 dark:border-[#243044] dark:bg-[#121a2f]"
            >
              <item.icon
                className="h-5 w-5 text-[#0c3cff] dark:text-[#93b4ff]"
                strokeWidth={1.75}
              />
              <h3 className="mt-3 text-sm font-semibold text-[#071759] dark:text-[#f4f7ff]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[#e4e9f4] bg-[#f8faff] dark:border-[#243044] dark:bg-[#0f1729]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-[#071759] dark:text-[#f4f7ff]">
            How to apply
          </h2>
          <ol className="mt-6 max-w-2xl space-y-4 text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2]">
            <li>
              <span className="font-semibold text-[#071759] dark:text-[#f4f7ff]">
                1. Choose a programme
              </span>{' '}
              — Browse open intakes and review eligibility, criteria, and fees.
            </li>
            <li>
              <span className="font-semibold text-[#071759] dark:text-[#f4f7ff]">
                2. Create your application
              </span>{' '}
              — Sign in, complete academic and personal details, and upload
              documents.
            </li>
            <li>
              <span className="font-semibold text-[#071759] dark:text-[#f4f7ff]">
                3. Pay & submit
              </span>{' '}
              — Complete the processing fee challan, then submit for review.
            </li>
            <li>
              <span className="font-semibold text-[#071759] dark:text-[#f4f7ff]">
                4. Track progress
              </span>{' '}
              — Check My Application for decisions, admit card, results, and
              offers.
            </li>
          </ol>
          <Link
            to="/faq"
            className="mt-8 inline-flex text-sm font-semibold text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
          >
            Read frequently asked questions →
          </Link>
        </div>
      </section>
    </div>
  )
}
