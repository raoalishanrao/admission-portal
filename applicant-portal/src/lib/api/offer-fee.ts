import { apiGet, apiUpload } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type { OfferFeeChallan, OfferFeeEvidence } from '@/lib/api/types'

export async function getOfferFeeChallan(applicantId: string) {
  const response = await apiGet<OfferFeeChallan>(
    API_ENDPOINTS.applicantOfferFeeChallan(applicantId),
  )
  return response.data
}

export async function uploadOfferFeeEvidence(
  applicantId: string,
  file: File,
  amountClaimed?: number,
) {
  const formData = new FormData()
  formData.append('file', file)
  if (amountClaimed != null && Number.isFinite(amountClaimed)) {
    formData.append('amountClaimed', String(amountClaimed))
  }
  const response = await apiUpload<OfferFeeEvidence>(
    API_ENDPOINTS.applicantOfferFeeEvidence(applicantId),
    formData,
  )
  return response.data
}
