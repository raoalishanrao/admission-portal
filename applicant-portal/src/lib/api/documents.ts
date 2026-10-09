import { apiGet, apiUpload } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type {
  AdmissionDocument,
  ApplicantDocumentRequirement,
  DocumentCompleteness,
  PaginatedItems,
} from '@/lib/api/types'

function normalizeList<T>(data: PaginatedItems<T> | T[] | T | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && 'items' in data) {
    return Array.isArray(data.items) ? data.items : []
  }
  return [data]
}

export async function getDocumentRequirements(applicantId: string) {
  const response = await apiGet<
    PaginatedItems<ApplicantDocumentRequirement> | ApplicantDocumentRequirement[]
  >(API_ENDPOINTS.applicantDocumentRequirements(applicantId))
  return normalizeList(response.data)
}

export async function getDocumentCompleteness(applicantId: string) {
  const response = await apiGet<DocumentCompleteness>(
    API_ENDPOINTS.applicantDocumentCompleteness(applicantId),
  )
  return response.data
}

export async function listApplicantDocuments(applicantId: string) {
  const response = await apiGet<PaginatedItems<AdmissionDocument> | AdmissionDocument[]>(
    API_ENDPOINTS.applicantDocuments(applicantId),
  )
  return normalizeList(response.data)
}

/** F004 — upload a file against offering required-document slot(s). */
export async function uploadApplicantDocument(
  applicantId: string,
  file: File,
  offeringRequiredDocumentIds: string[],
) {
  const formData = new FormData()
  formData.append('file', file)
  for (const id of offeringRequiredDocumentIds) {
    formData.append('offeringRequiredDocumentIds', id)
  }
  if (offeringRequiredDocumentIds[0]) {
    formData.append('offeringRequiredDocumentId', offeringRequiredDocumentIds[0])
  }
  const response = await apiUpload<AdmissionDocument[]>(
    API_ENDPOINTS.applicantDocuments(applicantId),
    formData,
  )
  return normalizeList(response.data)
}

/** F004 — replace an existing applicant document file. */
export async function replaceApplicantDocument(
  applicantId: string,
  documentId: string,
  file: File,
) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiUpload<AdmissionDocument[]>(
    API_ENDPOINTS.applicantDocumentReplace(applicantId, documentId),
    formData,
  )
  return normalizeList(response.data)
}
