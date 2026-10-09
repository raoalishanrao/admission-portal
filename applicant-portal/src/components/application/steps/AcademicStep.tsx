import { useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/client'
import {
  createAcademicStep,
  getAcademicStep,
  getRequiredAcademicLevels,
  updateAcademicStep,
} from '@/lib/api/applications'
import {
  academicDegreeLabel,
  academicRecordTitle,
  calcPercentage,
  DEGREE_TYPE_OPTIONS,
  DIVISION_OPTIONS,
  GRADE_OPTIONS,
  PAKISTAN_BOARD_OPTIONS,
  passingYearOptions,
} from '@/lib/application-steps'
import type {
  AcademicRecordFields,
  AcademicRecordResponse,
  RequiredAcademicLevels,
} from '@/lib/api/types'

type Props = {
  applicantId: string
  onSaved: () => void
  onBack: () => void
}

const OTHER_BOARD = 'Other / University / Institution'
const STANDARD_BOARDS = PAKISTAN_BOARD_OPTIONS.filter(board => board !== OTHER_BOARD)
const PASSING_YEARS = passingYearOptions()

type DraftRecord = AcademicRecordFields & { localKey: string; id?: string }

function emptyDraft(preferredDegreeType?: string): DraftRecord {
  const degreeType = preferredDegreeType || 'MATRIC'
  return {
    localKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    degreeType,
    rollNumber: '',
    qualificationName: academicDegreeLabel(degreeType),
    boardOrInstitution: '',
    passingYear: '',
    division: '1st',
    grade: 'A',
    marksOrGpaObtained: '',
    marksOrGpaTotal: '',
    percentage: 0,
  }
}

function draftFromRecord(record: AcademicRecordResponse): DraftRecord {
  return {
    localKey: `edit-${record.id}`,
    id: record.id,
    degreeType: record.degreeType,
    rollNumber: String(record.rollNumber ?? ''),
    qualificationName: record.qualificationName,
    boardOrInstitution: record.boardOrInstitution,
    passingYear: record.passingYear,
    division: record.division,
    grade: record.grade,
    marksOrGpaObtained: record.marksOrGpaObtained,
    marksOrGpaTotal: record.marksOrGpaTotal,
    percentage: record.percentage,
  }
}

export function AcademicStep({ applicantId, onSaved, onBack }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [savedRecords, setSavedRecords] = useState<AcademicRecordResponse[]>([])
  const [requiredLevels, setRequiredLevels] = useState<RequiredAcademicLevels | null>(
    null,
  )
  const [draft, setDraft] = useState<DraftRecord | null>(null)

  async function refreshRequirements() {
    const levels = await getRequiredAcademicLevels(applicantId).catch(() => null)
    setRequiredLevels(levels)
    return levels
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [data, levels] = await Promise.all([
          getAcademicStep(applicantId),
          getRequiredAcademicLevels(applicantId).catch(() => null),
        ])
        if (cancelled) return
        setSavedRecords(Array.isArray(data.records) ? data.records : [])
        setRequiredLevels(levels)
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load academic details.')
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

  const recordList = Array.isArray(savedRecords) ? savedRecords : []
  const usedDegreeTypes = new Set(
    recordList.map(record => record.degreeType.trim().toUpperCase()),
  )
  const availableDegreeOptions = DEGREE_TYPE_OPTIONS.filter(option => {
    if (draft?.id && draft.degreeType.trim().toUpperCase() === option.value) {
      return true
    }
    return !usedDegreeTypes.has(option.value)
  })

  /**
   * Next degree to open. Prefer missing *required* codes (from programme degree level).
   * Only fall through to unused optional levels (e.g. Bachelor) when the user
   * explicitly adds another qualification — never after auto-save of the last required.
   */
  function nextMissingDegreeType(
    records: AcademicRecordResponse[] | null | undefined,
    levels: RequiredAcademicLevels | null,
    options?: { allowOptional?: boolean },
  ) {
    const list = Array.isArray(records) ? records : []
    const used = new Set(list.map(record => record.degreeType.trim().toUpperCase()))
    const fromRequired = levels?.missingAcademicCodes?.find(
      code => !used.has(code.trim().toUpperCase()),
    )
    if (fromRequired) return fromRequired.trim().toUpperCase()
    if (levels?.requiredAcademicCodes?.length && !options?.allowOptional) {
      return null
    }
    return DEGREE_TYPE_OPTIONS.find(option => !used.has(option.value))?.value ?? null
  }

  function startNewDraft(
    records?: AcademicRecordResponse[],
    levels?: RequiredAcademicLevels | null,
  ) {
    setError(null)
    setInfo(null)
    const nextType = nextMissingDegreeType(
      Array.isArray(records) ? records : savedRecords,
      levels === undefined ? requiredLevels : levels,
      { allowOptional: true },
    )
    if (!nextType) {
      setError('All available qualification levels have already been added.')
      return
    }
    setDraft(emptyDraft(nextType))
  }

  function sanitizeMarkInput(value: string) {
    const cleaned = value.replace(/[^\d.]/g, '')
    const parts = cleaned.split('.')
    if (parts.length <= 1) return cleaned
    return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
  }

  function patchDraft(patch: Partial<DraftRecord>) {
    setDraft(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      if (patch.marksOrGpaObtained !== undefined || patch.marksOrGpaTotal !== undefined) {
        next.percentage = calcPercentage(next.marksOrGpaObtained, next.marksOrGpaTotal)
      }
      if (patch.degreeType !== undefined && !patch.qualificationName) {
        const match = DEGREE_TYPE_OPTIONS.find(item => item.value === patch.degreeType)
        if (match && (!prev.qualificationName || prev.qualificationName === match.label)) {
          next.qualificationName = match.label
        }
      }
      return next
    })
  }

  function validateDraft(record: DraftRecord): string | null {
    const required: Array<keyof AcademicRecordFields> = [
      'degreeType',
      'rollNumber',
      'qualificationName',
      'boardOrInstitution',
      'passingYear',
      'division',
      'grade',
      'marksOrGpaObtained',
      'marksOrGpaTotal',
    ]
    for (const key of required) {
      if (!String(record[key] ?? '').trim()) {
        return 'Please complete all required fields before saving this qualification.'
      }
    }
    if (record.boardOrInstitution.trim() === OTHER_BOARD) {
      return 'Please enter the university / institution name.'
    }
    if (
      !record.id &&
      usedDegreeTypes.has(record.degreeType.trim().toUpperCase())
    ) {
      return `You already added ${academicDegreeLabel(record.degreeType)}. Edit that qualification or add the next required level.`
    }
    const obtained = Number(record.marksOrGpaObtained.trim())
    const total = Number(record.marksOrGpaTotal.trim())
    if (!Number.isFinite(obtained) || obtained < 0) {
      return 'Obtained marks / GPA must be a valid number (0 or greater).'
    }
    if (!Number.isFinite(total) || total <= 0) {
      return 'Total marks / GPA must be a valid number greater than 0.'
    }
    if (obtained > total) {
      return 'Obtained marks / GPA cannot be greater than total marks / GPA.'
    }
    const percentage = calcPercentage(record.marksOrGpaObtained, record.marksOrGpaTotal)
    if (percentage <= 0 && obtained > 0) {
      return 'Unable to calculate percentage from the marks entered.'
    }
    return null
  }

  async function handleSaveDraft() {
    if (!draft) return
    const validationError = validateDraft(draft)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const percentage = calcPercentage(draft.marksOrGpaObtained, draft.marksOrGpaTotal)
      const payload: AcademicRecordFields = {
        degreeType: draft.degreeType.trim(),
        rollNumber: draft.rollNumber.trim(),
        qualificationName: draft.qualificationName.trim(),
        boardOrInstitution: draft.boardOrInstitution.trim(),
        passingYear: draft.passingYear.trim(),
        division: draft.division.trim(),
        grade: draft.grade.trim(),
        marksOrGpaObtained: draft.marksOrGpaObtained.trim(),
        marksOrGpaTotal: draft.marksOrGpaTotal.trim(),
        percentage,
      }

      let result
      if (draft.id) {
        // Update existing record (PUT requires id on every row).
        result = await updateAcademicStep(applicantId, {
          records: savedRecords.map(record =>
            record.id === draft.id
              ? { id: draft.id, ...payload }
              : {
                  id: record.id,
                  degreeType: record.degreeType,
                  rollNumber: String(record.rollNumber ?? ''),
                  qualificationName: record.qualificationName,
                  boardOrInstitution: record.boardOrInstitution,
                  passingYear: record.passingYear,
                  division: record.division,
                  grade: record.grade,
                  marksOrGpaObtained: record.marksOrGpaObtained,
                  marksOrGpaTotal: record.marksOrGpaTotal,
                  percentage: record.percentage,
                },
          ),
        })
      } else {
        // POST creates the first batch, or appends additional degree types.
        result = await createAcademicStep(applicantId, { records: [payload] })
      }

      const records = Array.isArray(result.records) ? result.records : []
      setSavedRecords(records)
      const levels = await refreshRequirements()

      const nextType = nextMissingDegreeType(records, levels)
      if (!draft.id && nextType) {
        setDraft(emptyDraft(nextType))
        setInfo(
          `${academicDegreeLabel(payload.degreeType)} saved. Next: add ${academicDegreeLabel(nextType)}.`,
        )
      } else {
        setDraft(null)
        setInfo(
          draft.id
            ? 'Qualification updated.'
            : 'All required academic records are saved. Continue to upload admission documents on the next step.',
        )
      }
    } catch (err: unknown) {
      setInfo(null)
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to save qualification.'
      setError(message)
      if (
        err instanceof ApiError &&
        (err.code === 'ACADEMIC_DEGREE_TYPE_EXISTS' ||
          /already added/i.test(err.message))
      ) {
        const nextType = nextMissingDegreeType(savedRecords, requiredLevels)
        if (nextType) setDraft(emptyDraft(nextType))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveSaved(recordId: string) {
    setSaving(true)
    setError(null)
    try {
      const remaining = savedRecords.filter(record => record.id !== recordId)
      if (remaining.length === 0) {
        // API has no delete-all; keep local empty and block continue until one is added again.
        setSavedRecords([])
        if (draft?.id === recordId) setDraft(null)
        return
      }
      const result = await updateAcademicStep(applicantId, {
        records: remaining.map(record => ({
          id: record.id,
          degreeType: record.degreeType,
          rollNumber: String(record.rollNumber ?? ''),
          qualificationName: record.qualificationName,
          boardOrInstitution: record.boardOrInstitution,
          passingYear: record.passingYear,
          division: record.division,
          grade: record.grade,
          marksOrGpaObtained: record.marksOrGpaObtained,
          marksOrGpaTotal: record.marksOrGpaTotal,
          percentage: record.percentage,
        })),
      })
      setSavedRecords(result.records ?? remaining)
      if (draft?.id === recordId) setDraft(null)
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to remove qualification.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleContinue() {
    setInfo(null)
    if (savedRecords.length === 0) {
      setError('Add at least one academic qualification before continuing.')
      return
    }
    if (draft) {
      setError('Save or cancel the open qualification form before continuing.')
      return
    }
    const levels = await refreshRequirements()
    if (
      levels &&
      levels.requiredAcademicCodes.length > 0 &&
      levels.missingAcademicCodes.length > 0
    ) {
      const nextType = levels.missingAcademicCodes[0]
      setError(
        `Missing required academic records: ${levels.missingAcademicCodes
          .map(academicDegreeLabel)
          .join(', ')}.`,
      )
      if (nextType) setDraft(emptyDraft(nextType))
      return
    }
    onSaved()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#6374ab]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading academic details...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#071759]">Academic Details</h2>
          <p className="mt-1 text-sm text-[#354a8d]">
            Add one record per qualification level (e.g. Matric / SSC, Intermediate / FSc /
            HSSC). File uploads are on the Admission Documents step.
          </p>
        </div>
        {!draft ? (
          <Button
            type="button"
            className="h-10 bg-[#0c3cff] hover:bg-[#0934dc]"
            onClick={() => startNewDraft()}
            disabled={availableDegreeOptions.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Qualification
          </Button>
        ) : null}
      </div>

      {requiredLevels && requiredLevels.requiredAcademicCodes.length > 0 ? (
        <section className="rounded-xl border border-[#dbeafe] bg-[#eff6ff] px-4 py-4">
          <h3 className="text-sm font-semibold text-[#071759]">
            Required academic information
          </h3>
          <ul className="mt-3 space-y-1.5">
            {requiredLevels.requiredAcademicCodes.map((code) => {
              const missing = requiredLevels.missingAcademicCodes.includes(code)
              return (
                <li
                  key={code}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-[#071759]">
                    {academicDegreeLabel(code)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      missing
                        ? 'bg-[#fff7ed] text-[#c2410c]'
                        : 'bg-[#dcfce7] text-[#166534]'
                    }`}
                  >
                    {missing ? 'Required' : 'Added'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {savedRecords.length === 0 && !draft ? (
        <div className="rounded-xl border border-dashed border-[#dce5f6] bg-[#f8faff] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#071759]">No qualifications added yet</p>
          <p className="mt-1 text-xs text-[#6374ab]">
            Add Matric, Intermediate, Bachelor, Master, or Doctorate — one at a
            time.
          </p>
          <Button
            type="button"
            className="mt-4 h-10 bg-[#0c3cff] hover:bg-[#0934dc]"
            onClick={() => startNewDraft()}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Qualification
          </Button>
        </div>
      ) : null}

      {savedRecords
        .filter(record => record.id !== draft?.id)
        .map((record, index) => (
        <div key={record.id} className="rounded-xl border border-[#e4e9f4] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6374ab]">
                Qualification {index + 1}
              </p>
              <h3 className="mt-1 font-semibold text-[#071759]">
                {academicRecordTitle(record.degreeType, record.qualificationName)}
              </h3>
              <p className="mt-1 text-xs text-[#6374ab]">
                {record.boardOrInstitution} · {record.passingYear} · {record.percentage}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-[#dce5f6]"
                onClick={() => {
                  setError(null)
                  setInfo(null)
                  setDraft(draftFromRecord(record))
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-red-600"
                onClick={() => void handleRemoveSaved(record.id)}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}

      {draft ? (
        <div className="rounded-xl border border-[#0c3cff] bg-white p-5 ring-2 ring-[#dbe7ff]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-[#071759]">
              {draft.id ? 'Edit Qualification' : 'New Qualification'}
            </h3>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-[#6374ab]"
              onClick={() => {
                setDraft(null)
                setError(null)
                setInfo(null)
              }}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Degree / Qualification Type">
              <select
                value={draft.degreeType}
                onChange={e => patchDraft({ degreeType: e.target.value })}
                className="h-10 w-full rounded-md border border-[#dce5f6] px-3 text-sm"
              >
                {availableDegreeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qualification Name">
              <Input
                value={draft.qualificationName}
                onChange={e => patchDraft({ qualificationName: e.target.value })}
                placeholder="e.g. FSC Pre-Engineering"
              />
            </Field>
            <Field label="Board / Institution">
              <BoardInstitutionFields
                value={draft.boardOrInstitution}
                onChange={value => patchDraft({ boardOrInstitution: value })}
              />
            </Field>
            <Field label="Roll Number">
              <Input
                value={draft.rollNumber}
                onChange={e => patchDraft({ rollNumber: e.target.value })}
                placeholder="Board roll number"
              />
            </Field>
            <Field label="Passing Year">
              <select
                value={draft.passingYear}
                onChange={e => patchDraft({ passingYear: e.target.value })}
                className="h-10 w-full rounded-md border border-[#dce5f6] px-3 text-sm"
              >
                <option value="">Select year</option>
                {draft.passingYear && !PASSING_YEARS.includes(draft.passingYear) ? (
                  <option value={draft.passingYear}>{draft.passingYear}</option>
                ) : null}
                {PASSING_YEARS.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Division">
              <select
                value={draft.division}
                onChange={e => patchDraft({ division: e.target.value })}
                className="h-10 w-full rounded-md border border-[#dce5f6] px-3 text-sm"
              >
                {DIVISION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Grade">
              <select
                value={draft.grade}
                onChange={e => patchDraft({ grade: e.target.value })}
                className="h-10 w-full rounded-md border border-[#dce5f6] px-3 text-sm"
              >
                {GRADE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Obtained Marks / GPA">
              <Input
                inputMode="decimal"
                value={draft.marksOrGpaObtained}
                onChange={e =>
                  patchDraft({ marksOrGpaObtained: sanitizeMarkInput(e.target.value) })
                }
                placeholder="e.g. 875 or 3.5"
              />
            </Field>
            <Field label="Total Marks / GPA">
              <Input
                inputMode="decimal"
                value={draft.marksOrGpaTotal}
                onChange={e =>
                  patchDraft({ marksOrGpaTotal: sanitizeMarkInput(e.target.value) })
                }
                placeholder="e.g. 1100 or 4.0"
              />
            </Field>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[#334155]">
                Percentage
              </label>
              <Input
                value={draft.percentage ? String(draft.percentage) : ''}
                readOnly
                className="bg-[#f8fafc]"
                placeholder="Calculated automatically"
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveDraft()}
              className="h-10 bg-[#0c3cff] hover:bg-[#0934dc]"
            >
                {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : draft.id ? (
                'Update Qualification'
              ) : (
                'Save Qualification'
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {info ? (
        <p className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[#1d4ed8]">
          {info}
        </p>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" className="h-11 border-[#dce5f6]" onClick={onBack}>
          Previous
        </Button>
        <Button
          type="button"
          disabled={saving}
          onClick={() => void handleContinue()}
          className="h-11 bg-[#0c3cff] px-5 hover:bg-[#0934dc]"
        >
          Save & Continue
        </Button>
      </div>
    </div>
  )
}

function BoardInstitutionFields({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const isCustom =
    value === OTHER_BOARD ||
    (!!value && !(STANDARD_BOARDS as readonly string[]).includes(value))
  const selectValue = !value
    ? ''
    : (STANDARD_BOARDS as readonly string[]).includes(value)
      ? value
      : OTHER_BOARD

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={e => {
          const next = e.target.value
          onChange(next === OTHER_BOARD ? OTHER_BOARD : next)
        }}
        className="h-10 w-full rounded-md border border-[#dce5f6] px-3 text-sm"
      >
        <option value="">Select board / institution</option>
        {STANDARD_BOARDS.map(board => (
          <option key={board} value={board}>
            {board}
          </option>
        ))}
        <option value={OTHER_BOARD}>{OTHER_BOARD}</option>
      </select>
      {isCustom ? (
        <Input
          value={value === OTHER_BOARD ? '' : value}
          onChange={e => onChange(e.target.value.trim() ? e.target.value : OTHER_BOARD)}
          placeholder="Enter university / institution name"
        />
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#334155]">
        {label} <span className="text-red-500">*</span>
      </label>
      {children}
    </div>
  )
}
