import { apiGet } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type {
  ApplicantMeritResult,
  ApplicantResultsPayload,
  ApplicantTestResult,
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

/** Supports new `{ entryTests, meritLists }` shape and legacy flat entry-test arrays. */
export async function listApplicantResults(): Promise<ApplicantResultsPayload> {
  const response = await apiGet<
    | ApplicantResultsPayload
    | PaginatedItems<ApplicantTestResult>
    | ApplicantTestResult[]
  >(API_ENDPOINTS.applicantResults)

  const data = response.data
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    ('entryTests' in data || 'meritLists' in data)
  ) {
    const payload = data as ApplicantResultsPayload
    return {
      entryTests: normalizeList(payload.entryTests),
      meritLists: normalizeList(payload.meritLists),
    }
  }

  return {
    entryTests: normalizeList(data as PaginatedItems<ApplicantTestResult> | ApplicantTestResult[]),
    meritLists: [] as ApplicantMeritResult[],
  }
}
