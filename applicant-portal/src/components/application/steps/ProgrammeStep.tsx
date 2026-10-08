import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  GraduationCap,
  Info,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/client'
import { listApplicantProgrammes } from '@/lib/api/admissions'
import { getProgrammeStep, saveProgrammeStep } from '@/lib/api/applications'
import type {
  ApplicantIntake,
  ApplicantOffering,
  QualificationLevel,
} from '@/lib/api/types'
import { campusImageForId, degreeLevelLabel } from '@/lib/admissions-display'
import {
  qualificationLevelFromDegree,
  qualificationLevelLabel,
} from '@/lib/application-steps'
import { cn } from '@/lib/utils'

type Props = {
  applicantId: string
  intake: ApplicantIntake
  preferredOfferingId?: string | null
  onSaved: (primaryOffering: ApplicantOffering | null) => void
  onPrimaryOfferingChange?: (offering: ApplicantOffering | null) => void
  onBack?: () => void
}

const LEVELS: QualificationLevel[] = ['UNDERGRADUATE', 'POSTGRADUATE', 'PHD']

export function ProgrammeStep({
  applicantId,
  intake,
  preferredOfferingId,
  onSaved,
  onPrimaryOfferingChange,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offerings, setOfferings] = useState<ApplicantOffering[]>([])
  const [alreadySaved, setAlreadySaved] = useState(false)
  const [level, setLevel] = useState<QualificationLevel>('UNDERGRADUATE')
  const [pref1, setPref1] = useState<string | null>(null)
  const [pref2, setPref2] = useState<string | null>(null)
  const [search1, setSearch1] = useState('')
  const [search2, setSearch2] = useState('')
  const [editingPref, setEditingPref] = useState<1 | 2 | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [programmes, existing] = await Promise.all([
          listApplicantProgrammes(intake.id, { limit: 100 }),
          getProgrammeStep(applicantId).catch(() => null),
        ])
        if (cancelled) return
        setOfferings(programmes.items)

        if (existing?.programmeStepSaved && existing.options.length > 0) {
          setAlreadySaved(true)
          if (existing.qualificationLevel) setLevel(existing.qualificationLevel)
          const sorted = [...existing.options].sort((a, b) => a.preferenceOrder - b.preferenceOrder)
          setPref1(sorted[0]?.programmeOfferingId ?? null)
          setPref2(sorted[1]?.programmeOfferingId ?? null)
          setEditingPref(null)
        } else if (preferredOfferingId) {
          const match = programmes.items.find(item => item.id === preferredOfferingId)
          if (match) {
            setPref1(match.id)
            setLevel(qualificationLevelFromDegree(match.programme.degreeLevel))
            setEditingPref(null)
          } else {
            setEditingPref(1)
          }
        } else {
          setEditingPref(1)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load programmes.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [applicantId, intake.id, preferredOfferingId])

  const byLevel = useMemo(
    () =>
      offerings.filter(
        item => qualificationLevelFromDegree(item.programme.degreeLevel) === level,
      ),
    [offerings, level],
  )

  const filtered1 = useMemo(() => {
    const q = search1.trim().toLowerCase()
    const list = byLevel.filter(item => item.id !== pref2)
    if (!q) return list
    return list.filter(item => {
      const hay = `${item.programme.name} ${item.programme.code} ${item.programme.programmeGrouping ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [byLevel, pref2, search1])

  const filtered2 = useMemo(() => {
    const q = search2.trim().toLowerCase()
    const list = byLevel.filter(item => item.id !== pref1)
    if (!q) return list
    return list.filter(item => {
      const hay = `${item.programme.name} ${item.programme.code} ${item.programme.programmeGrouping ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [byLevel, pref1, search2])

  const selected1 = offerings.find(item => item.id === pref1) ?? null
  const selected2 = offerings.find(item => item.id === pref2) ?? null
  const selectedCount = (pref1 ? 1 : 0) + (pref2 ? 1 : 0)
  const showPicker1 = !pref1 || editingPref === 1
  const showPicker2 = !pref2 || editingPref === 2

  useEffect(() => {
    onPrimaryOfferingChange?.(selected1)
  }, [selected1, onPrimaryOfferingChange])

  async function handleSave() {
    if (!pref1) {
      setError('Select your first preferred programme.')
      setEditingPref(1)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const options = [
        { programmeOfferingId: pref1, preferenceOrder: 1 },
        ...(pref2 ? [{ programmeOfferingId: pref2, preferenceOrder: 2 }] : []),
      ]
      await saveProgrammeStep(applicantId, { qualificationLevel: level, options }, alreadySaved)
      setAlreadySaved(true)
      setEditingPref(null)
      onSaved(selected1)
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to save programme selection.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#6374ab]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading programmes...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#071759]">Programme Preferences</h2>
        <p className="mt-1 text-sm text-[#354a8d]">
          Select your preferred programme(s) for admission. You can choose up to 2 programmes.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[#334155]">
          Qualification Level <span className="text-red-500">*</span>
        </label>
        <select
          value={level}
          onChange={e => {
            setLevel(e.target.value as QualificationLevel)
            setPref1(null)
            setPref2(null)
            setEditingPref(1)
            setSearch1('')
            setSearch2('')
          }}
          className="h-11 w-full rounded-lg border border-[#dce5f6] bg-white px-3 text-sm text-[#071759]"
        >
          {LEVELS.map(item => (
            <option key={item} value={item}>
              {qualificationLevelLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[#071759]">
            Programme Preference 1 <span className="text-red-500">*</span>
          </h3>
          <p className="text-xs text-[#6374ab]">Select your first preferred programme.</p>
        </div>

        {selected1 && !showPicker1 ? (
          <SelectedProgrammeCard
            offering={selected1}
            intakeName={intake.intakeName}
            onChange={() => {
              setEditingPref(1)
              setSearch1('')
            }}
          />
        ) : (
          <ProgrammePicker
            offerings={filtered1}
            search={search1}
            onSearchChange={setSearch1}
            onSelect={id => {
              setPref1(id)
              setEditingPref(null)
              setSearch1('')
            }}
          />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[#071759]">
            Programme Preference 2 (Optional)
          </h3>
          <p className="text-xs text-[#6374ab]">
            You may select a second preference (maximum 2 programmes). {selectedCount}/2 selected
          </p>
        </div>

        {selected2 && !showPicker2 ? (
          <>
            <SelectedProgrammeCard
              offering={selected2}
              intakeName={intake.intakeName}
              onChange={() => {
                setEditingPref(2)
                setSearch2('')
              }}
            />
            <button
              type="button"
              onClick={() => {
                setPref2(null)
                setEditingPref(null)
                setSearch2('')
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0c3cff] hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear selection
            </button>
          </>
        ) : (
          <ProgrammePicker
            offerings={filtered2}
            search={search2}
            onSearchChange={setSearch2}
            onSelect={id => {
              setPref2(id)
              setEditingPref(null)
              setSearch2('')
            }}
          />
        )}
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-[#d6e4ff] bg-[#f5f8ff] px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0c3cff]" />
        <div>
          <p className="text-sm font-semibold text-[#071759]">Programme Availability</p>
          <p className="mt-0.5 text-xs text-[#354a8d]">
            Programme availability will be validated against the published intake offering before
            saving your application.
          </p>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack ? (
          <Button type="button" variant="outline" className="h-11 border-[#dce5f6]" onClick={onBack}>
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="h-11 bg-[#0c3cff] px-5 hover:bg-[#0934dc]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Save & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function ProgrammePicker({
  offerings,
  search,
  onSearchChange,
  onSelect,
}: {
  offerings: ApplicantOffering[]
  search: string
  onSearchChange: (value: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-11 items-center gap-2 rounded-lg border border-[#dce5f6] bg-white px-3">
        <Search className="h-4 w-4 text-[#94a3b8]" />
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search and select a programme"
          className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="grid max-h-72 gap-3 overflow-y-auto">
        {offerings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#dce5f6] px-4 py-6 text-center text-sm text-[#6374ab]">
            No programmes found for this qualification level.
          </p>
        ) : (
          offerings.map(offering => (
            <button
              key={offering.id}
              type="button"
              onClick={() => onSelect(offering.id)}
              className="w-full rounded-xl border border-[#e4e9f4] bg-white p-4 text-left transition hover:border-[#b8c6ed]"
            >
              <ProgrammeCardBody offering={offering} />
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function SelectedProgrammeCard({
  offering,
  intakeName,
  onChange,
}: {
  offering: ApplicantOffering
  intakeName: string
  onChange: () => void
}) {
  return (
    <div className="rounded-xl border border-[#86efac] bg-white p-4 ring-1 ring-[#bbf7d0]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ProgrammeCardBody
          offering={offering}
          note={`${offering.programme.name} is available for admission in the ${intakeName} intake cycle.`}
        />
        <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#15803d]">
          <Check className="h-3.5 w-3.5" />
          Selected
        </span>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onChange}
          className="h-9 border-[#0c3cff] text-[#0c3cff] hover:bg-[#f8faff]"
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Change Programme
        </Button>
      </div>
    </div>
  )
}

function ProgrammeCardBody({
  offering,
  note,
}: {
  offering: ApplicantOffering
  note?: string
}) {
  const image = campusImageForId(offering.id)
  return (
    <div className="flex gap-3">
      <div
        className="h-20 w-24 shrink-0 rounded-lg bg-cover bg-center"
        style={{ backgroundImage: `url('${image}')` }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#071759]">{offering.programme.name}</p>
        <p className="text-xs text-[#6374ab]">
          {offering.programme.programmeGrouping || offering.programme.code}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#6374ab]">
          <span className="inline-flex items-center gap-1">
            <GraduationCap className="h-3.5 w-3.5" />
            {degreeLevelLabel(offering.programme.degreeLevel)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Full Time
          </span>
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {offering.programme.code}
          </span>
        </div>
        {note ? <p className="mt-2 text-xs text-[#354a8d]">{note}</p> : null}
      </div>
    </div>
  )
}
