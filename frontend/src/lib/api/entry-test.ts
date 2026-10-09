import { apiGet, apiPost } from '@/lib/api/client'
import { API_ENDPOINTS } from '@/lib/config'

export type AdmitCardSnapshot = {
  id: string
  applicantId: string
  applicationId: string
  serialNumber?: string
  intakeSession: string
  applicantName: string
  fatherGuardianName: string
  gender: string
  photographDownloadUrl?: string | null
  programmeOptions: Array<{
    preferenceOrder: number
    programmeId: string
    programmeCode: string
    programmeName: string
  }>
  testSessionId?: string
  testVenue: string
  testDate: string
  reportingTime: string
  testTime: string
  room: string
  issueDate: string
  instructions: string
  status: string
  qrUrl?: string
  publishedAt?: string
}

export type AttendanceRecord = {
  id: string
  applicationId: string
  attendanceStatus: string
  identityVerified: boolean | null
  verificationFailureReason: string | null
  scanCount: number
  firstScannedAt: string | null
  lastScannedAt: string | null
  markedBy: string | null
  markedAt: string | null
  resultAwaitedAt: string | null
}

export type AttendanceQrPayload = {
  scanStatus?: string
  card: AdmitCardSnapshot
  attendance: AttendanceRecord | null
}

export type MarkAttendanceBody = {
  attendanceStatus: 'PRESENT' | 'ABSENT'
  identityVerified?: boolean
  verificationFailureReason?: string
}

export async function scanAttendanceQr(qrToken: string) {
  const response = await apiPost<AttendanceQrPayload>(
    API_ENDPOINTS.attendanceQrScan(qrToken),
    {},
  )
  return response.data
}

export async function resolveAttendanceQr(qrToken: string) {
  const response = await apiGet<AttendanceQrPayload>(
    API_ENDPOINTS.attendanceQr(qrToken),
  )
  return response.data
}

export async function markAttendance(
  applicantId: string,
  body: MarkAttendanceBody,
) {
  const response = await apiPost<AttendanceRecord, MarkAttendanceBody>(
    API_ENDPOINTS.markAttendance(applicantId),
    body,
  )
  return response.data
}
