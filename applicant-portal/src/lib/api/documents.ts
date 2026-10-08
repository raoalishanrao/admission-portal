import { ApiError, apiGet, apiPost, apiUpload } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type {
  AcademicDocumentType,
  AdmissionDocument,
  ApplicantDocumentRequirement,
  DocumentCompleteness,
  PaginatedItems,
} from '@/lib/api/types'

export function academicDocumentMatchesRequirementCode(
  documentType: AcademicDocumentType,
  code: string,
) {
  const value = code.toUpperCase()
  if (documentType === 'TRANSCRIPT') return value === 'TRANSCRIPT'
  if (documentType === 'CERTIFICATE') {
    return value.endsWith('_CERTIFICATE') || value === 'EQUIVALENCE_CERTIFICATE'
  }
  return value.endsWith('_MARKSHEET')
}

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

export async function linkAcademicDocument(
  applicantId: string,
  academicDocumentId: string,
  offeringRequiredDocumentIds: string[],
) {
  const response = await apiPost<
    AdmissionDocument[],
    {
      academicDocumentId: string
      offeringRequiredDocumentIds: string[]
    }
  >(API_ENDPOINTS.applicantDocumentLinkAcademic(applicantId), {
    academicDocumentId,
    offeringRequiredDocumentIds,
  })
  return normalizeList(response.data)
}

/**
 * Link each open academic requirement to a matching F002 academic file via
 * POST …/documents/link-academic. Returns how many requirement groups were linked.
 */
export async function autoLinkMatchingAcademicDocuments(
  applicantId: string,
  academicDocuments: Array<{ id: string; documentType: AcademicDocumentType }>,
  requirements: ApplicantDocumentRequirement[],
) {
  const open = requirements.filter(
    (req) =>
      req.status === 'NOT_SUBMITTED' || req.status === 'RESUBMISSION_REQUIRED',
  )
  if (open.length === 0 || academicDocuments.length === 0) return 0

  const seenGroups = new Set<string>()
  const usedDocIds = new Set<string>()
  let linkedCount = 0

  for (const req of open) {
    const ids =
      req.offeringRequiredDocumentIds?.length > 0
        ? req.offeringRequiredDocumentIds
        : [req.offeringRequiredDocumentId]
    const groupKey = [...ids].sort().join(',')
    if (seenGroups.has(groupKey)) continue
    seenGroups.add(groupKey)

    const match = academicDocuments.find(
      (doc) =>
        !usedDocIds.has(doc.id) &&
        academicDocumentMatchesRequirementCode(
          doc.documentType,
          req.documentTypeCode,
        ),
    )
    if (!match) continue

    try {
      await linkAcademicDocument(applicantId, match.id, ids)
      usedDocIds.add(match.id)
      linkedCount += 1
    } catch (err) {
      // Skip non-academic / already-submitted / incompatible rows.
      if (
        err instanceof ApiError &&
        (err.code === 'DOCUMENT_CATEGORY_MISMATCH' ||
          err.code === 'DOCUMENT_TYPE_MISMATCH' ||
          err.statusCode === 409)
      ) {
        continue
      }
    }
  }

  return linkedCount
}
