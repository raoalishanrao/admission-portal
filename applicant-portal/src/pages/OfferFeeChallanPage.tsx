import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Printer, RefreshCw } from 'lucide-react'
import { OfferFeeChallanSheet } from '@/components/offer-fee/OfferFeeChallanSheet'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { getOfferFeeChallan } from '@/lib/api/offer-fee'
import type { OfferFeeChallan } from '@/lib/api/types'
import '@/components/offer-fee/offer-fee-challan.css'

export function OfferFeeChallanPage() {
  const { applicantId = '' } = useParams()
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [challan, setChallan] = useState<OfferFeeChallan | null>(null)

  async function load() {
    if (!applicantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getOfferFeeChallan(applicantId)
      setChallan(data)
    } catch (err) {
      setChallan(null)
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to load admission fee challan.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !applicantId) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when applicant/auth change
  }, [applicantId, isAuthenticated])

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: `/applications/${applicantId}/offer-fee/challan` }}
      />
    )
  }

  return (
    <div className="offer-fee-page min-h-[70vh] py-6 print:bg-white print:py-0">
      <div className="offer-fee-toolbar mx-auto mb-4 flex flex-wrap items-center justify-between gap-3 px-3">
        <div>
          <Link
            to="/offer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c3cff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to offer
          </Link>
          <h1 className="mt-2 text-xl font-bold text-[#071759]">
            Admission fee challan
          </h1>
          <p className="mt-1 text-sm text-[#6374ab]">
            Print (landscape) and deposit at the bank, then upload your receipt
            on the offer page to occupy your seat.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c9d4ef] bg-white px-4 text-sm font-medium text-[#071759]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!challan || loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc] disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="challan-sheet-wrap mx-auto max-w-[1100px] px-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#6374ab]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading challan…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white px-5 py-8 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <p className="mt-2 text-xs text-[#6374ab]">
              The admission challan is created automatically when admissions
              publishes your offer. If you just received an offer, try again
              shortly.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : challan ? (
          <OfferFeeChallanSheet challan={challan} />
        ) : null}
      </div>
    </div>
  )
}
