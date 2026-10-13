import { useEffect, useState } from 'react'
import { FileQuestion, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import {
  createDeclarationStep,
  getDeclarationStep,
  getDeclarationTexts,
  updateDeclarationStep,
} from '@/lib/api/applications'
import type { OfferingDeclarationText } from '@/lib/api/types'

type Props = {
  applicantId: string
  onSaved: () => void
  onBack: () => void
}

export function DeclarationStep({ applicantId, onSaved, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [texts, setTexts] = useState<OfferingDeclarationText[]>([])
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [alreadySaved, setAlreadySaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [textData, existing] = await Promise.all([
          getDeclarationTexts(applicantId).catch(() => []),
          getDeclarationStep(applicantId).catch(() => null),
        ])
        if (cancelled) return
        const list = Array.isArray(textData) ? textData : []
        setTexts(list)
        if (existing) {
          setAlreadySaved(existing.declarationStepSaved)
          const saved = new Set(existing.acceptedOfferingDeclarationIds ?? [])
          // Mark unique text accepted if any linked offering_declaration id was saved
          const displayAccepted = new Set<string>()
          for (const item of list) {
            const groupIds = item.ids?.length ? item.ids : [item.id]
            if (groupIds.some(id => saved.has(id))) {
              displayAccepted.add(item.id)
            }
          }
          setAcceptedIds(displayAccepted)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          // Treat load failures as "no declarations" so the applicant can still continue.
          setTexts([])
          setError(err instanceof Error ? err.message : null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [applicantId])

  function toggle(id: string) {
    setAcceptedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    const noDeclarations = texts.length === 0

    if (!noDeclarations) {
      const requiredIds = texts.map(item => item.id)
      const missing = requiredIds.filter(id => !acceptedIds.has(id))
      if (missing.length > 0) {
        setError('Please accept all required declarations to continue.')
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      const body = {
        declarationAccepted: true,
        // Send every offering_declaration id covered by accepted unique texts
        acceptedOfferingDeclarationIds: texts
          .filter(item => acceptedIds.has(item.id))
          .flatMap(item => (item.ids?.length ? item.ids : [item.id])),
        disciplinaryIssueDeclared: false,
      }

      try {
        if (alreadySaved) {
          await updateDeclarationStep(applicantId, body)
        } else {
          await createDeclarationStep(applicantId, body)
          setAlreadySaved(true)
        }
      } catch (err: unknown) {
        // If nothing is configured for this offering, still allow moving forward.
        if (!noDeclarations) {
          throw err
        }
      }

      onSaved()
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to save declarations.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#6374ab]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading declarations...
      </div>
    )
  }

  const noDeclarations = texts.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#071759]">Declarations</h2>
        <p className="mt-1 text-sm text-[#354a8d]">
          {noDeclarations
            ? 'No declarations are configured for your selected programme.'
            : 'Please review and accept the following declarations before continuing.'}
        </p>
      </div>

      <div className="space-y-3">
        {noDeclarations ? (
          <div className="rounded-xl border border-dashed border-[#dce5f6] bg-[#f8faff] px-6 py-10 text-center">
            <FileQuestion className="mx-auto h-8 w-8 text-[#94a3b8]" />
            <p className="mt-3 text-sm font-semibold text-[#071759]">
              No declarations exist for this programme
            </p>
            <p className="mt-1 text-xs text-[#6374ab]">
              You can continue to the next step without accepting any declaration texts.
            </p>
          </div>
        ) : (
          texts.map(item => (
            <label
              key={item.id}
              className="flex cursor-pointer gap-3 rounded-xl border border-[#e4e9f4] bg-white p-4"
            >
              <input
                type="checkbox"
                checked={acceptedIds.has(item.id)}
                onChange={() => toggle(item.id)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-[#071759]">
                  Declaration <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-[#94a3b8]">v{item.version}</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#354a8d]">{item.declarationText}</p>
              </div>
            </label>
          ))
        )}
      </div>

      {error && !noDeclarations ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" className="h-11 border-[#dce5f6]" onClick={onBack}>
          Previous
        </Button>
        <Button
          type="button"
          disabled={saving || (!noDeclarations && acceptedIds.size < texts.length)}
          onClick={() => void handleSave()}
          className="h-11 bg-[#0c3cff] px-5 hover:bg-[#0934dc]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : noDeclarations ? (
            'Continue'
          ) : (
            'Save & Continue'
          )}
        </Button>
      </div>
    </div>
  )
}
