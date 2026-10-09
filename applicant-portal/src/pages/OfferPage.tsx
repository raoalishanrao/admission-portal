import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  FileUp,
  GraduationCap,
  Loader2,
  Printer,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { getApplicantOfferView, type ApplicantOfferView } from '@/lib/api/offer'
import {
  getOfferFeeChallan,
  uploadOfferFeeEvidence,
} from '@/lib/api/offer-fee'
import { degreeLevelLabel, formatIntakeDateTime } from '@/lib/admissions-display'
import type { OfferFeeChallan, OfferFeeEvidence } from '@/lib/api/types'

function paymentStyles(status: string) {
  const value = status.toUpperCase()
  if (value.includes('VERIFIED')) return 'bg-[#dcfce7] text-[#166534]'
  if (value === 'EVIDENCE_SUBMITTED') return 'bg-[#fff7ed] text-[#c2410c]'
  if (value === 'EXPIRED') return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#eff6ff] text-[#1d4ed8]'
}

function money(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `Rs. ${num.toLocaleString()}`
}

function IconTile({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode
  tone?: 'blue' | 'green'
}) {
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
        tone === 'green' ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#e8efff] text-[#0c3cff]'
      }`}
    >
      {children}
    </div>
  )
}

export function OfferPage() {
  const { isAuthenticated, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offer, setOffer] = useState<ApplicantOfferView | null>(null)
  const [challan, setChallan] = useState<OfferFeeChallan | null>(null)
  const [challanError, setChallanError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<OfferFeeEvidence | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [amountClaimed, setAmountClaimed] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const applicantId =
    offer?.applicationRecordId || user?.applicantId || challan?.applicantId || ''

  async function load() {
    setLoading(true)
    setError(null)
    setChallanError(null)
    try {
      const data = await getApplicantOfferView()
      setOffer(data)
      setEvidence(data?.currentEvidence ?? null)

      if (data?.feeChallan) {
        setChallan(data.feeChallan)
        setChallanError(null)
        setAmountClaimed((prev) =>
          prev.trim()
            ? prev
            : String(data.feeChallan?.totalAmountPayable ?? ''),
        )
        return
      }

      const id = data?.applicationRecordId || user?.applicantId || ''
      if (!id) {
        setChallan(null)
        setChallanError(
          'Unable to resolve your application for the admission fee challan.',
        )
        return
      }

      try {
        const fee = await getOfferFeeChallan(id)
        setChallan(fee)
        setChallanError(null)
        setAmountClaimed((prev) =>
          prev.trim() ? prev : String(fee.totalAmountPayable ?? ''),
        )
      } catch (err) {
        setChallan(null)
        if (err instanceof ApiError && err.statusCode === 404) {
          setChallanError(
            data?.status?.toUpperCase() === 'PUBLISHED'
              ? 'Your offer is published, but the admission fee challan could not be created yet. Admissions must configure active admission/tuition fees for this programme, then refresh this page.'
              : 'Admission fee challan is not available yet. It is created when admissions publishes your offer.',
          )
        } else {
          setChallanError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Unable to load admission fee challan.',
          )
        }
      }
    } catch (err) {
      setOffer(null)
      setChallan(null)
      setEvidence(null)
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to load admission offer.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when auth changes
  }, [isAuthenticated])

  async function handleUpload(file: File | undefined) {
    if (!file || !applicantId) return
    setUploadBusy(true)
    setUploadError(null)
    try {
      const claimed =
        amountClaimed.trim() === '' ? undefined : Number(amountClaimed)
      const row = await uploadOfferFeeEvidence(
        applicantId,
        file,
        claimed != null && Number.isFinite(claimed) ? claimed : undefined,
      )
      setEvidence(row)
      const refreshed = await getApplicantOfferView()
      setOffer(refreshed)
      if (refreshed?.feeChallan) setChallan(refreshed.feeChallan)
      else {
        const fee = await getOfferFeeChallan(applicantId)
        setChallan(fee)
      }
      if (refreshed?.currentEvidence) setEvidence(refreshed.currentEvidence)
    } catch (err) {
      setUploadError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to upload payment evidence.',
      )
    } finally {
      setUploadBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function copyChallanNo() {
    if (!challan?.challanNumber) return
    try {
      await navigator.clipboard.writeText(challan.challanNumber)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: '/offer' }} />
  }

  const programme = offer?.offering?.programme
  const paymentStatus = (challan?.paymentStatus || '').toUpperCase()
  const offerStatus = (offer?.status || '').toUpperCase()
  const occupied =
    offerStatus === 'ACCEPTED' || paymentStatus.includes('VERIFIED')
  const evidenceVerified =
    evidence?.verificationIndicator?.toUpperCase() === 'VERIFIED' ||
    paymentStatus.includes('VERIFIED')
  const canUpload =
    !!applicantId &&
    !!challan &&
    !occupied &&
    paymentStatus !== 'EXPIRED' &&
    offerStatus === 'PUBLISHED'

  const programmeTitle =
    programme?.name || challan?.programmeName || 'Programme offering'
  const programmeMeta =
    [programme?.code, programme ? degreeLevelLabel(programme.degreeLevel) : null]
      .filter(Boolean)
      .join(' · ') || offer?.programmeOfferingId

  return (
    <div className="min-h-[70vh] bg-[#f4f6fb]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/my-application"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c3cff]"
            >
              <ArrowLeft className="h-4 w-4" />
              My application
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-[#071759] sm:text-3xl">
              Admission offer
            </h1>
            <p className="mt-1 text-sm text-[#6374ab]">
              {occupied
                ? 'Your seat is confirmed. Keep your challan and receipt for records.'
                : 'Pay the admission fee and upload your bank receipt to occupy your seat.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-16 flex items-center justify-center gap-2 text-sm text-[#6374ab]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading offer…
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-white px-5 py-6 text-center shadow-sm">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : !offer ? (
          <div className="mt-10 rounded-2xl border border-[#e4e9f4] bg-white px-5 py-10 text-center shadow-sm">
            <GraduationCap className="mx-auto h-8 w-8 text-[#94a3b8]" />
            <p className="mt-3 text-sm font-medium text-[#071759]">
              No published offer yet
            </p>
            <p className="mt-1 text-sm text-[#6374ab]">
              After merit allocation, admissions will publish your offer with the
              programme you have been selected for.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {/* Status banner */}
            {occupied ? (
              <section className="relative overflow-hidden rounded-2xl border border-[#bbf7d0] bg-gradient-to-r from-[#ecfdf5] to-[#f0fdf4] px-5 py-5 shadow-sm">
                <div className="relative z-10 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-md shadow-green-200">
                    <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1 pr-16 sm:pr-24">
                    <h2 className="text-xl font-bold text-[#14532d]">
                      Admission Confirmed
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#166534]/70">
                      Your admission fee has been verified and your seat is
                      confirmed. Please check your applicant dashboard for
                      further instructions.
                    </p>
                  </div>
                </div>
                <div
                  className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 sm:block"
                  aria-hidden
                >
                  <div className="relative mr-6">
                    <GraduationCap className="h-16 w-16 text-[#86efac]/80" />
                    <span className="absolute -bottom-0.5 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#22c55e] text-white ring-2 ring-[#ecfdf5]">
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-[#bfdbfe] bg-gradient-to-r from-[#eff6ff] to-[#f8faff] px-5 py-4 shadow-sm">
                <p className="text-sm font-semibold text-[#071759]">
                  How to occupy your admission
                </p>
                <ol className="mt-2 space-y-1.5 text-sm text-[#354a8d]">
                  <li>1. Print the admission fee challan.</li>
                  <li>2. Deposit the fee at the designated bank before the deadline.</li>
                  <li>3. Upload the bank receipt below.</li>
                  <li>
                    4. When admissions verifies payment, your seat is occupied.
                  </li>
                </ol>
              </section>
            )}

            {/* Selected programme */}
            <section className="rounded-2xl border border-[#e8edf7] bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <IconTile>
                    <GraduationCap className="h-5 w-5" />
                  </IconTile>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b9bb8]">
                      Selected programme
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[#071759]">
                      {programmeTitle}
                    </h2>
                    <p className="mt-0.5 text-sm text-[#6374ab]">{programmeMeta}</p>
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <p className="inline-flex items-center gap-1.5 text-[#6374ab]">
                        <Calendar className="h-3.5 w-3.5 text-[#0c3cff]" />
                        <span>
                          Published{' '}
                          <span className="font-medium text-[#071759]">
                            {offer.publishedAt
                              ? formatIntakeDateTime(offer.publishedAt)
                              : '—'}
                          </span>
                        </span>
                      </p>
                      <p className="inline-flex items-center gap-1.5 text-[#6374ab]">
                        <CalendarClock className="h-3.5 w-3.5 text-[#0c3cff]" />
                        <span>
                          Acceptance deadline{' '}
                          <span className="font-medium text-[#071759]">
                            {offer.acceptanceDeadline
                              ? formatIntakeDateTime(offer.acceptanceDeadline)
                              : '—'}
                          </span>
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                {occupied ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-semibold text-[#166534]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Seat occupied
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-[#dbeafe] px-3 py-1.5 text-xs font-semibold text-[#1d4ed8]">
                    {offer.status}
                  </span>
                )}
              </div>
            </section>

            {/* Admission fee challan */}
            <section className="rounded-2xl border border-[#e8edf7] bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <IconTile>
                    <FileText className="h-5 w-5" />
                  </IconTile>
                  <div>
                    <h3 className="text-base font-bold text-[#071759]">
                      Admission Fee Challan
                    </h3>
                    <p className="mt-0.5 text-sm text-[#6374ab]">
                      Generated automatically when your offer is published — you
                      do not generate it yourself.
                    </p>
                    {challan ? (
                      <span
                        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStyles(challan.paymentStatus)}`}
                      >
                        {paymentStatus.includes('VERIFIED') ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            VERIFIED
                          </>
                        ) : (
                          challan.paymentStatus
                        )}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {challanError && !challan ? (
                <p className="mt-4 text-sm text-[#6374ab]">{challanError}</p>
              ) : null}

              {challan ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-[#dbe7ff] bg-[#f5f8ff] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-[#6374ab]">Challan no.</span>
                        <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-[#071759] ring-1 ring-[#dbe7ff]">
                          {challan.challanNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyChallanNo()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#0c3cff] hover:bg-white"
                          title="Copy challan number"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {copied ? (
                          <span className="text-xs font-medium text-[#16a34a]">
                            Copied
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#6374ab]">Amount</p>
                        <p className="text-lg font-bold text-[#071759]">
                          {money(challan.totalAmountPayable)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#fee2e2]/80 px-3 py-2 text-sm text-[#b91c1c]">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Payment deadline{' '}
                        <strong>
                          {challan.dueDate
                            ? formatIntakeDateTime(challan.dueDate)
                            : '—'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-2 text-sm text-[#354a8d]">
                      <Building2 className="h-4 w-4 text-[#6374ab]" />
                      {challan.collectionBankName}
                      {challan.collectionBankBranch
                        ? ` · ${challan.collectionBankBranch}`
                        : ''}
                    </p>
                    {applicantId ? (
                      <Link
                        to={`/applications/${applicantId}/offer-fee/challan`}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 hover:bg-[#0934dc]"
                      >
                        <Printer className="h-4 w-4" />
                        View / Print Challan
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            {/* Payment evidence */}
            <section className="rounded-2xl border border-[#e8edf7] bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <IconTile>
                    <Upload className="h-5 w-5" />
                  </IconTile>
                  <div>
                    <h3 className="text-base font-bold text-[#071759]">
                      Payment Evidence
                    </h3>
                    <p className="mt-0.5 text-sm text-[#6374ab]">
                      Upload a clear photo or PDF of the bank receipt after
                      depositing the admission fee.
                    </p>
                  </div>
                </div>
                {evidenceVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-3 py-1.5 text-xs font-semibold text-[#166534]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Payment verified
                  </span>
                ) : evidence ? (
                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                      evidence.verificationIndicator?.toUpperCase() === 'REJECTED'
                        ? 'bg-[#fee2e2] text-[#b91c1c]'
                        : 'bg-[#fff7ed] text-[#c2410c]'
                    }`}
                  >
                    {evidence.verificationIndicator?.toUpperCase() === 'REJECTED'
                      ? 'Rejected'
                      : 'Awaiting verification'}
                  </span>
                ) : null}
              </div>

              {uploadError ? (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {uploadError}
                </p>
              ) : null}

              {evidence ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8faff] px-4 py-3 ring-1 ring-[#e8edf7]">
                  <div>
                    <p className="text-sm font-medium text-[#071759]">
                      Latest upload ·{' '}
                      {evidence.fileFormat?.toUpperCase() || 'File'}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6374ab]">
                      {formatIntakeDateTime(evidence.uploadDate)}
                    </p>
                  </div>
                  {evidence.downloadUrl ? (
                    <a
                      href={evidence.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d5def3] bg-white px-3 text-xs font-medium text-[#071759]"
                    >
                      View file
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              ) : null}

              {canUpload ? (
                <div className="mt-4 space-y-3">
                  <label className="block max-w-xs">
                    <span className="text-xs text-[#6374ab]">
                      Amount claimed (optional)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={amountClaimed}
                      onChange={(event) => setAmountClaimed(event.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#d5def3] px-3 text-sm text-[#071759]"
                      placeholder={challan?.totalAmountPayable || '0'}
                    />
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.bmp,.pdf,image/*,application/pdf"
                    className="hidden"
                    onChange={(event) =>
                      void handleUpload(event.target.files?.[0])
                    }
                  />
                  <button
                    type="button"
                    disabled={uploadBusy}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white shadow-sm shadow-blue-200 hover:bg-[#0934dc] disabled:opacity-60"
                  >
                    {uploadBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : paymentStatus === 'EVIDENCE_SUBMITTED' ? (
                      <Upload className="h-4 w-4" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    {uploadBusy
                      ? 'Uploading…'
                      : paymentStatus === 'EVIDENCE_SUBMITTED'
                        ? 'Replace evidence'
                        : 'Upload receipt'}
                  </button>
                  <p className="text-xs text-[#6374ab]">
                    JPG, PNG, GIF, BMP or PDF · max 10 MB
                  </p>
                </div>
              ) : occupied ? null : !challan ? (
                <p className="mt-4 text-sm text-[#6374ab]">
                  Upload becomes available once the admission fee challan exists.
                </p>
              ) : null}
            </section>

            {offer.offerConditions ? (
              <section className="rounded-2xl border border-[#e8edf7] bg-white px-5 py-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#071759]">
                  Conditions
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#354a8d]">
                  {offer.offerConditions}
                </p>
              </section>
            ) : null}

            {offer.feePaymentInstructions ? (
              <section className="rounded-2xl border border-[#e8edf7] bg-white px-5 py-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#071759]">
                  Fee payment instructions
                </h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[#354a8d]">
                  {offer.feePaymentInstructions}
                </p>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
