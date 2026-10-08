import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  GraduationCap,
  IdCard,
  Loader2,
  Printer,
  RefreshCw,
  Trophy,
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
  return date.toLocaleDateString()
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-[#6374ab]">{label}</p>
      <p className="text-sm font-medium text-[#071759]">{value?.trim() ? value : '—'}</p>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
      <h2 className="text-base font-semibold text-[#071759]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function statusBadge(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'APPROVED') return 'bg-[#dcfce7] text-[#166534]'
  if (normalized === 'REJECTED') return 'bg-[#fee2e2] text-[#b91c1c]'
  if (normalized === 'SUBMITTED' || normalized === 'COMPLETE')
    return 'bg-[#dbeafe] text-[#1d4ed8]'
  return 'bg-[#f1f5f9] text-[#475569]'
}

function paymentBadge(status: string) {
  const normalized = status.toUpperCase()
  if (normalized.includes('VERIFIED') || normalized === 'PAID')
    return 'bg-[#dcfce7] text-[#166534]'
  if (normalized.includes('REJECT')) return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#fff7ed] text-[#c2410c]'
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
  const [declarationTexts, setDeclarationTexts] = useState<OfferingDeclarationText[]>([])
  const [acceptedIds, setAcceptedIds] = useState<string[]>([])
  const [applicationStatus, setApplicationStatus] = useState<string>('SUBMITTED')
  const [submissionDate, setSubmissionDate] = useState<string | null>(null)
  const [feeStatus, setFeeStatus] = useState<ProcessingFeeStatusResponse | null>(null)
  const [evidence, setEvidence] = useState<PaymentEvidence[]>([])
  const [onlinePayment, setOnlinePayment] = useState<OnlinePayment | null>(null)
  const [requirements, setRequirements] = useState<ApplicantDocumentRequirement[]>([])
  const [completeness, setCompleteness] = useState<DocumentCompleteness | null>(null)

  const loadDocuments = useCallback(async () => {
    const [reqs, complete] = await Promise.all([
      getDocumentRequirements(applicantId).catch(() => [] as ApplicantDocumentRequirement[]),
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
      const [programme, academic, profileData, addressList, contactList, declaration, texts, fee, evidenceRows, online] =
        await Promise.all([
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
        ])

      setLevel(programme.qualificationLevel)
      setRecords(academic.records ?? [])
      setProfile(profileData)
      setAddresses(addressList.length > 0 ? addressList : (profileData.addresses ?? []))
      setContacts(contactList.length > 0 ? contactList : (profileData.contacts ?? []))
      setDeclarationTexts(texts)
      setAcceptedIds(declaration?.acceptedOfferingDeclarationIds ?? [])
      setApplicationStatus(
        declaration?.applicationStatus || fee?.applicationStatus || 'SUBMITTED',
      )
      setSubmissionDate(declaration?.submissionDate ?? null)
      setFeeStatus(fee)
      setEvidence(evidenceRows)
      setOnlinePayment(online)

      const sorted = [...(programme.options ?? [])].sort(
        (a, b) => a.preferenceOrder - b.preferenceOrder,
      )
      const offeringRows = await Promise.all(
        sorted.map((opt) => getApplicantOffering(opt.programmeOfferingId).catch(() => null)),
      )
      setOfferings(offeringRows.filter((row): row is ApplicantOffering => !!row))

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

  const acceptedTexts = declarationTexts.filter((text) => acceptedIds.includes(text.id))
  const reference = binding?.applicationReference || feeStatus?.challan?.registrationNumber || applicantId

  return (
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
            Ref: <span className="font-medium text-[#071759]">{reference}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to={`/applications/${applicantId}/processing-fee/challan`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
          >
            <Printer className="h-4 w-4" />
            Fee challan
          </Link>
          {applicationStatus.toUpperCase() === 'APPROVED' ? (
            <Link
              to={`/applications/${applicantId}/admit-card`}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc]"
            >
              <IdCard className="h-4 w-4" />
              Admit card
            </Link>
          ) : null}
          <Link
            to="/results"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
          >
            <Trophy className="h-4 w-4" />
            Results
          </Link>
          <Link
            to="/offer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759] hover:bg-[#f8faff]"
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
        <div className="mt-10 rounded-xl border border-red-200 bg-white px-5 py-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-[#6374ab]">Application status</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(applicationStatus)}`}
                >
                  {applicationStatus}
                </span>
              </div>
              <div>
                <p className="text-xs text-[#6374ab]">Submitted on</p>
                <p className="mt-1 text-sm font-medium text-[#071759]">
                  {submissionDate ? formatIntakeDateTime(submissionDate) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6374ab]">Processing fee</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadge(feeStatus?.paymentStatus || 'UNPAID')}`}
                >
                  {feeStatus?.paymentStatus || 'UNPAID'}
                </span>
              </div>
            </div>
          </section>

          <OnlinePaymentPanel
            applicantId={applicantId}
            challan={feeStatus?.challan ?? null}
            paymentStatus={feeStatus?.paymentStatus}
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
            onChanged={loadFeeAndEvidence}
          />

          <ApplicationDocumentsPanel
            applicantId={applicantId}
            requirements={requirements}
            completeness={completeness}
            academicDocuments={records.flatMap((record) =>
              (record.documents ?? []).map((doc) => ({
                ...doc,
                degreeType: record.degreeType,
                qualificationName: record.qualificationName,
              })),
            )}
            onChanged={loadDocuments}
          />

          <Section title="Profile">
            {profile ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" value={profile.applicantName} />
                  <Field label="Gender" value={optionLabel(GENDER_OPTIONS, profile.gender)} />
                  <Field
                    label="Marital status"
                    value={optionLabel(MARITAL_STATUS_OPTIONS, profile.maritalStatus)}
                  />
                  <Field label="Date of birth" value={formatDate(profile.dateOfBirth)} />
                  <Field label="Mobile" value={profile.mobileNumber} />
                  <Field label="Telephone" value={profile.telephone} />
                  <Field
                    label="Disability declared"
                    value={profile.disabilityDeclared ? 'Yes' : 'No'}
                  />
                  <Field
                    label="Referral source"
                    value={optionLabel(REFERRAL_OPTIONS, profile.referralSource)}
                  />
                </div>
                {profile.profilePhotographDownloadUrl ? (
                  <div>
                    <p className="mb-2 text-xs text-[#6374ab]">Photograph</p>
                    <img
                      src={profile.profilePhotographDownloadUrl}
                      alt="Applicant"
                      className="h-28 w-28 rounded-lg border border-[#e4e9f4] object-cover"
                    />
                  </div>
                ) : null}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6374ab]">
                    Addresses
                  </h3>
                  {addresses.length === 0 ? (
                    <p className="text-sm text-[#6374ab]">No addresses saved.</p>
                  ) : (
                    <div className="space-y-2">
                      {addresses.map((address) => (
                        <div key={address.id} className="rounded-lg bg-[#f8faff] px-3 py-2 text-sm">
                          <p className="font-medium text-[#071759]">
                            {optionLabel(ADDRESS_TYPE_OPTIONS, address.addressType)}
                          </p>
                          <p className="text-[#354a8d]">
                            {[address.addressLine1, address.addressLine2, address.postalCode]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6374ab]">
                    Contacts
                  </h3>
                  {contacts.length === 0 ? (
                    <p className="text-sm text-[#6374ab]">No contacts saved.</p>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((contact) => (
                        <div key={contact.id} className="rounded-lg bg-[#f8faff] px-3 py-2 text-sm">
                          <p className="font-medium text-[#071759]">
                            {optionLabel(CONTACT_TYPE_OPTIONS, contact.contactType)} · {contact.name}
                          </p>
                          <p className="text-[#354a8d]">
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
          </Section>

          <Section title="Programme selection">
            {level ? (
              <p className="mb-3 text-sm text-[#354a8d]">
                Qualification level:{' '}
                <span className="font-semibold text-[#071759]">
                  {qualificationLevelLabel(level)}
                </span>
              </p>
            ) : null}
            {offerings.length === 0 ? (
              <p className="text-sm text-[#6374ab]">No programmes selected.</p>
            ) : (
              <ul className="space-y-2">
                {offerings.map((offering, index) => (
                  <li key={offering.id} className="rounded-lg bg-[#f8faff] px-3 py-2 text-sm">
                    <span className="font-medium text-[#071759]">
                      Preference {index + 1}: {offering.programme.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6374ab]">
                      {offering.programme.code} ·{' '}
                      {degreeLevelLabel(offering.programme.degreeLevel)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Academic details">
            {records.length === 0 ? (
              <p className="text-sm text-[#6374ab]">No academic records saved.</p>
            ) : (
              <div className="space-y-3">
                {records.map((record) => (
                  <div key={record.id} className="rounded-lg bg-[#f8faff] px-3 py-3">
                    <p className="text-sm font-semibold text-[#071759]">
                      {academicRecordTitle(record.degreeType, record.qualificationName)}
                    </p>
                    <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      <Field label="Board / Institution" value={record.boardOrInstitution} />
                      <Field label="Roll number" value={record.rollNumber} />
                      <Field label="Passing year" value={record.passingYear} />
                      <Field
                        label="Marks / GPA"
                        value={`${record.marksOrGpaObtained} / ${record.marksOrGpaTotal}`}
                      />
                    </div>
                    {record.documents?.length ? (
                      <ul className="mt-3 space-y-2">
                        {record.documents.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#e4e9f4] bg-white px-3 py-2"
                          >
                            <span className="text-xs text-[#354a8d]">
                              <span className="font-semibold text-[#071759]">
                                {doc.documentType}
                              </span>
                              {doc.originalFileName ? ` · ${doc.originalFileName}` : ''}
                            </span>
                            {doc.downloadUrl ? (
                              <a
                                href={doc.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-medium text-[#0c3cff] underline-offset-2 hover:underline"
                              >
                                View file
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-[#6374ab]">No supporting files uploaded.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Declarations">
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
                    className="rounded-lg bg-[#f8faff] px-3 py-2 text-sm text-[#354a8d]"
                  >
                    {text.declarationText}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
