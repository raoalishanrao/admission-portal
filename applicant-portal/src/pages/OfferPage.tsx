import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
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

function offerStatusStyles(status: string) {
  const value = status.toUpperCase()
  if (value === 'ACCEPTED') return 'bg-[#dcfce7] text-[#166534]'
  if (value === 'DECLINED' || value === 'EXPIRED') return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#dbeafe] text-[#1d4ed8]'
}

function paymentStyles(status: string) {
  const value = status.toUpperCase()
  if (value.includes('VERIFIED')) return 'bg-[#dcfce7] text-[#166534]'
  if (value === 'EVIDENCE_SUBMITTED') return 'bg-[#fff7ed] text-[#c2410c]'
  if (value === 'EXPIRED') return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#f1f5f9] text-[#475569]'
}

function money(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `Rs. ${num.toLocaleString()}`
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

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: '/offer' }} />
  }

  const programme = offer?.offering?.programme
  const paymentStatus = (challan?.paymentStatus || '').toUpperCase()
  const offerStatus = (offer?.status || '').toUpperCase()
  const occupied = offerStatus === 'ACCEPTED' || paymentStatus.includes('VERIFIED')
  const canUpload =
    !!applicantId &&
    !!challan &&
    !occupied &&
    paymentStatus !== 'EXPIRED' &&
    offerStatus === 'PUBLISHED'

  return (
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
            Pay the admission fee and upload your bank receipt to occupy your
            seat. Admissions confirms acceptance after verifying payment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759]"
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
        <div className="mt-10 rounded-xl border border-red-200 bg-white px-5 py-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : !offer ? (
        <div className="mt-10 rounded-xl border border-[#e4e9f4] bg-white px-5 py-10 text-center">
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
          <section className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-5 py-4">
            <p className="text-sm font-semibold text-[#071759]">
              How to occupy your admission
            </p>
            <ol className="mt-3 space-y-2 text-sm text-[#354a8d]">
              <li>1. Print the admission fee challan (created when the offer is published).</li>
              <li>2. Deposit the fee at the designated bank before the deadline.</li>
              <li>3. Upload the bank receipt below.</li>
              <li>
                4. When admissions verifies payment, your offer becomes{' '}
                <strong>ACCEPTED</strong> and the seat is occupied.
              </li>
            </ol>
            <p className="mt-3 text-xs text-[#6374ab]">
              There is no separate Accept button in the portal. Declining is
              handled by staff / expiry if payment is not completed in time.
            </p>
          </section>

          <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6374ab]">
                  Selected programme
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#071759]">
                  {programme?.name || challan?.programmeName || 'Programme offering'}
                </h2>
                <p className="mt-1 text-sm text-[#6374ab]">
                  {[programme?.code, programme ? degreeLevelLabel(programme.degreeLevel) : null]
                    .filter(Boolean)
                    .join(' · ') || offer.programmeOfferingId}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${offerStatusStyles(offer.status)}`}
                >
                  {occupied ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Seat occupied
                    </span>
                  ) : (
                    offer.status
                  )}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[#6374ab]">Offer type</p>
                <p className="mt-1 text-sm font-medium text-[#071759]">
                  {offer.offerType || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6374ab]">Published</p>
                <p className="mt-1 text-sm font-medium text-[#071759]">
                  {offer.publishedAt
                    ? formatIntakeDateTime(offer.publishedAt)
                    : '—'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="inline-flex items-center gap-1.5 text-xs text-[#6374ab]">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Acceptance deadline
                </p>
                <p className="mt-1 text-sm font-medium text-[#071759]">
                  {offer.acceptanceDeadline
                    ? formatIntakeDateTime(offer.acceptanceDeadline)
                    : '—'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#071759]">
                  Admission fee challan
                </h3>
                <p className="mt-1 text-sm text-[#6374ab]">
                  Generated automatically when your offer is published — you do
                  not generate it yourself.
                </p>
              </div>
              {challan ? (
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStyles(challan.paymentStatus)}`}
                >
                  {challan.paymentStatus}
                </span>
              ) : null}
            </div>

            {challanError && !challan ? (
              <p className="mt-4 text-sm text-[#6374ab]">{challanError}</p>
            ) : null}

            {challan ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-[#6374ab]">Challan no.</p>
                    <p className="mt-1 text-sm font-semibold text-[#071759]">
                      {challan.challanNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6374ab]">Amount</p>
                    <p className="mt-1 text-sm font-semibold text-[#071759]">
                      {money(challan.totalAmountPayable)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6374ab]">Due</p>
                    <p className="mt-1 text-sm font-medium text-[#071759]">
                      {challan.dueDate
                        ? formatIntakeDateTime(challan.dueDate)
                        : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[#354a8d]">
                  {challan.collectionBankName}
                  {challan.collectionBankBranch
                    ? ` · ${challan.collectionBankBranch}`
                    : ''}
                </p>
                {applicantId ? (
                  <Link
                    to={`/applications/${applicantId}/offer-fee/challan`}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc]"
                  >
                    <Printer className="h-4 w-4" />
                    View / print challan
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
            <h3 className="text-base font-semibold text-[#071759]">
              Payment evidence
            </h3>
            <p className="mt-1 text-sm text-[#6374ab]">
              Upload a clear photo or PDF of the bank receipt after depositing
              the admission fee.
            </p>

            {uploadError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {uploadError}
              </p>
            ) : null}

            {evidence ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#f8faff] px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-[#071759]">
                    Latest upload · {evidence.fileFormat?.toUpperCase() || 'File'}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6374ab]">
                    {evidence.verificationIndicator?.toUpperCase() === 'VERIFIED'
                      ? 'Verified — seat occupied after fee confirmation'
                      : evidence.verificationIndicator?.toUpperCase() === 'REJECTED'
                        ? 'Rejected — please upload a new receipt'
                        : 'Awaiting admissions verification'}
                    {' · '}
                    {formatIntakeDateTime(evidence.uploadDate)}
                  </p>
                </div>
                {evidence.downloadUrl ? (
                  <a
                    href={evidence.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c9d4ef] bg-white px-3 text-xs font-medium text-[#071759]"
                  >
                    View file
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : paymentStatus === 'EVIDENCE_SUBMITTED' ? (
              <p className="mt-4 text-sm text-[#c2410c]">
                Evidence has been submitted and is awaiting verification.
              </p>
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
                    className="mt-1 h-10 w-full rounded-lg border border-[#c9d4ef] px-3 text-sm text-[#071759]"
                    placeholder={challan?.totalAmountPayable || '0'}
                  />
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.bmp,.pdf,image/*,application/pdf"
                  className="hidden"
                  onChange={(event) => void handleUpload(event.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={uploadBusy}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc] disabled:opacity-60"
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
            ) : occupied ? (
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#166534]">
                <CheckCircle2 className="h-4 w-4" />
                Payment verified — your admission seat is occupied.
              </p>
            ) : !challan ? (
              <p className="mt-4 text-sm text-[#6374ab]">
                Upload becomes available once the admission fee challan exists.
              </p>
            ) : null}
          </section>

          {offer.offerConditions ? (
            <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
              <h3 className="text-sm font-semibold text-[#071759]">Conditions</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#354a8d]">
                {offer.offerConditions}
              </p>
            </section>
          ) : null}

          {offer.feePaymentInstructions ? (
            <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
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
  )
}
