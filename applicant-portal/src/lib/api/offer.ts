import { getApplicantOffering } from '@/lib/api/admissions'
import { ApiError, apiGet } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type {
  AdmissionOffer,
  ApplicantOffering,
  OfferFeeChallan,
  OfferFeeEvidence,
} from '@/lib/api/types'

type RawOffer = Record<string, unknown>

function pickString(row: RawOffer, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}

function normalizeOffer(raw: RawOffer | AdmissionOffer): AdmissionOffer {
  const row = raw as RawOffer
  return {
    id: pickString(row, 'id'),
    applicationRecordId: pickString(row, 'applicationRecordId', 'application_record_id'),
    programmeOfferingId: pickString(row, 'programmeOfferingId', 'programme_offering_id'),
    offerType: pickString(row, 'offerType', 'offer_type') || 'REGULAR',
    offerConditions: pickString(row, 'offerConditions', 'offer_conditions') || null,
    offerIssueDate: pickString(row, 'offerIssueDate', 'offer_issue_date') || null,
    acceptanceDeadline: pickString(row, 'acceptanceDeadline', 'acceptance_deadline') || null,
    feePaymentInstructions:
      pickString(row, 'feePaymentInstructions', 'fee_payment_instructions') || null,
    offerLetterDocument: pickString(row, 'offerLetterDocument', 'offer_letter_document') || null,
    status: pickString(row, 'status') || 'PUBLISHED',
    publishedAt: pickString(row, 'publishedAt', 'published_at') || null,
    feeChallanId: pickString(row, 'feeChallanId', 'fee_challan_id') || null,
  }
}

function asChallan(value: unknown): OfferFeeChallan | null {
  if (!value || typeof value !== 'object') return null
  const row = value as OfferFeeChallan
  if (!row.id || !row.challanNumber) return null
  return row
}

function asEvidence(value: unknown): OfferFeeEvidence | null {
  if (!value || typeof value !== 'object') return null
  const row = value as OfferFeeEvidence
  if (!row.id || !row.challanId) return null
  return row
}

export async function getApplicantOffer() {
  const response = await apiGet<RawOffer>(API_ENDPOINTS.applicantOffer)
  const raw = response.data as RawOffer
  return {
    offer: normalizeOffer(raw),
    feeChallan: asChallan(raw.feeChallan ?? raw.fee_challan),
    currentEvidence: asEvidence(raw.currentEvidence ?? raw.current_evidence),
  }
}

export type ApplicantOfferView = AdmissionOffer & {
  offering: ApplicantOffering | null
  feeChallan: OfferFeeChallan | null
  currentEvidence: OfferFeeEvidence | null
}

/** Load published offer, fee challan, evidence, and programme name. */
export async function getApplicantOfferView(): Promise<ApplicantOfferView | null> {
  try {
    const { offer, feeChallan, currentEvidence } = await getApplicantOffer()
    let offering: ApplicantOffering | null = null
    if (offer.programmeOfferingId) {
      offering = await getApplicantOffering(offer.programmeOfferingId).catch(() => null)
    }
    return { ...offer, offering, feeChallan, currentEvidence }
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) return null
    throw err
  }
}
