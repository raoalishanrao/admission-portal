import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import {
  getAcademicStep,
  getAddresses,
  getContacts,
  getDeclarationStep,
  getDeclarationTexts,
  getProfileStep,
  getProgrammeStep,
  submitApplication,
} from '@/lib/api/applications'
import { getApplicantOffering } from '@/lib/api/admissions'
import { degreeLevelLabel } from '@/lib/admissions-display'
import {
  ADDRESS_TYPE_OPTIONS,
  CONTACT_TYPE_OPTIONS,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  REFERRAL_OPTIONS,
  academicRecordTitle,
  domicileProvinceLabel,
  nationalityLabel,
  qualificationLevelLabel,
} from '@/lib/application-steps'
import type {
  AcademicRecordResponse,
  ApplicantOffering,
  ApplicationAddressResponse,
  ApplicationContactResponse,
  OfferingDeclarationText,
  ProfileStepResponse,
  QualificationLevel,
} from '@/lib/api/types'

type Props = {
  applicantId: string
  applicationReference?: string | null
  onBack: () => void
  onSubmitted: (payload: {
    applicationStatus: string
    submissionDate: string
    applicationReference?: string | null
  }) => void
}

function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
) {
  if (!value) return '—'
  return options.find(item => item.value === value)?.label ?? value
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function ReviewStep({ applicantId, applicationReference, onBack, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<QualificationLevel | null>(null)
  const [offerings, setOfferings] = useState<ApplicantOffering[]>([])
  const [records, setRecords] = useState<AcademicRecordResponse[]>([])
  const [profile, setProfile] = useState<ProfileStepResponse | null>(null)
  const [addresses, setAddresses] = useState<ApplicationAddressResponse[]>([])
  const [contacts, setContacts] = useState<ApplicationContactResponse[]>([])
  const [declarationTexts, setDeclarationTexts] = useState<OfferingDeclarationText[]>([])
  const [acceptedIds, setAcceptedIds] = useState<string[]>([])
  const [declarationOk, setDeclarationOk] = useState(false)
  const [noDeclarations, setNoDeclarations] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [programme, academic, profileData, addressList, contactList, declaration, texts] =
          await Promise.all([
            getProgrammeStep(applicantId),
            getAcademicStep(applicantId),
            getProfileStep(applicantId),
            getAddresses(applicantId).catch(() => []),
            getContacts(applicantId).catch(() => []),
            getDeclarationStep(applicantId).catch(() => null),
            getDeclarationTexts(applicantId).catch(() => []),
          ])
        if (cancelled) return

        setLevel(programme.qualificationLevel)
        setRecords(academic.records ?? [])
        setProfile(profileData)
        setAddresses(
          addressList.length > 0 ? addressList : (profileData.addresses ?? []),
        )
        setContacts(
          contactList.length > 0 ? contactList : (profileData.contacts ?? []),
        )
        setDeclarationTexts(Array.isArray(texts) ? texts : [])
        setAcceptedIds(declaration?.acceptedOfferingDeclarationIds ?? [])

        const noneConfigured = !texts || texts.length === 0
        setNoDeclarations(noneConfigured)
        const declarationsComplete =
          noneConfigured ||
          !!(declaration?.declarationStepSaved && declaration.declarationAccepted)
        setDeclarationOk(declarationsComplete)

        const sorted = [...programme.options].sort((a, b) => a.preferenceOrder - b.preferenceOrder)
        const offeringDetails = await Promise.all(
          sorted.map(option =>
            getApplicantOffering(option.programmeOfferingId).catch(() => null),
          ),
        )
        if (cancelled) return
        setOfferings(offeringDetails.filter(Boolean) as ApplicantOffering[])

        setReady(
          programme.programmeStepSaved &&
            academic.academicStepSaved &&
            profileData.profileStepSaved &&
            declarationsComplete,
        )
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load review summary.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [applicantId])

  async function handleSubmit() {
    if (
      !profile?.profilePhotographDownloadUrl &&
      !profile?.profilePhotograph
    ) {
      setError('Profile photograph is required. Go back to Personal Information to upload one.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitApplication(applicantId)

      onSubmitted({
        applicationStatus: result.applicationStatus,
        submissionDate: result.submissionDate,
        applicationReference,
      })
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to submit application.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#6374ab]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Preparing review...
      </div>
    )
  }

  const acceptedTexts = declarationTexts.filter(text => acceptedIds.includes(text.id))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#071759]">Review & Submit</h2>
        <p className="mt-1 text-sm text-[#354a8d]">
          Confirm your full application details, then submit for admissions review.
        </p>
      </div>

      <div className="space-y-4">
        <SummaryCard title="Personal Profile">
          {profile ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start gap-4">
                {profile.profilePhotographDownloadUrl || profile.profilePhotograph ? (
                  <img
                    src={
                      profile.profilePhotographDownloadUrl ||
                      profile.profilePhotograph ||
                      undefined
                    }
                    alt={profile.applicantName}
                    className="h-24 w-24 rounded-xl border border-[#e4e9f4] object-cover"
                  />
                ) : (
                  <div className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-[#fecaca] bg-[#fef2f2] px-2 text-center text-[11px] font-medium text-[#b91c1c]">
                    Photo missing
                  </div>
                )}
                <div className="grid flex-1 gap-x-6 gap-y-2 sm:grid-cols-2">
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
                    label="Primary nationality"
                    value={nationalityLabel(profile.primaryNationalityId)}
                  />
                  <Field
                    label="Secondary nationality"
                    value={nationalityLabel(profile.secondaryNationalityId)}
                  />
                  <Field label="Domicile" value={domicileProvinceLabel(profile.domicileId)} />
                  <Field
                    label="Disability declared"
                    value={profile.disabilityDeclared ? 'Yes' : 'No'}
                  />
                  <Field
                    label="Referral source"
                    value={optionLabel(REFERRAL_OPTIONS, profile.referralSource)}
                  />
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6374ab]">
                  Addresses
                </h4>
                {addresses.length === 0 ? (
                  <p className="text-sm text-[#6374ab]">No addresses saved.</p>
                ) : (
                  <div className="space-y-2">
                    {addresses.map(address => (
                      <AddressBlock key={address.id} address={address} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6374ab]">
                  Contacts
                </h4>
                {contacts.length === 0 ? (
                  <p className="text-sm text-[#6374ab]">No contacts saved.</p>
                ) : (
                  <div className="space-y-2">
                    {contacts.map(contact => (
                      <ContactBlock key={contact.id} contact={contact} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6374ab]">Profile not saved yet.</p>
          )}
        </SummaryCard>

        <SummaryCard title="Programme Selection">
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
                    {offering.programme.code} · {degreeLevelLabel(offering.programme.degreeLevel)}
                    {offering.programme.programmeGrouping
                      ? ` · ${offering.programme.programmeGrouping}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SummaryCard>

        <SummaryCard title="Academic Details">
          {records.length === 0 ? (
            <p className="text-sm text-[#6374ab]">No academic records saved.</p>
          ) : (
            <div className="space-y-3">
              {records.map(record => (
                <div key={record.id} className="rounded-lg bg-[#f8faff] px-3 py-3">
                  <p className="text-sm font-semibold text-[#071759]">
                    {academicRecordTitle(record.degreeType, record.qualificationName)}
                  </p>
                  <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    <Field label="Board / Institution" value={record.boardOrInstitution} />
                    <Field label="Roll number" value={record.rollNumber} />
                    <Field label="Passing year" value={record.passingYear} />
                    <Field label="Division" value={record.division} />
                    <Field label="Grade" value={record.grade} />
                    <Field
                      label="Marks / GPA"
                      value={`${record.marksOrGpaObtained} / ${record.marksOrGpaTotal}`}
                    />
                    <Field
                      label="Percentage"
                      value={
                        record.percentage != null ? `${record.percentage}%` : null
                      }
                    />
                  </div>
                  {record.documents?.length ? (
                    <p className="mt-2 text-xs text-[#6374ab]">
                      Documents:{' '}
                      {record.documents
                        .map(
                          doc =>
                            doc.originalFileName ||
                            doc.documentType.toLowerCase(),
                        )
                        .join(', ')}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SummaryCard>

        <SummaryCard title="Declarations">
          <p className="mb-3 inline-flex items-center gap-2 text-sm text-[#354a8d]">
            {declarationOk ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[#16a34a]" />
                {noDeclarations
                  ? 'No declarations required for this programme'
                  : 'Required declarations accepted'}
              </>
            ) : (
              'Declarations incomplete'
            )}
          </p>
          {!noDeclarations && acceptedTexts.length > 0 ? (
            <ul className="space-y-2">
              {acceptedTexts.map(text => (
                <li
                  key={text.id}
                  className="rounded-lg bg-[#f8faff] px-3 py-2 text-sm text-[#354a8d]"
                >
                  {text.declarationText}
                </li>
              ))}
            </ul>
          ) : null}
        </SummaryCard>
      </div>

      {!ready ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Complete all previous steps before submitting your application.
        </p>
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" className="h-11 border-[#dce5f6]" onClick={onBack}>
          Previous
        </Button>
        <Button
          type="button"
          disabled={submitting || !ready}
          onClick={() => void handleSubmit()}
          className="h-11 bg-[#0c3cff] px-5 hover:bg-[#0934dc]"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Application'
          )}
        </Button>
      </div>
    </div>
  )
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e4e9f4] bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#071759]">{title}</h3>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <p className="text-sm text-[#354a8d]">
      <span className="text-[#6374ab]">{label}: </span>
      <span className="font-medium text-[#071759]">{value || '—'}</span>
    </p>
  )
}

function AddressBlock({ address }: { address: ApplicationAddressResponse }) {
  const line = [address.addressLine1, address.addressLine2].filter(Boolean).join(', ')
  return (
    <div className="rounded-lg bg-[#f8faff] px-3 py-2 text-sm">
      <p className="font-medium text-[#071759]">
        {optionLabel(ADDRESS_TYPE_OPTIONS, address.addressType)}
      </p>
      <p className="mt-1 text-[#354a8d]">{line || '—'}</p>
      <p className="mt-0.5 text-xs text-[#6374ab]">
        {[address.cityId, address.provinceId, address.countryId, address.postalCode]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  )
}

function ContactBlock({ contact }: { contact: ApplicationContactResponse }) {
  return (
    <div className="rounded-lg bg-[#f8faff] px-3 py-2 text-sm">
      <p className="font-medium text-[#071759]">
        {optionLabel(CONTACT_TYPE_OPTIONS, contact.contactType)} · {contact.name}
      </p>
      <div className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
        <Field label="Relationship" value={contact.relationship} />
        <Field label="Mobile" value={contact.mobileNumber} />
        <Field label="Occupation" value={contact.occupation} />
        <Field label="Email" value={contact.email} />
        <Field label="ID number" value={contact.identityDocumentNumber} />
        <Field label="Address" value={contact.addressLine} />
      </div>
    </div>
  )
}
