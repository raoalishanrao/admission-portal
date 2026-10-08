import { apiGet } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type { AdmitCard } from '@/lib/api/types'

export async function getAdmitCard(applicantId: string) {
  const response = await apiGet<AdmitCard>(API_ENDPOINTS.applicantAdmitCard(applicantId))
  return response.data
}
