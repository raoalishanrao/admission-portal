import { apiGet } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type { ApplicantTestResult, PaginatedItems } from '@/lib/api/types'

function normalizeList<T>(data: PaginatedItems<T> | T[] | T | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && 'items' in data) {
    return Array.isArray(data.items) ? data.items : []
  }
  return [data]
}

export async function listApplicantResults() {
  const response = await apiGet<PaginatedItems<ApplicantTestResult> | ApplicantTestResult[]>(
    API_ENDPOINTS.applicantResults,
  )
  return normalizeList(response.data)
}
