import { ApiError, apiGet, apiPost, apiUpload } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'
import type {
  CreateOnlinePaymentRequest,
  OnlinePayment,
  PaginatedItems,
  PaymentEvidence,
  ProcessingFeeChallan,
  ProcessingFeePrintResponse,
  ProcessingFeeStatusResponse,
} from '@/lib/api/types'

function normalizeList<T>(data: PaginatedItems<T> | T[] | T | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'object' && 'items' in data) {
    return Array.isArray(data.items) ? data.items : []
  }
  return [data]
}

export async function generateProcessingFeeChallan(applicantId: string) {
  const response = await apiPost<ProcessingFeeChallan>(
    API_ENDPOINTS.processingFeeChallan(applicantId),
    {},
  )
  return response.data
}

export async function getProcessingFeeChallan(applicantId: string) {
  const response = await apiGet<ProcessingFeeChallan>(
    API_ENDPOINTS.processingFeeChallan(applicantId),
  )
  return response.data
}

export async function getProcessingFeeChallanPrint(applicantId: string) {
  const response = await apiGet<ProcessingFeePrintResponse>(
    API_ENDPOINTS.processingFeeChallanPrint(applicantId),
  )
  return response.data
}

export async function getProcessingFeeStatus(applicantId: string) {
  const response = await apiGet<ProcessingFeeStatusResponse>(
    API_ENDPOINTS.processingFeeStatus(applicantId),
  )
  return response.data
}

/** Ensure a challan exists (idempotent generate), then return three-copy print payload. */
export async function loadPrintableProcessingFeeChallan(applicantId: string) {
  try {
    return await getProcessingFeeChallanPrint(applicantId)
  } catch (err) {
    if (!(err instanceof ApiError) || err.statusCode !== 404) throw err
    await generateProcessingFeeChallan(applicantId)
    return getProcessingFeeChallanPrint(applicantId)
  }
}

export async function listPaymentEvidence(applicantId: string) {
  const response = await apiGet<PaginatedItems<PaymentEvidence> | PaymentEvidence[]>(
    API_ENDPOINTS.processingFeeEvidence(applicantId),
  )
  return normalizeList(response.data)
}

export async function uploadPaymentEvidence(
  applicantId: string,
  file: File,
  onlinePaymentTransactionId?: string,
) {
  const formData = new FormData()
  formData.append('file', file)
  if (onlinePaymentTransactionId) {
    formData.append('onlinePaymentTransactionId', onlinePaymentTransactionId)
  }
  const response = await apiUpload<PaymentEvidence | PaymentEvidence[]>(
    API_ENDPOINTS.processingFeeEvidence(applicantId),
    formData,
  )
  const data = response.data
  return Array.isArray(data) ? data[0] : data
}

export async function createOnlinePayment(
  applicantId: string,
  body: CreateOnlinePaymentRequest,
) {
  const response = await apiPost<OnlinePayment, CreateOnlinePaymentRequest>(
    API_ENDPOINTS.processingFeeOnlinePayment(applicantId),
    body,
  )
  return response.data
}

export async function getOnlinePaymentStatus(applicantId: string) {
  const response = await apiGet<OnlinePayment>(
    API_ENDPOINTS.processingFeeOnlinePaymentStatus(applicantId),
  )
  return response.data
}
