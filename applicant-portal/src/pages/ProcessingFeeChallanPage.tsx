import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Printer, RefreshCw } from 'lucide-react'
import { ProcessingFeeChallanSheet } from '@/components/processing-fee/ProcessingFeeChallanSheet'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { loadPrintableProcessingFeeChallan } from '@/lib/api/processing-fee'
import { submittedApplicationPath } from '@/lib/application-session'
import type { ProcessingFeePrintResponse } from '@/lib/api/types'
import '@/components/processing-fee/ProcessingFeeChallan.css'

export function ProcessingFeeChallanPage() {
  const { applicantId = '' } = useParams()
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ProcessingFeePrintResponse | null>(null)
  const backTo = submittedApplicationPath(applicantId)

  async function load() {
    if (!applicantId) return
    setLoading(true)
    setError(null)
    try {
      const printData = await loadPrintableProcessingFeeChallan(applicantId)
      setData(printData)
    } catch (err) {
      setData(null)
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to load processing fee challan.',
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
        state={{ from: `/applications/${applicantId}/processing-fee/challan` }}
      />
    )
  }

  return (
    <div className="min-h-[70vh] bg-[#f3f3f3] py-6 print:bg-white print:py-0">
      <div className="challan-toolbar mx-auto mb-4 flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-3">
        <div>
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c3cff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to application
          </Link>
          <h1 className="mt-2 text-xl font-bold text-[#071759]">Processing Fee Challan</h1>
          <p className="mt-1 text-sm text-[#6374ab]">
            Print all three copies and deposit cash at the designated bank branch.
            After payment, upload your receipt from{' '}
            <Link to={backTo} className="font-medium text-[#0c3cff] underline-offset-2 hover:underline">
              application details
            </Link>
            .
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
            disabled={!data || loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc] disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print Challan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#6374ab]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing challan...
        </div>
      ) : error ? (
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white px-5 py-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white"
          >
            Try again
          </button>
        </div>
      ) : data ? (
        <ProcessingFeeChallanSheet data={data} />
      ) : null}
    </div>
  )
}
