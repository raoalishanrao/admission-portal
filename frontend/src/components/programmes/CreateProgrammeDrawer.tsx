import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { ApiError } from '@/lib/api/client'
import { createProgramme, updateProgramme } from '@/lib/api/programmes'
import type { DepartmentResponse, ProgrammeResponse } from '@/lib/api/types'
import { asText, toApiDegreeLevel, toUiDegreeLevel } from '@/lib/catalog-mappers'
import { programmeLevels } from '@/data/programmes-data'

const DESCRIPTION_MAX = 2000

type ProgrammeEditTarget = ProgrammeResponse & { departmentName?: string }

type CreateProgrammeDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
  departments: DepartmentResponse[]
  programme?: ProgrammeEditTarget | null
  defaultDepartmentName?: string
}

type FormState = {
  name: string
  code: string
  departmentName: string
  level: string
  description: string
}

type TouchedState = {
  name: boolean
  code: boolean
  departmentName: boolean
  level: boolean
  description: boolean
}

const initialForm: FormState = {
  name: '',
  code: '',
  departmentName: '',
  level: '',
  description: '',
}

const initialTouched: TouchedState = {
  name: false,
  code: false,
  departmentName: false,
  level: false,
  description: false,
}

function validateForm(form: FormState, departments: DepartmentResponse[]) {
  const trimmedName = form.name.trim()
  const trimmedCode = form.code.trim()
  const trimmedDescription = form.description.trim()

  let nameError = ''
  if (!trimmedName) nameError = 'This field is required.'
  else if (trimmedName.length < 2) nameError = 'Programme name must be at least 2 characters.'

  let codeError = ''
  if (!trimmedCode) codeError = 'This field is required.'
  else if (trimmedCode.length < 1 || trimmedCode.length > 100) codeError = 'Code must be between 1 and 100 characters.'
  else if (!/^[A-Z0-9-]+$/i.test(trimmedCode)) codeError = 'Code can only contain letters, numbers, and hyphens.'

  let departmentError = ''
  if (!form.departmentName) departmentError = 'Please select a department.'
  else if (!departments.some(d => d.name === form.departmentName)) {
    departmentError = 'Please select a valid department.'
  }

  let levelError = ''
  if (!form.level) levelError = 'Please select a level.'

  let descriptionError = ''
  if (trimmedDescription.length > DESCRIPTION_MAX) {
    descriptionError = `Description must not exceed ${DESCRIPTION_MAX} characters.`
  }

  return {
    name: nameError,
    code: codeError,
    departmentName: departmentError,
    level: levelError,
    description: descriptionError,
    isValid: !nameError && !codeError && !departmentError && !levelError && !descriptionError,
  }
}

