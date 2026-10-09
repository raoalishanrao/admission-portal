import { useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileUp,
  Loader2,
  Upload,
} from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import { uploadPaymentEvidence } from '@/lib/api/processing-fee'
import type { PaymentEvidence } from '@/lib/api/types'

type Props = {
  applicantId: string
  evidence: PaymentEvidence[]
  paymentStatus?: string | null
  onlinePaymentTransactionId?: string | null
  /** Flatten chrome when nested inside another card */
  embedded?: boolean
  /** Start expanded (default: open only when upload still needed) */
  defaultOpen?: boolean
  onChanged: () => Promise<void> | void
}

function verificationStyles(indicator: string) {
  const value = indicator.toUpperCase()
  if (value === 'VERIFIED') return 'bg-[#dcfce7] text-[#166534]'
  if (value === 'REJECTED') return 'bg-[#fee2e2] text-[#b91c1c]'
  return 'bg-[#fff7ed] text-[#c2410c]'
}

function verificationLabel(indicator: string) {
  const value = indicator.toUpperCase()
  if (value === 'VERIFIED') return 'Verified'
  if (value === 'REJECTED') return 'Rejected — re-upload'
  return 'Pending review'
}

function formatUploadDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function PaymentEvidencePanel({
  applicantId,
  evidence,
  paymentStatus,
  onlinePaymentTransactionId,
  embedded = false,
  defaultOpen,
  onChanged,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const current = evidence.find((row) => row.isCurrent) ?? evidence[0] ?? null
  const verified = current?.verificationIndicator?.toUpperCase() === 'VERIFIED'
  const paid =
    (paymentStatus || '').toUpperCase() === 'PAID' ||
    (paymentStatus || '').toUpperCase().includes('VERIFIED')
  const canUpload = !verified && !paid
  const [open, setOpen] = useState(defaultOpen ?? canUpload)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await uploadPaymentEvidence(
        applicantId,
        file,
        onlinePaymentTransactionId || undefined,
      )
      await onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to upload payment evidence.',
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section
      className={
        embedded
          ? 'rounded-xl bg-[#f8faff] ring-1 ring-[#e4e9f4]'
          : 'rounded-xl border border-[#e4e9f4] bg-white'
      }
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#071759]">
            Payment evidence
          </p>
          <p className="mt-0.5 text-xs text-[#6374ab]">
            {current
              ? `${verificationLabel(current.verificationIndicator)} · ${current.fileFormat?.toUpperCase() || 'File'}`
              : 'Upload bank / wallet receipt after payment'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {current ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${verificationStyles(current.verificationIndicator)}`}
            >
              {verified ? <CheckCircle2 className="h-3 w-3" /> : null}
              {verificationLabel(current.verificationIndicator)}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-[#6374ab] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open ? (
        <div className="border-t border-[#e4e9f4] px-4 py-4">
          <p className="text-sm text-[#6374ab]">
            After paying (bank challan or online), upload a clear photo or PDF of
            the receipt. You can replace it until admissions verifies the
            payment.
            {onlinePaymentTransactionId
              ? ' This upload will be linked to your recorded online payment.'
              : ''}
          </p>

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-4 space-y-3">
            {evidence.length === 0 ? (
              <p className="text-sm text-[#6374ab]">
                No payment evidence uploaded yet.
              </p>
            ) : (
              evidence.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3 py-3 ring-1 ring-[#e4e9f4]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#071759]">
                      {row.fileFormat?.toUpperCase() || 'File'} ·{' '}
                      {row.evidenceSource?.replace(/_/g, ' ') || 'Bank receipt'}
                      {row.isCurrent ? (
                        <span className="ml-2 text-xs font-semibold text-[#0c3cff]">
                          Current
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6374ab]">
                      Uploaded {formatUploadDate(row.uploadDate)} ·{' '}
                      {verificationLabel(row.verificationIndicator)}
                    </p>
                  </div>
                  {row.downloadUrl ? (
                    <a
                      href={row.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c9d4ef] bg-white px-3 text-xs font-medium text-[#071759]"
                    >
                      View file
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {canUpload ? (
            <div className="mt-4">
              <input
                ref={inputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.bmp,.pdf,image/*,application/pdf"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : evidence.length > 0 ? (
                  <Upload className="h-4 w-4" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {busy
                  ? 'Uploading…'
                  : evidence.length > 0
                    ? 'Replace evidence'
                    : 'Upload receipt'}
              </button>
              <p className="mt-2 text-xs text-[#6374ab]">
                JPG, PNG, GIF, BMP or PDF · max 10 MB
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
