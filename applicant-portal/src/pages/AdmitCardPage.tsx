import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Printer, RefreshCw } from 'lucide-react'
import { AdmitCardSheet } from '@/components/admit-card/AdmitCardSheet'
import { useAuth } from '@/context/AuthContext'
import { getAdmitCard } from '@/lib/api/admit-card'
import { ApiError } from '@/lib/api/client'
import { submittedApplicationPath } from '@/lib/application-session'
import type { AdmitCard } from '@/lib/api/types'
import '@/components/admit-card/admit-card.css'

export function AdmitCardPage() {
  const { applicantId = '' } = useParams()
  const { isAuthenticated } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [card, setCard] = useState<AdmitCard | null>(null)
  const backTo = submittedApplicationPath(applicantId)

  async function load() {
    if (!applicantId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getAdmitCard(applicantId)
      setCard(data)
    } catch (err) {
      setCard(null)
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to load admit card.',
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
        state={{ from: `/applications/${applicantId}/admit-card` }}
      />
    )
  }

  return (
    <div className="admit-card-page min-h-[70vh] bg-[#f3f3f3] py-6 print:bg-white print:py-0">
      <div className="admit-card-toolbar mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-3">
        <div>
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c3cff]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to application
          </Link>
          <h1 className="mt-2 text-xl font-bold text-[#071759]">Admit card</h1>
          <p className="mt-1 text-sm text-[#6374ab]">
            Print this card and bring it to the entry test venue.
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
            disabled={!card || loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white hover:bg-[#0934dc] disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[210mm] px-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-[#6374ab]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading admit card…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-white px-5 py-8 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <p className="mt-2 text-xs text-[#6374ab]">
              Admit cards are available after your application is approved and a
              test session is assigned.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-[#0c3cff] px-4 text-sm font-medium text-white"
            >
              Try again
            </button>
          </div>
        ) : card ? (
          <AdmitCardSheet card={card} />
        ) : null}
      </div>
    </div>
  )
}
