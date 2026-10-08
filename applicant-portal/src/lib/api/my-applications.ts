import { apiGet } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type { ApplicantOwnedApplication, PaginatedItems } from '@/lib/api/types'

function normalizeList<T>(data: PaginatedItems<T> | T[] | T | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && 'items' in data) {
    return Array.isArray(data.items) ? data.items : []
  }
  return [data]
}

export async function listMyApplications() {
  const response = await apiGet<
    PaginatedItems<ApplicantOwnedApplication> | ApplicantOwnedApplication[]
  >(API_ENDPOINTS.applicantApplicationsMine)
  return normalizeList(response.data)
}
