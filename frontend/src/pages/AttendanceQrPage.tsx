import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/client'
import {
  markAttendance,
  scanAttendanceQr,
  type AdmitCardSnapshot,
  type AttendanceRecord,
} from '@/lib/api/entry-test'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-900">
        {value?.trim() ? value : '—'}
      </p>
    </div>
  )
}

export function AttendanceQrPage() {
  const { qrToken = '' } = useParams()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [card, setCard] = useState<AdmitCardSnapshot | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null)
  const [identityVerified, setIdentityVerified] = useState(true)
  const [failureReason, setFailureReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)

  useEffect(() => {
    if (!qrToken) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await scanAttendanceQr(qrToken)
        if (cancelled) return
        setScanStatus(data.scanStatus ?? null)
        setCard(data.card)
        setAttendance(data.attendance)
      } catch (err) {
        if (cancelled) return
        setCard(null)
        setAttendance(null)
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Unable to resolve this QR code.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [qrToken])

  const alreadyMarked =
    !!attendance &&
    ['PRESENT', 'ABSENT'].includes(attendance.attendanceStatus.toUpperCase())

  async function handleMark(status: 'PRESENT' | 'ABSENT') {
    if (!card?.applicantId) return
    setBusy(true)
    setActionError(null)
    setActionOk(null)
    try {
      const body =
        status === 'PRESENT'
          ? {
              attendanceStatus: status,
              identityVerified: true as const,
            }
          : identityVerified
            ? {
                attendanceStatus: status,
                identityVerified: true as const,
              }
            : {
                attendanceStatus: status,
                identityVerified: false as const,
                verificationFailureReason: failureReason.trim(),
              }

      if (status === 'ABSENT' && !identityVerified && !failureReason.trim()) {
        setActionError('Provide a reason when identity is not verified.')
        return
      }

      const row = await markAttendance(card.applicantId, body)
      setAttendance(row)
      setActionOk(`Marked ${status}.`)
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to mark attendance.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Entry test attendance
            </p>
            <h1 className="text-xl font-bold text-slate-900">QR check-in</h1>
          </div>
          <Link
            to="/intakes"
            className="text-sm font-medium text-[#0c3cff] hover:underline"
          >
            Admin home
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating QR…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white px-5 py-8 text-center">
            <XCircle className="mx-auto h-8 w-8 text-red-500" />
            <p className="mt-3 text-sm font-medium text-red-700">{error}</p>
            <p className="mt-2 text-xs text-slate-500">
              Staff must be signed in. Invalid, expired, or unpublished cards
              cannot be scanned.
            </p>
          </div>
        ) : card ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {card.applicantName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    App {card.applicationId}
                    {card.serialNumber ? ` · ${card.serialNumber}` : ''}
                  </p>
                </div>
                {scanStatus ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      scanStatus === 'ALREADY_ATTENDED'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {scanStatus === 'ALREADY_ATTENDED' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {scanStatus.replace(/_/g, ' ')}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Father / guardian" value={card.fatherGuardianName} />
                <Field label="Gender" value={card.gender} />
                <Field label="Intake" value={card.intakeSession} />
                <Field label="Venue" value={card.testVenue} />
                <Field label="Date" value={card.testDate} />
                <Field label="Room" value={card.room} />
                <Field label="Reporting" value={card.reportingTime} />
                <Field label="Test time" value={card.testTime} />
              </div>

              {card.programmeOptions?.length ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Programme preferences
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {card.programmeOptions.map((opt) => (
                      <li key={`${opt.programmeId}-${opt.preferenceOrder}`}>
                        {opt.preferenceOrder}. {opt.programmeCode} —{' '}
                        {opt.programmeName}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {card.photographDownloadUrl ? (
                <div className="mt-4">
                  <img
                    src={card.photographDownloadUrl}
                    alt={card.applicantName}
                    className="h-28 w-28 rounded-lg border border-slate-200 object-cover"
                  />
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-[#0c3cff]" />
                Mark attendance
              </h3>

              {attendance ? (
                <p className="mt-2 text-sm text-slate-600">
                  Status:{' '}
                  <span className="font-semibold text-slate-900">
                    {attendance.attendanceStatus}
                  </span>
                  {attendance.identityVerified != null
                    ? ` · Identity ${attendance.identityVerified ? 'verified' : 'failed'}`
                    : ''}
                  {attendance.scanCount
                    ? ` · Scans ${attendance.scanCount}`
                    : ''}
                </p>
              ) : null}

              {actionError ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </p>
              ) : null}
              {actionOk ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {actionOk}
                </p>
              ) : null}

              {alreadyMarked ? (
                <p className="mt-4 text-sm text-slate-500">
                  Attendance is already recorded for this applicant.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={identityVerified}
                      onChange={(e) => setIdentityVerified(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Identity verified against photo / CNIC
                  </label>
                  {!identityVerified ? (
                    <Input
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      placeholder="Reason identity could not be verified"
                      maxLength={500}
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busy || !identityVerified}
                      onClick={() => void handleMark('PRESENT')}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserRound className="h-4 w-4" />
                      )}
                      Mark PRESENT
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleMark('ABSENT')}
                    >
                      Mark ABSENT
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    PRESENT requires identity verification. Use ABSENT with a
                    reason if identity fails.
                  </p>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
