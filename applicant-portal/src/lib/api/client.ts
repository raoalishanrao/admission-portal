import { getAccessToken } from '@/lib/auth'
import { API_BASE_URL } from '@/lib/config'
import type { ApiErrorResponse, ApiSuccessResponse } from '@/lib/api/types'

export class ApiError extends Error {
  statusCode: number
  code: string
  details: unknown

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

function buildUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function formatErrorMessage(message: ApiErrorResponse['message']) {
  return Array.isArray(message) ? message.join(', ') : message
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = false, headers, ...rest } = options
  const requestHeaders = new Headers(headers)

  if (!requestHeaders.has('Content-Type') && rest.body) {
    requestHeaders.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = getAccessToken()
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  // ngrok free interstitial breaks JSON API calls from the browser without this.
  if (
    /ngrok(-free)?\.(app|io)/i.test(API_BASE_URL) &&
    !requestHeaders.has('ngrok-skip-browser-warning')
  ) {
    requestHeaders.set('ngrok-skip-browser-warning', 'true')
  }

  const method = (rest.method ?? 'GET').toUpperCase()
  const maxAttempts = method === 'GET' ? 2 : 1
  let lastError: ApiError | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(buildUrl(path), {
      ...rest,
      headers: requestHeaders,
    })

    const payload = await response.json().catch(() => null)

    if (response.ok) {
      return payload as T
    }

    const error = payload as ApiErrorResponse | null
    lastError = new ApiError(
      error ? formatErrorMessage(error.message) : 'Request failed. Please try again.',
      error?.statusCode ?? response.status,
      error?.code ?? 'REQUEST_FAILED',
      payload,
    )

    // Transient DB/proxy blips on public catalogue reads — retry once.
    const retryable =
      method === 'GET' &&
      attempt < maxAttempts &&
      (lastError.statusCode >= 500 || lastError.statusCode === 0)
    if (!retryable) break
    await new Promise(resolve => setTimeout(resolve, 350))
  }

  throw lastError ?? new ApiError('Request failed. Please try again.', 500, 'REQUEST_FAILED')
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function apiGet<TResponse>(
  path: string,
  params?: Record<string, string | number | undefined>,
  options: Omit<RequestInit, 'method'> & { auth?: boolean } = {},
) {
  return apiRequest<ApiSuccessResponse<TResponse>>(`${path}${buildQuery(params)}`, {
    ...options,
    method: 'GET',
    auth: options.auth ?? true,
  })
}

export async function apiPost<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {},
) {
  return apiRequest<ApiSuccessResponse<TResponse>>(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
    auth: options.auth ?? true,
  })
}

export async function apiPut<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {},
) {
  return apiRequest<ApiSuccessResponse<TResponse>>(path, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
    auth: options.auth ?? true,
  })
}

export async function apiPatch<TResponse, TBody = unknown>(
  path: string,
  body: TBody,
  options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {},
) {
  return apiRequest<ApiSuccessResponse<TResponse>>(path, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
    auth: options.auth ?? true,
  })
}

export async function apiDelete<TResponse = void>(
  path: string,
  options: Omit<RequestInit, 'method'> & { auth?: boolean } = {},
) {
  return apiRequest<ApiSuccessResponse<TResponse>>(path, {
    ...options,
    method: 'DELETE',
    auth: options.auth ?? true,
  })
}

/** Multipart upload — do not set Content-Type so the browser can attach the boundary. */
export async function apiUpload<TResponse>(
  path: string,
  formData: FormData,
  options: Omit<RequestInit, 'body' | 'method'> & { auth?: boolean } = {},
) {
  const { auth = true, headers, ...rest } = options
  const requestHeaders = new Headers(headers)

  if (auth) {
    const token = getAccessToken()
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`)
    }
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    method: 'POST',
    body: formData,
    headers: requestHeaders,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = payload as ApiErrorResponse | null
    throw new ApiError(
      error ? formatErrorMessage(error.message) : 'Upload failed. Please try again.',
      error?.statusCode ?? response.status,
      error?.code ?? 'UPLOAD_FAILED',
      payload,
    )
  }

  return payload as ApiSuccessResponse<TResponse>
}
