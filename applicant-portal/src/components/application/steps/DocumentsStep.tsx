import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApplicationDocumentsPanel } from '@/components/application/view/ApplicationDocumentsPanel'
import { ApiError } from '@/lib/api/client'
import { getDocumentRequirements } from '@/lib/api/documents'
import type { ApplicantDocumentRequirement } from '@/lib/api/types'

type Props = {
  applicantId: string
  onSaved: () => void
  onBack: () => void
}

export function DocumentsStep({ applicantId, onSaved, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<ApplicantDocumentRequirement[]>(
    [],
  )
  const load = useCallback(async () => {
    const reqs = await getDocumentRequirements(applicantId).catch(() => [])
    setRequirements(reqs)
  }, [applicantId])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Unable to load document requirements.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [load])

  function handleContinue() {
    setError(null)
    const mandatory = requirements.filter((r) => r.mandatory || r.conditionCode)
    const missing = mandatory.filter((r) => r.status === 'NOT_SUBMITTED')
    if (missing.length > 0) {
      setError(
        `Upload required documents before continuing: ${missing
          .map((r) => r.documentTypeName)
          .join(', ')}.`,
      )
      return
    }
    onSaved()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#6374ab]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading admission documents...
      </div>
    )
  }

  const mandatory = requirements.filter((r) => r.mandatory || r.conditionCode)
  const uploadedCount = mandatory.filter((r) => r.status !== 'NOT_SUBMITTED').length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#071759]">Admission documents</h2>
          <p className="mt-1 text-sm text-[#354a8d]">
            Upload the files required for your selected programmes. This is separate from
            the academic qualification details you entered earlier.
          </p>
        </div>
        {mandatory.length > 0 ? (
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              uploadedCount === mandatory.length
                ? 'bg-[#dcfce7] text-[#166534]'
                : 'bg-[#fff7ed] text-[#c2410c]'
            }`}
          >
            {uploadedCount}/{mandatory.length} uploaded
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <ApplicationDocumentsPanel
        applicantId={applicantId}
        requirements={requirements}
        completeness={null}
        hideHeader
        onChanged={async () => {
          try {
            await load()
          } catch (err) {
            setError(
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : 'Unable to refresh documents.',
            )
          }
        }}
      />

      <div className="flex flex-wrap justify-between gap-3 border-t border-[#e8edf5] pt-4">
        <Button type="button" variant="outline" className="h-10" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          className="h-10 bg-[#0c3cff] hover:bg-[#0934dc]"
          onClick={handleContinue}
        >
          Save &amp; Continue
        </Button>
      </div>
    </div>
  )
}