export function CreateProgrammeDrawer({
  open,
  onOpenChange,
  onCreated,
  departments,
  programme = null,
  defaultDepartmentName = '',
}: CreateProgrammeDrawerProps) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [touched, setTouched] = useState<TouchedState>(initialTouched)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEditing = Boolean(programme)

  const departmentOptions = useMemo(() => {
    const activeNames = departments.filter(d => d.status === 'ACTIVE').map(d => d.name)
    const currentName =
      programme?.departmentName ??
      departments.find(d => d.id === programme?.departmentId)?.name ??
      defaultDepartmentName
    if (currentName && !activeNames.includes(currentName)) {
      activeNames.push(currentName)
    }
    return activeNames.sort((a, b) => a.localeCompare(b))
  }, [departments, programme, defaultDepartmentName])

  const errors = useMemo(() => validateForm(form, departments), [form, departments])

  useEffect(() => {
    if (!open) return
    if (programme) {
      const departmentName =
        programme.departmentName ??
        departments.find(d => d.id === programme.departmentId)?.name ??
        ''
      setForm({
        name: programme.name,
        code: programme.code,
        departmentName,
        level: toUiDegreeLevel(programme.degreeLevel),
        description: asText(programme.description),
      })
    } else {
      setForm({
        ...initialForm,
        departmentName: defaultDepartmentName,
      })
    }
    setTouched(initialTouched)
    setSubmitted(false)
  }, [open, programme, departments, defaultDepartmentName])

  function showError(field: keyof TouchedState) {
    return (touched[field] || submitted) ? errors[field] : ''
  }

  function resetForm() {
    setForm(initialForm)
    setTouched(initialTouched)
    setSubmitted(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  function markTouched(field: keyof TouchedState) {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  async function handleSubmit() {
    setSubmitted(true)
    setTouched({
      name: true,
      code: true,
      departmentName: true,
      level: true,
      description: true,
    })

    if (!errors.isValid) return

    const department = departments.find(d => d.name === form.departmentName)
    if (!department) {
      toast.error('Please select a valid department.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        departmentId: department.id,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        degreeLevel: toApiDegreeLevel(form.level),
      }

      if (isEditing && programme) {
        await updateProgramme(programme.id, payload)
        toast.success('Programme updated')
      } else {
        await createProgramme(payload)
        toast.success('Programme created')
      }
      handleOpenChange(false)
      onCreated?.()
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create programme.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 border-0 bg-white p-0">
        <SheetHeader className="border-b border-[#e4e9f4] px-6 py-6 pr-14">
          <SheetTitle className="text-xl font-bold text-[#071759]">
            {isEditing ? 'Edit Programme' : 'Create Programme'}
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm leading-5 text-[#6374ab]">
            {isEditing
              ? 'Update programme details. Changes apply to future intake configurations.'
              : 'Add a new academic programme. Programmes belong to a department and can be offered in multiple intakes.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#071759]">
              Programme Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              onBlur={() => markTouched('name')}
              placeholder="Enter programme name"
              className={`h-10 border-[#b8c6ed] ${showError('name') ? 'border-red-500' : ''}`}
            />
            {showError('name') && <p className="text-xs text-red-600">{showError('name')}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#071759]">
              Programme Code <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.code}
              onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })}
              onBlur={() => markTouched('code')}
              placeholder="Enter short code (e.g. BCS)"
              className={`h-10 border-[#b8c6ed] ${showError('code') ? 'border-red-500' : ''}`}
            />
            {!showError('code') && (
              <p className="text-xs text-[#6374ab]">A unique code for identification (max 100 characters).</p>
            )}
            {showError('code') && <p className="text-xs text-red-600">{showError('code')}</p>}
          </div>

          <SearchSelect
            label="Department"
            value={form.departmentName}
            onChange={value => {
              setForm({ ...form, departmentName: value })
              markTouched('departmentName')
            }}
            onBlur={() => markTouched('departmentName')}
            options={departmentOptions}
            placeholder="Select department"
            error={showError('departmentName')}
          />

          <SearchSelect
            label="Level"
            value={form.level}
            onChange={value => {
              setForm({ ...form, level: value })
              markTouched('level')
            }}
            onBlur={() => markTouched('level')}
            options={[...programmeLevels]}
            placeholder="Select level"
            error={showError('level')}
            helperText={!showError('level') ? 'Bachelor, Master, or Doctorate' : undefined}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#071759]">Description</label>
            <div className="relative">
              <Textarea
                value={form.description}
                onChange={event => {
                  const value = event.target.value.slice(0, DESCRIPTION_MAX)
                  setForm({ ...form, description: value })
                }}
                onBlur={() => markTouched('description')}
                placeholder="Enter programme description"
                className={`min-h-32 resize-none border-[#b8c6ed] pb-7 ${showError('description') ? 'border-red-500' : ''}`}
              />
              <span className="pointer-events-none absolute right-3 bottom-2 text-xs text-[#6374ab]">
                {form.description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
            {showError('description') && <p className="text-xs text-red-600">{showError('description')}</p>}
          </div>
        </div>

        <SheetFooter className="flex-row gap-3 border-t border-[#e4e9f4] px-6 py-5">
          <Button variant="outline" className="h-11 flex-1 border-[#dce5f6] text-[#354a8d]" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button className="h-11 flex-1 bg-[#0c3cff] hover:bg-[#0934dc]" onClick={handleSubmit} disabled={saving}>
            {saving ? (isEditing ? 'Saving...' : 'Creating...') : isEditing ? 'Save Changes' : 'Create Programme'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
