import { useEffect, useState } from 'react'
import { Check, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api/client'
import {
  getSpecialCategories,
  saveSpecialCategoryClaims,
} from '@/lib/api/applications'
import type { SpecialCategoryOption } from '@/lib/api/types'
import { cn } from '@/lib/utils'

type Props = {
  applicantId: string
  onSaved: () => void
  onBack: () => void
}

function claimStatusLabel(status: string) {
  switch (status) {
    case 'VERIFIED':
      return 'Verified'
    case 'REJECTED':
      return 'Rejected'
    default:
      return 'Claimed'
  }
}

export function SpecialCategoriesStep({ applicantId, onSaved, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<SpecialCategoryOption[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [claimStatusByCategoryId, setClaimStatusByCategoryId] = useState<
    Record<string, string>
  >({})
  const [totalBonusMarks, setTotalBonusMarks] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getSpecialCategories(applicantId)
        if (cancelled) return
        const availableRows = data.available ?? []
        setAvailable(availableRows)
        setTotalBonusMarks(data.totalBonusMarks ?? 0)
        const claims = data.claims ?? []
        const availableIdSet = new Set(availableRows.map(c => c.id))
        setSelectedIds(
          new Set(
            claims
              .map(c => c.specialCategoryId)
              .filter(id => availableIdSet.has(id)),
          ),
        )
        setClaimStatusByCategoryId(
          Object.fromEntries(claims.map(c => [c.specialCategoryId, c.status])),
        )
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load special categories.',
          )
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

  function toggleCategory(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const data = await saveSpecialCategoryClaims(applicantId, {
        specialCategoryIds: [...selectedIds],
      })
      const availableRows = data.available ?? []
      setAvailable(availableRows)
      setTotalBonusMarks(data.totalBonusMarks ?? 0)
      const claims = data.claims ?? []
      const availableIdSet = new Set(availableRows.map(c => c.id))
      setSelectedIds(
        new Set(
          claims
            .map(c => c.specialCategoryId)
            .filter(id => availableIdSet.has(id)),
        ),
      )
      setClaimStatusByCategoryId(
        Object.fromEntries(claims.map(c => [c.specialCategoryId, c.status])),
      )
      onSaved()
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to save special category claims.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#6374ab]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading special categories...
      </div>
    )
  }

  const previewBonus = available
    .filter(c => selectedIds.has(c.id))
    .reduce((sum, c) => sum + (Number(c.bonusMarks) || 0), 0)

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-[#071759] sm:text-2xl">
          Special categories
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#5b6b94]">
          Optionally claim categories enabled for your selected programmes.
          Bonus marks apply only where the programme allows them.
        </p>
      </header>

      <div className="flex gap-3 rounded-xl border border-[#d6e4ff] bg-[#eef4ff] px-4 py-3.5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0c3cff]" strokeWidth={1.75} />
        <div>
          <p className="text-sm font-semibold text-[#071759]">How this works</p>
          <p className="mt-1 text-sm leading-relaxed text-[#354a8d]">
            Categories appear once even if several of your programmes enable
            them. You can continue without selecting any.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <article className="overflow-hidden rounded-2xl border border-[#e4e9f4] bg-white shadow-[0_1px_3px_rgb(15_31_77/0.04)]">
        <div className="p-5 sm:p-6">
          <div className="rounded-xl border border-[#dce5f6] bg-[#f5f8ff] p-4 sm:p-5">
            <p className="text-sm font-semibold text-[#071759]">
              Choose categories that apply to you.
            </p>

            {available.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-[#c5d0ef] bg-white/70 px-3 py-8 text-center text-sm text-[#6374ab]">
                No special categories are enabled for your selected programmes.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#dce5f6] overflow-hidden rounded-lg border border-[#dce5f6] bg-white">
                {available.map(category => {
                  const checked = selectedIds.has(category.id)
                  const status = claimStatusByCategoryId[category.id]
                  return (
                    <li key={category.id}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
                          checked ? 'bg-[#f0f4ff]' : 'hover:bg-[#f8faff]',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border',
                            checked
                              ? 'border-[#0c3cff] bg-[#0c3cff] text-white'
                              : 'border-[#c5d0ef] bg-white',
                          )}
                          aria-hidden
                        >
                          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[#071759]">
                              {category.name}
                            </span>
                            <span className="rounded-full bg-[#dbeafe] px-2 py-0.5 text-xs font-semibold text-[#1d4ed8]">
                              +{category.bonusMarks} marks
                            </span>
                            {category.requiresEvidence ? (
                              <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-medium text-[#c2410c]">
                                Evidence may be required
                              </span>
                            ) : null}
                            {status ? (
                              <span className="rounded-full bg-[#e8edf5] px-2 py-0.5 text-xs font-medium text-[#354a8d]">
                                {claimStatusLabel(status)}
                              </span>
                            ) : null}
                          </div>
                          {category.description ? (
                            <p className="mt-1 text-xs leading-relaxed text-[#6374ab]">
                              {category.description}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <p className="mt-4 text-sm text-[#354a8d]">
            Estimated bonus if saved:{' '}
            <span className="font-semibold text-[#071759]">+{previewBonus}</span>
            {totalBonusMarks > 0 && previewBonus !== totalBonusMarks ? (
              <span className="ml-2 text-xs text-[#6374ab]">
                (currently saved: +{totalBonusMarks})
              </span>
            ) : null}
          </p>
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
          Back
        </Button>
        <Button
          type="button"
          className="bg-[#0c3cff] hover:bg-[#0a32d6]"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save & continue'
          )}
        </Button>
      </div>
    </div>
  )
}
