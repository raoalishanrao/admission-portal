import { Link } from 'react-router-dom'

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Who can apply?',
    a: 'Anyone who meets the eligibility criteria for a published programme offering in an open intake may apply. Requirements vary by degree level and programme — check the offering details before you start.',
  },
  {
    q: 'How do I start an application?',
    a: 'From Home, open an available intake, choose a programme, then create or sign in to your account. You will complete academic details, personal information, documents, declarations, and the processing fee before submitting.',
  },
  {
    q: 'Can I select more than one programme?',
    a: 'Yes. You can rank multiple programme preferences within the same intake, subject to the maximum allowed for that application. Education details and documents are shared across those preferences.',
  },
  {
    q: 'What is the processing fee?',
    a: 'The processing (application) fee is paid via bank challan after you complete the required application steps. Upload payment evidence in the portal so admissions can verify it.',
  },
  {
    q: 'When will I get an admit card?',
    a: 'If your programme requires an entry test, an admit card is issued after your application is approved and assigned to a test session. You can download it from My Application / Admit card.',
  },
  {
    q: 'How do I see results and offers?',
    a: 'Published test results appear under Results. If you are selected, your admission offer and offer-fee challan appear under Offer. Accept the offer and pay the admission fee by the stated deadline.',
  },
  {
    q: 'I forgot my password. What should I do?',
    a: 'Use Sign In and follow the password reset / set-password link sent to your registered email. If you never verified your email, complete verification first.',
  },
  {
    q: 'Who do I contact for help?',
    a: 'For programme-specific questions, refer to the offering details and university admissions office. For portal access issues, contact admissions support with your application reference and registered email.',
  },
]

export function FaqPage() {
  return (
    <div className="bg-white dark:bg-[#0b1220]">
      <section className="border-b border-[#e4e9f4] bg-[#eef4ff] dark:border-[#243044] dark:bg-[#101a2e]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-[#8b9bb8] dark:text-[#9eb0d8]">
            HELP
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#071759] dark:text-[#f4f7ff] sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2] sm:text-base">
            Quick answers about applying, fees, documents, tests, and offers.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="divide-y divide-[#e4e9f4] rounded-2xl border border-[#e4e9f4] bg-white dark:divide-[#243044] dark:border-[#243044] dark:bg-[#121a2f]">
          {FAQS.map(item => (
            <details key={item.q} className="group px-5 py-4 open:bg-[#f8faff] dark:open:bg-[#151d2e]">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[#071759] outline-none marker:content-none dark:text-[#f4f7ff] [&::-webkit-details-marker]:hidden">
                <span className="flex items-start justify-between gap-3">
                  {item.q}
                  <span className="mt-0.5 shrink-0 text-[#0c3cff] transition-transform group-open:rotate-45 dark:text-[#93b4ff]">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#5b6b94] dark:text-[#b6c4e2]">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-sm text-[#5b6b94] dark:text-[#b6c4e2]">
          Still have questions?{' '}
          <Link
            to="/about"
            className="font-semibold text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
          >
            Learn more about admissions
          </Link>{' '}
          or{' '}
          <Link
            to="/#admissions"
            className="font-semibold text-[#0c3cff] hover:underline dark:text-[#93b4ff]"
          >
            start an application
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
