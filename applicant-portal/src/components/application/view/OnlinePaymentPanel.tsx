import { useEffect, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Smartphone,
} from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import {
  createOnlinePayment,
  getOnlinePaymentStatus,
} from '@/lib/api/processing-fee'
import type {
  OnlinePayment,
  OnlinePaymentMethod,
  ProcessingFeeChallan,
} from '@/lib/api/types'

type Props = {
  applicantId: string
  challan: ProcessingFeeChallan | null
  paymentStatus?: string | null
  /** Flatten chrome when nested inside another card */
  embedded?: boolean
  /** Start expanded (default: open only when payment still needed) */
  defaultOpen?: boolean
  onChanged: () => Promise<void> | void
  onPaymentChanged?: (payment: OnlinePayment | null) => void
}

function statusStyles(status: string) {
  const value = status.toUpperCase()
  if (value === 'SUCCESS') return 'bg-[#dcfce7] text-[#166534]'
  if (value === 'FAILED') return 'bg-[#fee2e2] text-[#b91c1c]'
  if (value === 'PENDING' || value === 'INITIATED')
    return 'bg-[#fff7ed] text-[#c2410c]'
  return 'bg-[#f1f5f9] text-[#475569]'
}

function challanCurrency(challan: ProcessingFeeChallan | null) {
  return (challan?.items?.[0]?.currency || 'PKR').toUpperCase()
}

function challanAmount(challan: ProcessingFeeChallan | null) {
  if (!challan?.totalAmountPayable) return 0
  const n = Number(challan.totalAmountPayable)
  return Number.isFinite(n) ? n : 0
}

export function OnlinePaymentPanel({
  applicantId,
  challan,
  paymentStatus,
  embedded = false,
  defaultOpen,
  onChanged,
  onPaymentChanged,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payment, setPayment] = useState<OnlinePayment | null>(null)

  const paidHint =
    (paymentStatus || '').toUpperCase() === 'PAID' ||
    (paymentStatus || '').toUpperCase().includes('VERIFIED')
  // Open by default only while payment is still outstanding
  const [open, setOpen] = useState(defaultOpen ?? !paidHint)

  const [paymentMethod, setPaymentMethod] =
    useState<OnlinePaymentMethod>('WALLET')
  const [transactionReference, setTransactionReference] = useState('')
  const [senderName, setSenderName] = useState('')
  const [providerCode, setProviderCode] = useState('')
  const [notes, setNotes] = useState('')

  const paid = paidHint
  const currency = challanCurrency(challan)
  const amount = challanAmount(challan)
  const canSubmit =
    !!challan &&
    !paid &&
    amount > 0 &&
    (!payment || payment.status.toUpperCase() === 'FAILED')

  async function loadStatus() {
    setLoading(true)
    setError(null)
    try {
      const row = await getOnlinePaymentStatus(applicantId)
      setPayment(row)
      onPaymentChanged?.(row)
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setPayment(null)
        onPaymentChanged?.(null)
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Unable to load online payment status.',
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when applicant changes
  }, [applicantId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || !challan) return
    setBusy(true)
    setError(null)
    try {
      const row = await createOnlinePayment(applicantId, {
        paymentMethod,
        transactionReference: transactionReference.trim(),
        currency,
        amount,
        senderName: senderName.trim(),
        providerCode: providerCode.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      setPayment(row)
      onPaymentChanged?.(row)
      setTransactionReference('')
      setSenderName('')
      setProviderCode('')
      setNotes('')
      await onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to record online payment.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!challan) return null

  // Fee already verified with no online record — don't clutter the card
  if (paid && !payment) return null

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
          <p className="text-sm font-semibold text-[#071759]">Online payment</p>
          <p className="mt-0.5 text-xs text-[#6374ab]">
            {payment
              ? `${payment.status} · ${payment.transactionReference}`
              : 'Optional — wallet / JazzCash / EasyPaisa reference'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {payment ? (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles(payment.status)}`}
            >
              {payment.status}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 text-[#6374ab] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open ? (
        <div className="border-t border-[#e4e9f4] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-[#6374ab]">
              Already paid via wallet or mobile account? Record the provider
              transaction reference here. Card details are never collected.
            </p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={loading || busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c9d4ef] bg-white px-3 text-xs font-medium text-[#071759] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh status
            </button>
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#6374ab]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking online payment…
            </div>
          ) : payment ? (
            <div className="mt-4 rounded-lg bg-white px-4 py-3 ring-1 ring-[#e4e9f4]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#071759]">
                  {payment.paymentMethod.replace(/_/g, ' ')} ·{' '}
                  {payment.transactionReference}
                </p>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusStyles(payment.status)}`}
                >
                  {payment.status.toUpperCase() === 'SUCCESS' ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : null}
                  {payment.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6374ab]">
                {payment.currency} {Number(payment.amount).toLocaleString()} ·{' '}
                {payment.senderName}
                {payment.providerCode ? ` · ${payment.providerCode}` : ''}
              </p>
              {payment.receiptRequired ? (
                <p className="mt-2 text-xs text-[#354a8d]">
                  {payment.receiptUploaded
                    ? 'Receipt linked to this payment.'
                    : 'Upload your provider/bank receipt in Payment evidence below so admissions can verify.'}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#6374ab]">
              No online payment recorded yet. You can still pay at the bank with
              the printed challan and upload the bank receipt instead.
            </p>
          )}

          {canSubmit ? (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="mt-4 space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-xs font-medium text-[#6374ab]">
                    Method
                  </span>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as OnlinePaymentMethod)
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[#c9d4ef] bg-white px-3 text-sm text-[#071759]"
                  >
                    <option value="WALLET">Wallet</option>
                    <option value="MOBILE_ACCOUNT">Mobile account</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium text-[#6374ab]">
                    Provider (optional)
                  </span>
                  <input
                    value={providerCode}
                    onChange={(e) => setProviderCode(e.target.value)}
                    placeholder="e.g. JazzCash, EasyPaisa"
                    maxLength={60}
                    className="mt-1 h-10 w-full rounded-lg border border-[#c9d4ef] bg-white px-3 text-sm text-[#071759]"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-xs font-medium text-[#6374ab]">
                    Transaction reference
                  </span>
                  <input
                    required
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    placeholder="Reference from your payment confirmation"
                    maxLength={150}
                    className="mt-1 h-10 w-full rounded-lg border border-[#c9d4ef] bg-white px-3 text-sm text-[#071759]"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-xs font-medium text-[#6374ab]">
                    Sender name
                  </span>
                  <input
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Name on the wallet / mobile account"
                    maxLength={150}
                    className="mt-1 h-10 w-full rounded-lg border border-[#c9d4ef] bg-white px-3 text-sm text-[#071759]"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="text-xs font-medium text-[#6374ab]">
                    Notes (optional)
                  </span>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    className="mt-1 h-10 w-full rounded-lg border border-[#c9d4ef] bg-white px-3 text-sm text-[#071759]"
                  />
                </label>
              </div>
              <p className="text-xs text-[#6374ab]">
                Amount locked to challan: {currency} {amount.toLocaleString()}
              </p>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc] disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                {busy ? 'Saving…' : 'Record online payment'}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
