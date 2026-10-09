import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, Check, Copy, PartyPopper, Printer } from 'lucide-react'
import { ApplicationSidebar } from '@/components/application/ApplicationSidebar'
import { useAuth } from '@/context/AuthContext'
import { getApplicationBindingByApplicantId } from '@/lib/application-session'
import { formatIntakeDateTime } from '@/lib/admissions-display'
import type { ApplicationStepId } from '@/lib/api/types'

type SuccessState = {
  applicationStatus?: string
  submissionDate?: string
  applicationReference?: string | null
  intakeName?: string
  programmeName?: string
}

export function ApplicationSuccessPage() {
  const { applicantId = '' } = useParams()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const state = (location.state as SuccessState | null) ?? {}
  const binding = getApplicationBindingByApplicantId(applicantId)
  const [copied, setCopied] = useState(false)

  const reference = state.applicationReference || binding?.applicationReference || applicantId
  const submittedOn = state.submissionDate
    ? formatIntakeDateTime(state.submissionDate)
    : formatIntakeDateTime(new Date().toISOString())
  const status = state.applicationStatus || 'Under Review'
  const challanPath = `/applications/${applicantId}/processing-fee/challan`

  const completed = useMemo(
    () =>
      ({
        programme: true,
        academic: true,
        documents: true,
        profile: true,
        declaration: true,
        review: true,
      }) satisfies Partial<Record<ApplicationStepId, boolean>>,
    [],
  )

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: `/applications/${applicantId}/success` }} />
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="rounded-xl border border-[#e4e9f4] bg-white px-6 py-10 text-center sm:px-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#dcfce7] text-[#16a34a]">
            <Check className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <div className="mt-2 flex justify-center text-[#0c3cff]">
            <PartyPopper className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#071759] sm:text-3xl">
            Application Submitted Successfully!
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#354a8d]">
            Thank you for your application. Print your processing fee challan and deposit the fee at
            the designated bank to continue.
          </p>

          <div className="mx-auto mt-8 max-w-lg rounded-xl border border-[#e8edf5] bg-[#f8faff] px-5 py-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#6374ab]">Application Reference No.</p>
                <p className="font-semibold text-[#071759]">{reference}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyReference()}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0c3cff]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[#6374ab]">Submitted On</p>
                <p className="text-sm font-medium text-[#071759]">{submittedOn}</p>
              </div>
              <div>
                <p className="text-xs text-[#6374ab]">Application Status</p>
                <span className="mt-1 inline-flex rounded-full bg-[#dbeafe] px-2.5 py-1 text-xs font-semibold text-[#1d4ed8]">
                  {status === 'SUBMITTED' ? 'Under Review' : status}
                </span>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-lg rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-5 py-4 text-left">
            <p className="text-sm font-semibold text-[#071759]">Next step: pay processing fee</p>
            <p className="mt-1 text-xs text-[#6374ab]">
              Download the three-copy bank challan (Student, University, Bank), then deposit cash
              using the challan number.
            </p>
            <Link
              to={challanPath}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0c3cff] px-5 text-sm font-medium text-white hover:bg-[#0934dc] sm:w-auto"
            >
              <Printer className="h-4 w-4" />
              View / Print Challan
            </Link>
          </div>

          <div className="mx-auto mt-8 max-w-lg text-left">
            <h2 className="text-sm font-semibold text-[#071759]">What happens next?</h2>
            <ol className="mt-4 space-y-4">
              <li className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0c3cff]" />
                <div>
                  <p className="text-sm font-semibold text-[#071759]">Pay Processing Fee</p>
                  <p className="text-xs text-[#6374ab]">
                    Print the challan and deposit cash at the designated bank branch.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0c3cff]" />
                <div>
                  <p className="text-sm font-semibold text-[#071759]">Upload payment evidence</p>
                  <p className="text-xs text-[#6374ab]">
                    Open application details and upload a clear photo or PDF of the bank receipt.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0c3cff]" />
                <div>
                  <p className="text-sm font-semibold text-[#071759]">Application Review</p>
                  <p className="text-xs text-[#6374ab]">
                    Our admissions team will review your application after fee verification.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#94a3b8]" />
                <div>
                  <p className="text-sm font-semibold text-[#071759]">Update on Decision</p>
                  <p className="text-xs text-[#6374ab]">
                    You will be notified via email once a decision has been made.
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-[#0c3cff] bg-white px-5 text-sm font-medium text-[#0c3cff]"
            >
              Go to Dashboard
            </Link>
            <Link
              to={`/applications/${applicantId}/view`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0c3cff] px-5 text-sm font-medium text-white hover:bg-[#0934dc]"
            >
              View Application Details
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <ApplicationSidebar
          intake={{
            id: binding?.intakeSessionId ?? 'unknown',
            intakeName: state.intakeName || 'Admissions Intake',
            intakeCode: '',
            applicationOpenAt: new Date().toISOString(),
            applicationCloseAt: new Date().toISOString(),
            publishedAt: null,
          }}
          primaryOffering={
            state.programmeName
              ? {
                  id: 'summary',
                  intakeId: binding?.intakeSessionId ?? '',
                  programmeId: '',
                  programme: {
                    id: '',
                    code: '',
                    name: state.programmeName,
                    degreeLevel: 'Undergraduate',
                    programmeGrouping: null,
                  },
                  publishedDescription: '',
                  displayOrder: null,
                  publishedAt: null,
                }
              : null
          }
          currentStep="review"
          completed={completed}
        />
      </div>
    </div>
  )
}
