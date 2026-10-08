import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ApplyOrContinueButton } from '@/components/admissions/ApplyOrContinueButton'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getApplicantIntake,
  getApplicantOffering,
  getApplicantOfferingCriteria,
  getApplicantOfferingDeclarations,
  getApplicantOfferingFees,
} from '@/lib/api/admissions'
import type {
  ApplicantCriterion,
  ApplicantFee,
  ApplicantIntake,
  ApplicantOffering,
  ApplicantOfferingDeclaration,
} from '@/lib/api/types'
import { degreeLevelLabel } from '@/lib/admissions-display'

export function OfferingDetailPage() {
  const { offeringId = '' } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offering, setOffering] = useState<ApplicantOffering | null>(null)
  const [intake, setIntake] = useState<ApplicantIntake | null>(null)
  const [criteria, setCriteria] = useState<ApplicantCriterion[]>([])
  const [fees, setFees] = useState<ApplicantFee[]>([])
  const [declarations, setDeclarations] = useState<ApplicantOfferingDeclaration[]>(
    [],
  )

  useEffect(() => {
    if (!offeringId) return

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [offeringData, criteriaData, feesData, declarationData] =
          await Promise.all([
            getApplicantOffering(offeringId),
            getApplicantOfferingCriteria(offeringId),
            getApplicantOfferingFees(offeringId),
            getApplicantOfferingDeclarations(offeringId).catch(
              () => [] as ApplicantOfferingDeclaration[],
            ),
          ])
        if (cancelled) return

        setOffering(offeringData)
        setCriteria(criteriaData)
        setFees(feesData)
        setDeclarations(declarationData)

        try {
          const intakeData = await getApplicantIntake(offeringData.intakeId)
          if (!cancelled) setIntake(intakeData)
        } catch {
          if (!cancelled) setIntake(null)
        }
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unable to load programme details.')
        setOffering(null)
        setCriteria([])
        setFees([])
        setDeclarations([])
        setIntake(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [offeringId])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => {
          if (intake) navigate(`/intakes/${intake.id}`)
          else navigate(-1)
        }}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#0c3cff] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to intake
      </button>

      {loading ? (
        <div className="space-y-4 rounded-xl border border-[#e4e9f4] bg-white p-6">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
          <div className="flex items-center gap-2 text-sm text-[#6374ab]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading programme details…
          </div>
        </div>
      ) : error || !offering ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700">
          <p>{error ?? 'Programme not found.'}</p>
          <Link to="/" className="mt-4 inline-block font-medium text-[#0c3cff] hover:underline">
            Return to home
          </Link>
        </div>
      ) : (
        <article className="overflow-hidden rounded-xl border border-[#e4e9f4] bg-white">
          <header className="flex flex-col gap-4 border-b border-[#e8edf5] px-5 py-6 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-[#6374ab] uppercase">
                Programme details
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#071759]">{offering.programme.code}</h1>
              <p className="mt-1 text-sm text-[#354a8d]">{offering.programme.name}</p>
              {intake ? (
                <p className="mt-2 text-xs text-[#6374ab]">
                  Intake: {intake.intakeName} · {intake.intakeCode}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full bg-[#edf3ff] text-[#19316f]">
                  {degreeLevelLabel(offering.programme.degreeLevel)}
                </Badge>
                {offering.programme.programmeGrouping ? (
                  <Badge variant="outline" className="rounded-full">
                    {offering.programme.programmeGrouping}
                  </Badge>
                ) : null}
              </div>
            </div>
            {intake ? (
              <ApplyOrContinueButton intakeId={intake.id} offeringId={offering.id} />
            ) : null}
          </header>

          <div className="space-y-8 px-5 py-6 sm:px-6">
            {offering.publishedDescription ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-[#071759]">About this programme</h2>
                <p className="text-sm leading-relaxed text-[#354a8d]">{offering.publishedDescription}</p>
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 text-sm font-semibold text-[#071759]">Admission criteria</h2>
              {criteria.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#dce5f6] px-4 py-6 text-sm text-[#6374ab]">
                  No criteria published for this programme.
                </p>
              ) : (
                <ul className="space-y-2">
                  {criteria.map(item => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-[#e4e9f4] px-4 py-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-[#071759]">
                          {item.criteriaName ?? 'Criterion'}
                        </p>
                        {item.mandatory ? (
                          <Badge className="rounded-full bg-[#fee2e2] text-[#b91c1c]">Mandatory</Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-full">
                            Optional
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[#354a8d]">
                        {[item.criteriaOperator, item.criteriaRequirement, item.criteriaUnit]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold text-[#071759]">Fees</h2>
              {fees.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#dce5f6] px-4 py-6 text-sm text-[#6374ab]">
                  No fees published for this programme.
                </p>
              ) : (
                <ul className="space-y-2">
                  {fees.map(fee => (
                    <li
                      key={fee.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#e4e9f4] px-4 py-3 text-sm"
                    >
                      <span className="text-[#354a8d]">{fee.feeType}</span>
                      <span className="font-semibold text-[#071759]">
                        {fee.currency} {fee.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {declarations.length > 0 ? (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-[#071759]">
                  Terms &amp; declarations
                </h2>
                <p className="mb-3 text-xs text-[#6374ab]">
                  Preview of programme terms. You will formally accept these
                  during the application declaration step.
                </p>
                <ul className="space-y-3">
                  {declarations.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-[#e4e9f4] px-4 py-3 text-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6374ab]">
                        {item.version}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed text-[#354a8d]">
                        {item.declarationText}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="rounded-xl border border-[#d6e4ff] bg-[#eef4ff] px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[#071759]">Ready to apply?</p>
                  <p className="mt-0.5 text-sm text-[#354a8d]">
                    Start a new application, or continue your existing one.
                  </p>
                </div>
                {intake ? (
                  <ApplyOrContinueButton
                    intakeId={intake.id}
                    offeringId={offering.id}
                    size="sm"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </article>
      )}
    </div>
  )
}
