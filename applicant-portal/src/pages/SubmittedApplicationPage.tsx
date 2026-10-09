import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  GraduationCap,
  IdCard,
  Loader2,
  Printer,
  RefreshCw,
  Trophy,
  UserRound,
} from 'lucide-react'
import { ApplicationDocumentsPanel } from '@/components/application/view/ApplicationDocumentsPanel'
import { OnlinePaymentPanel } from '@/components/application/view/OnlinePaymentPanel'
import { PaymentEvidencePanel } from '@/components/application/view/PaymentEvidencePanel'
import { useAuth } from '@/context/AuthContext'
import { getApplicantOffering } from '@/lib/api/admissions'
import {
  getAcademicStep,
  getAddresses,
  getContacts,
  getDeclarationStep,
  getDeclarationTexts,
  getProfileStep,
  getProgrammeStep,
} from '@/lib/api/applications'
import { ApiError } from '@/lib/api/client'
import {
  getDocumentCompleteness,
  getDocumentRequirements,
} from '@/lib/api/documents'
import { getApplicantOfferView } from '@/lib/api/offer'
import {
  getOnlinePaymentStatus,
  getProcessingFeeStatus,
  listPaymentEvidence,
} from '@/lib/api/processing-fee'
import { degreeLevelLabel, formatIntakeDateTime } from '@/lib/admissions-display'
import { getApplicationBindingByApplicantId } from '@/lib/application-session'
import {
  ADDRESS_TYPE_OPTIONS,
  CONTACT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  REFERRAL_OPTIONS,
  academicRecordTitle,
  qualificationLevelLabel,
} from '@/lib/application-steps'
import type {
  AcademicRecordResponse,
  ApplicantDocumentRequirement,
  ApplicantOffering,
  ApplicationAddressResponse,
  ApplicationContactResponse,
  DocumentCompleteness,
  OfferingDeclarationText,
  OnlinePayment,
  PaymentEvidence,
  ProcessingFeeStatusResponse,
  ProfileStepResponse,
  QualificationLevel,
} from '@/lib/api/types'

function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
) {
  if (!value) return '—'
  return options.find((item) => item.value === value)?.label ?? value
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
  })
}

function money(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return `Rs. ${num.toLocaleString()}`
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-[#8b9bb8]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[#071759]">
        {value?.trim() ? value : '—'}
      </p>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  badge,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  badge?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8edf7] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2fa] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8efff] text-[#0c3cff]">
            {icon}
          </div>
          <h2 className="text-base font-bold text-[#071759]">{title}</h2>
          {badge}
        </div>
        {action}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

function feeVerified(status: string | null | undefined) {
  const value = (status || '').toUpperCase()
  return value.includes('VERIFIED') || value === 'PAID'
}

function currentStageLabel(params: {
  applicationStatus: string
  feeOk: boolean
  offerReleased: boolean
}) {
  const status = params.applicationStatus.toUpperCase()
  if (params.offerReleased) return 'Offer released'
  if (status === 'APPROVED') return 'Application approved'
  if (params.feeOk) return 'Fee verified'
  if (status === 'SUBMITTED' || status === 'COMPLETE') return 'Submitted'
  return status.replaceAll('_', ' ')
}

type TimelineStep = {
  id: string
  label: string
  done: boolean
  date?: string | null
  pending?: boolean
}

export function SubmittedApplicationPage() {
  const { applicantId = '' } = useParams()
  const { isAuthenticated } = useAuth()
  const binding = getApplicationBindingByApplicantId(applicantId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<QualificationLevel | null>(null)
  const [offerings, setOfferings] = useState<ApplicantOffering[]>([])
  const [records, setRecords] = useState<AcademicRecordResponse[]>([])
  const [profile, setProfile] = useState<ProfileStepResponse | null>(null)
  const [addresses, setAddresses] = useState<ApplicationAddressResponse[]>([])
  const [contacts, setContacts] = useState<ApplicationContactResponse[]>([])
  const [declarationTexts, setDeclarationTexts] = useState<
    OfferingDeclarationText[]
  >([])
  const [acceptedIds, setAcceptedIds] = useState<string[]>([])
  const [applicationStatus, setApplicationStatus] = useState<string>('SUBMITTED')
  const [submissionDate, setSubmissionDate] = useState<string | null>(null)
  const [feeStatus, setFeeStatus] = useState<ProcessingFeeStatusResponse | null>(
    null,
  )
  const [evidence, setEvidence] = useState<PaymentEvidence[]>([])
  const [onlinePayment, setOnlinePayment] = useState<OnlinePayment | null>(null)
  const [requirements, setRequirements] = useState<
    ApplicantDocumentRequirement[]
  >([])
  const [completeness, setCompleteness] =
    useState<DocumentCompleteness | null>(null)
  const [offerReleased, setOfferReleased] = useState(false)
  const [offerPublishedAt, setOfferPublishedAt] = useState<string | null>(null)

  const loadDocuments = useCallback(async () => {
    const [reqs, complete] = await Promise.all([
      getDocumentRequirements(applicantId).catch(
        () => [] as ApplicantDocumentRequirement[],
      ),
      getDocumentCompleteness(applicantId).catch(() => null),
    ])
    setRequirements(reqs)
    setCompleteness(complete)
  }, [applicantId])

  const loadFeeAndEvidence = useCallback(async () => {
    const [fee, evidenceRows, online] = await Promise.all([
      getProcessingFeeStatus(applicantId).catch(() => null),
      listPaymentEvidence(applicantId).catch(() => [] as PaymentEvidence[]),
      getOnlinePaymentStatus(applicantId).catch((err) => {
        if (err instanceof ApiError && err.statusCode === 404) return null
        return null
      }),
    ])
    setFeeStatus(fee)
    setEvidence(evidenceRows)
    setOnlinePayment(online)
    if (fee?.applicationStatus) {
      setApplicationStatus((prev) => fee.applicationStatus || prev)
    }
  }, [applicantId])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        programme,
        academic,
        profileData,
        addressList,
        contactList,
        declaration,
        texts,
        fee,
        evidenceRows,
        online,
        offer,
      ] = await Promise.all([
        getProgrammeStep(applicantId),
        getAcademicStep(applicantId),
        getProfileStep(applicantId),
        getAddresses(applicantId).catch(() => []),
        getContacts(applicantId).catch(() => []),
        getDeclarationStep(applicantId).catch(() => null),
        getDeclarationTexts(applicantId).catch(() => []),
        getProcessingFeeStatus(applicantId).catch(() => null),
        listPaymentEvidence(applicantId).catch(() => [] as PaymentEvidence[]),
        getOnlinePaymentStatus(applicantId).catch((err) => {
          if (err instanceof ApiError && err.statusCode === 404) return null
          return null
        }),
        getApplicantOfferView().catch(() => null),
      ])

      setLevel(programme.qualificationLevel)
      setRecords(academic.records ?? [])
      setProfile(profileData)
      setAddresses(
        addressList.length > 0 ? addressList : (profileData.addresses ?? []),
      )
      setContacts(
        contactList.length > 0 ? contactList : (profileData.contacts ?? []),
      )
      setDeclarationTexts(texts)
      setAcceptedIds(declaration?.acceptedOfferingDeclarationIds ?? [])
      setApplicationStatus(
        declaration?.applicationStatus || fee?.applicationStatus || 'SUBMITTED',
      )
      setSubmissionDate(declaration?.submissionDate ?? null)
      setFeeStatus(fee)
      setEvidence(evidenceRows)
      setOnlinePayment(online)

      const offerStatus = (offer?.status || '').toUpperCase()
      const released =
        !!offer &&
        ['PUBLISHED', 'ACCEPTED', 'DECLINED', 'EXPIRED'].includes(offerStatus)
      setOfferReleased(released)
      setOfferPublishedAt(offer?.publishedAt ?? null)

      const sorted = [...(programme.options ?? [])].sort(
        (a, b) => a.preferenceOrder - b.preferenceOrder,
      )
      const offeringRows = await Promise.all(
        sorted.map((opt) =>
          getApplicantOffering(opt.programmeOfferingId).catch(() => null),
        ),
      )
      setOfferings(
        offeringRows.filter((row): row is ApplicantOffering => !!row),
      )

      await loadDocuments()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to load application details.',
      )
    } finally {
      setLoading(false)
    }
  }, [applicantId, loadDocuments])

  useEffect(() => {
    if (!isAuthenticated || !applicantId) return
    void loadAll()
  }, [applicantId, isAuthenticated, loadAll])

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `/applications/${applicantId}/view` }}
      />
    )
  }

  const acceptedTexts = declarationTexts.filter((text) =>
    acceptedIds.includes(text.id),
  )
  const reference =
    binding?.applicationReference ||
    feeStatus?.challan?.registrationNumber ||
    applicantId
  const feeOk = feeVerified(feeStatus?.paymentStatus)
  const approved = applicationStatus.toUpperCase() === 'APPROVED'
  const submitted = !!submissionDate || ['SUBMITTED', 'COMPLETE', 'APPROVED', 'REJECTED'].includes(applicationStatus.toUpperCase())
  const currentEvidence =
    evidence.find((row) => row.isCurrent) ?? evidence[0] ?? null
  const feeVerifiedDate =
    currentEvidence?.verificationIndicator?.toUpperCase() === 'VERIFIED'
      ? currentEvidence.uploadDate
      : null
  const stage = currentStageLabel({
    applicationStatus,
    feeOk,
    offerReleased,
  })
  const challan = feeStatus?.challan
  const verifiedDocs = completeness?.verifiedCount ?? 0
  const requiredDocs = completeness?.requiredCount ?? requirements.length

  const timeline: TimelineStep[] = [
    {
      id: 'submitted',
      label: 'Submitted',
      done: submitted,
      date: formatShortDate(submissionDate),
    },
    {
      id: 'fee',
      label: 'Fee verified',
      done: feeOk,
      date: formatShortDate(feeVerifiedDate),
    },
    {
      id: 'approved',
      label: 'Application approved',
      done: approved,
      date: approved ? formatShortDate(binding?.updatedAt) : null,
    },
    {
      id: 'offer',
      label: 'Offer released',
      done: offerReleased,
      date: offerReleased ? formatShortDate(offerPublishedAt) : null,
      pending: !offerReleased,
    },
  ]

  return (
    <div className="min-h-[70vh] bg-[#f4f6fb]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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
              Application details
            </h1>
            <p className="mt-1 text-sm text-[#6374ab]">
              Ref:{' '}
              <span className="font-medium text-[#071759]">{reference}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] shadow-sm"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <Link
              to={`/applications/${applicantId}/processing-fee/challan`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
            >
              <Printer className="h-4 w-4" />
              Fee challan
            </Link>
            {approved ? (
              <Link
                to={`/applications/${applicantId}/admit-card`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
              >
                <IdCard className="h-4 w-4" />
                Admit card
              </Link>
            ) : null}
            <Link
              to="/results"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
            >
              <Trophy className="h-4 w-4" />
              Results
            </Link>
            <Link
              to="/offer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
            >
              <GraduationCap className="h-4 w-4" />
              Offer
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex items-center justify-center gap-2 text-sm text-[#6374ab]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading application...
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-white px-5 py-6 text-center shadow-sm">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadAll()}
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {/* Status hero + timeline */}
            <section className="overflow-hidden rounded-2xl border border-[#e8edf7] bg-white shadow-sm">
              <div className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_220px]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b9bb8]">
                    Application
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#071759] sm:text-2xl">
                    Application {reference}
                  </h2>
                  <p className="mt-1.5 text-sm text-[#6374ab]">
                    Submitted{' '}
                    {submissionDate
                      ? formatIntakeDateTime(submissionDate)
                      : '—'}
                    {binding?.updatedAt
                      ? ` · Updated ${formatIntakeDateTime(binding.updatedAt)}`
                      : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        approved
                          ? 'bg-[#dcfce7] text-[#166534]'
                          : 'bg-[#dbeafe] text-[#1d4ed8]'
                      }`}
                    >
                      {applicationStatus}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        feeOk
                          ? 'bg-[#dcfce7] text-[#166534]'
                          : 'bg-[#fff7ed] text-[#c2410c]'
                      }`}
                    >
                      {feeOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      Fee: {feeStatus?.paymentStatus || 'UNPAID'}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-[#f5f8ff] px-4 py-3 ring-1 ring-[#dbe7ff]">
                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8b9bb8]">
                    <Calendar className="h-3.5 w-3.5 text-[#0c3cff]" />
                    Current stage
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-[#071759]">
                    {stage}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#eef2fa] px-5 py-5">
                <ol className="grid gap-4 sm:grid-cols-4">
                  {timeline.map((step, index) => (
                    <li key={step.id} className="relative flex items-start gap-3">
                      {index < timeline.length - 1 ? (
                        <span
                          className={`absolute left-[15px] top-8 hidden h-[calc(100%-2rem)] w-px sm:block ${
                            step.done ? 'bg-[#86efac]' : 'bg-[#e4e9f4]'
                          }`}
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          step.done
                            ? 'bg-[#22c55e] text-white'
                            : 'bg-white text-[#94a3b8] ring-2 ring-[#e4e9f4]'
                        }`}
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full bg-[#cbd5e1]" />
                        )}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-semibold text-[#071759]">
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-xs text-[#8b9bb8]">
                          {step.done
                            ? step.date || 'Done'
                            : step.pending
                              ? 'Pending'
                              : 'Not yet'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* Payment summary */}
            <SectionCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Payment details"
              badge={
                feeOk ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2.5 py-1 text-xs font-semibold text-[#166534]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Payment verified
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-semibold text-[#c2410c]">
                    {feeStatus?.paymentStatus || 'UNPAID'}
                  </span>
                )
              }
            >
              {challan ? (
                <div className="mb-5 grid gap-3 rounded-xl bg-[#f8faff] px-4 py-3 sm:grid-cols-3">
                  <Field
                    label="Payment method"
                    value={
                      onlinePayment
                        ? `Online · ${onlinePayment.paymentMethod}`
                        : 'Bank Challan'
                    }
                  />
                  <Field label="Challan no." value={challan.challanNumber} />
                  <Field
                    label="Amount"
                    value={money(challan.totalAmountPayable)}
                  />
                </div>
              ) : (
                <p className="mb-4 text-sm text-[#6374ab]">
                  Processing fee challan is not available yet.
                </p>
              )}

              <div className="mb-4 flex flex-wrap gap-2">
                <Link
                  to={`/applications/${applicantId}/processing-fee/challan`}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc]"
                >
                  <Printer className="h-4 w-4" />
                  View / print challan
                </Link>
                {currentEvidence?.downloadUrl ? (
                  <a
                    href={currentEvidence.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d5def3] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
                  >
                    View payment receipt
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-[#eef2fa] pt-4">
                <OnlinePaymentPanel
                  applicantId={applicantId}
                  challan={feeStatus?.challan ?? null}
                  paymentStatus={feeStatus?.paymentStatus}
                  embedded
                  onChanged={loadFeeAndEvidence}
                  onPaymentChanged={setOnlinePayment}
                />
                <PaymentEvidencePanel
                  applicantId={applicantId}
                  evidence={evidence}
                  paymentStatus={feeStatus?.paymentStatus}
                  onlinePaymentTransactionId={
                    onlinePayment && !onlinePayment.receiptUploaded
                      ? onlinePayment.id
                      : null
                  }
                  embedded
                  onChanged={loadFeeAndEvidence}
                />
              </div>
            </SectionCard>

            <SectionCard
              icon={<FileText className="h-5 w-5" />}
              title="Admission documents"
              badge={
                requiredDocs > 0 ? (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      completeness?.complete
                        ? 'bg-[#dcfce7] text-[#166534]'
                        : 'bg-[#eff6ff] text-[#1d4ed8]'
                    }`}
                  >
                    {verifiedDocs}/{requiredDocs} verified
                  </span>
                ) : null
              }
            >
              <ApplicationDocumentsPanel
                applicantId={applicantId}
                requirements={requirements}
                completeness={completeness}
                onChanged={loadDocuments}
              />
            </SectionCard>

            <SectionCard
              icon={<UserRound className="h-5 w-5" />}
              title="Personal profile"
            >
              {profile ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-5">
                    {profile.profilePhotographDownloadUrl ? (
                      <img
                        src={profile.profilePhotographDownloadUrl}
                        alt="Applicant"
                        className="h-28 w-28 rounded-xl border border-[#e4e9f4] object-cover"
                      />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#94a3b8]">
                        <UserRound className="h-10 w-10" />
                      </div>
                    )}
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <Field label="Full name" value={profile.applicantName} />
                      <Field
                        label="Gender"
                        value={optionLabel(GENDER_OPTIONS, profile.gender)}
                      />
                      <Field
                        label="Marital status"
                        value={optionLabel(
                          MARITAL_STATUS_OPTIONS,
                          profile.maritalStatus,
                        )}
                      />
                      <Field
                        label="Date of birth"
                        value={formatDate(profile.dateOfBirth)}
                      />
                      <Field label="Mobile" value={profile.mobileNumber} />
                      <Field label="Telephone" value={profile.telephone} />
                      <Field
                        label="Disability declared"
                        value={profile.disabilityDeclared ? 'Yes' : 'No'}
                      />
                      <Field
                        label="Referral source"
                        value={optionLabel(
                          REFERRAL_OPTIONS,
                          profile.referralSource,
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8b9bb8]">
                      Addresses
                    </h3>
                    {addresses.length === 0 ? (
                      <p className="text-sm text-[#6374ab]">No addresses saved.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {addresses.map((address) => (
                          <div
                            key={address.id}
                            className="rounded-xl bg-[#f8faff] px-3 py-2.5 text-sm"
                          >
                            <p className="font-medium text-[#071759]">
                              {optionLabel(
                                ADDRESS_TYPE_OPTIONS,
                                address.addressType,
                              )}
                            </p>
                            <p className="mt-0.5 text-[#354a8d]">
                              {[
                                address.addressLine1,
                                address.addressLine2,
                                address.postalCode,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8b9bb8]">
                      Contacts
                    </h3>
                    {contacts.length === 0 ? (
                      <p className="text-sm text-[#6374ab]">No contacts saved.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="rounded-xl bg-[#f8faff] px-3 py-2.5 text-sm"
                          >
                            <p className="font-medium text-[#071759]">
                              {optionLabel(
                                CONTACT_TYPE_OPTIONS,
                                contact.contactType,
                              )}{' '}
                              · {contact.name}
                            </p>
                            <p className="mt-0.5 text-[#354a8d]">
                              {contact.relationship} · {contact.mobileNumber}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#6374ab]">Profile not available.</p>
              )}
            </SectionCard>

            <SectionCard
              icon={<GraduationCap className="h-5 w-5" />}
              title="Programme selection"
            >
              {level ? (
                <p className="mb-3 text-sm text-[#6374ab]">
                  Qualification level:{' '}
                  <span className="font-semibold text-[#071759]">
                    {qualificationLevelLabel(level)}
                  </span>
                </p>
              ) : null}
              {offerings.length === 0 ? (
                <p className="text-sm text-[#6374ab]">No programmes selected.</p>
              ) : (
                <ol className="space-y-2">
                  {offerings.map((offering, index) => (
                    <li
                      key={offering.id}
                      className="rounded-xl bg-[#f8faff] px-4 py-3 text-sm"
                    >
                      <span className="font-semibold text-[#071759]">
                        {index + 1}. {offering.programme.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#6374ab]">
                        {offering.programme.code} ·{' '}
                        {degreeLevelLabel(offering.programme.degreeLevel)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </SectionCard>

            <SectionCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Academic details"
            >
              {records.length === 0 ? (
                <p className="text-sm text-[#6374ab]">
                  No academic records saved.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#eef2fa] text-xs uppercase tracking-wide text-[#8b9bb8]">
                        <th className="pb-2 pr-4 font-semibold">Qualification</th>
                        <th className="pb-2 pr-4 font-semibold">
                          Board / Institution
                        </th>
                        <th className="pb-2 pr-4 font-semibold">Roll number</th>
                        <th className="pb-2 pr-4 font-semibold">Passing year</th>
                        <th className="pb-2 pr-4 font-semibold">Marks / GPA</th>
                        <th className="pb-2 font-semibold">Files</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-[#f1f5f9] last:border-0"
                        >
                          <td className="py-3 pr-4 font-medium text-[#071759]">
                            {academicRecordTitle(
                              record.degreeType,
                              record.qualificationName,
                            )}
                          </td>
                          <td className="py-3 pr-4 text-[#354a8d]">
                            {record.boardOrInstitution || '—'}
                          </td>
                          <td className="py-3 pr-4 text-[#354a8d]">
                            {record.rollNumber || '—'}
                          </td>
                          <td className="py-3 pr-4 text-[#354a8d]">
                            {record.passingYear || '—'}
                          </td>
                          <td className="py-3 pr-4 text-[#354a8d]">
                            {record.marksOrGpaObtained} /{' '}
                            {record.marksOrGpaTotal}
                          </td>
                          <td className="py-3">
                            {record.documents?.length ? (
                              <div className="flex flex-col gap-1">
                                {record.documents.map((doc) =>
                                  doc.downloadUrl ? (
                                    <a
                                      key={doc.id}
                                      href={doc.downloadUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-[#0c3cff] hover:underline"
                                    >
                                      {doc.documentType || 'File'}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span
                                      key={doc.id}
                                      className="text-xs text-[#8b9bb8]"
                                    >
                                      {doc.documentType || 'File'}
                                    </span>
                                  ),
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-[#8b9bb8]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<FileText className="h-5 w-5" />}
              title="Declarations"
            >
              {acceptedTexts.length === 0 ? (
                <p className="text-sm text-[#6374ab]">
                  {declarationTexts.length === 0
                    ? 'No declarations were required for this programme.'
                    : 'No accepted declarations found.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {acceptedTexts.map((text) => (
                    <li
                      key={text.id}
                      className="rounded-xl bg-[#f8faff] px-3 py-2 text-sm text-[#354a8d]"
                    >
                      {text.declarationText}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  )
}
