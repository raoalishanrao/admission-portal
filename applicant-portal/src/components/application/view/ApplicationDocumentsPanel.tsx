import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileUp,
  Link2,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import {
  academicDocumentMatchesRequirementCode,
  autoLinkMatchingAcademicDocuments,
  linkAcademicDocument,
  replaceApplicantDocument,
  uploadApplicantDocument,
} from '@/lib/api/documents'
import { academicRecordTitle } from '@/lib/application-steps'
import type {
  AcademicDocumentResponse,
  AdmissionDocumentStatus,
  ApplicantDocumentRequirement,
  DocumentCompleteness,
} from '@/lib/api/types'

export type AcademicDocumentListItem = AcademicDocumentResponse & {
  degreeType: string
  qualificationName: string
}

type Props = {
  applicantId: string
  requirements: ApplicantDocumentRequirement[]
  completeness: DocumentCompleteness | null
  academicDocuments?: AcademicDocumentListItem[]
  onChanged: () => Promise<void> | void
}

function statusStyles(status: AdmissionDocumentStatus) {
  switch (status) {
    case 'VERIFIED':
      return 'bg-[#dcfce7] text-[#166534]'
    case 'SUBMITTED':
      return 'bg-[#dbeafe] text-[#1d4ed8]'
    case 'RESUBMISSION_REQUIRED':
      return 'bg-[#fee2e2] text-[#b91c1c]'
    default:
      return 'bg-[#f1f5f9] text-[#475569]'
  }
}

function statusLabel(status: AdmissionDocumentStatus) {
  switch (status) {
    case 'VERIFIED':
      return 'Verified'
    case 'SUBMITTED':
      return 'Submitted'
    case 'RESUBMISSION_REQUIRED':
      return 'Action required'
    case 'NOT_SUBMITTED':
      return 'Not submitted'
    default:
      return status
  }
}

function linkableRequirementsForDoc(
  doc: AcademicDocumentResponse,
  requirements: ApplicantDocumentRequirement[],
) {
  return requirements.filter(
    (req) =>
      (req.status === 'NOT_SUBMITTED' ||
        req.status === 'RESUBMISSION_REQUIRED') &&
      academicDocumentMatchesRequirementCode(
        doc.documentType,
        req.documentTypeCode,
      ),
  )
}

export function ApplicationDocumentsPanel({
  applicantId,
  requirements,
  completeness,
  academicDocuments = [],
  onChanged,
}: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoLinking, setAutoLinking] = useState(false)
  const [linkSelection, setLinkSelection] = useState<Record<string, string>>({})
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged
  const autoLinkAttemptKey = useRef<string>('')

  // Prefer link-academic for matching qualification files once requirements load.
  useEffect(() => {
    if (!applicantId || academicDocuments.length === 0 || requirements.length === 0) {
      return
    }
    const openCount = requirements.filter(
      (r) =>
        r.status === 'NOT_SUBMITTED' || r.status === 'RESUBMISSION_REQUIRED',
    ).length
    if (openCount === 0) return

    const key = `${applicantId}:${academicDocuments.map((d) => d.id).join(',')}:${requirements
      .map((r) => `${r.offeringRequiredDocumentId}:${r.status}`)
      .join(',')}`
    if (autoLinkAttemptKey.current === key) return
    autoLinkAttemptKey.current = key

    let cancelled = false
    setAutoLinking(true)
    void autoLinkMatchingAcademicDocuments(
      applicantId,
      academicDocuments,
      requirements,
    )
      .then(async (linked) => {
        if (cancelled || linked <= 0) return
        await onChangedRef.current()
      })
      .finally(() => {
        if (!cancelled) setAutoLinking(false)
      })

    return () => {
      cancelled = true
    }
  }, [applicantId, academicDocuments, requirements])

  async function handleFile(
    key: string,
    file: File | undefined,
    action: 'upload' | 'replace',
    requirement: ApplicantDocumentRequirement,
  ) {
    if (!file) return
    setBusyKey(key)
    setError(null)
    try {
      if (action === 'upload') {
        await uploadApplicantDocument(
          applicantId,
          file,
          requirement.offeringRequiredDocumentIds?.length
            ? requirement.offeringRequiredDocumentIds
            : [requirement.offeringRequiredDocumentId],
        )
      } else {
        const documentId = requirement.document?.id
        if (!documentId) throw new Error('No document to replace.')
        await replaceApplicantDocument(applicantId, documentId, file)
      }
      await onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to update document.',
      )
    } finally {
      setBusyKey(null)
      const input = inputRefs.current[key]
      if (input) input.value = ''
    }
  }

  async function handleLinkAcademic(docId: string) {
    const requirementId = linkSelection[docId]
    const requirement = requirements.find(
      (r) => r.offeringRequiredDocumentId === requirementId,
    )
    if (!requirement) {
      setError('Select a matching admission document requirement to link.')
      return
    }
    const ids =
      requirement.offeringRequiredDocumentIds?.length > 0
        ? requirement.offeringRequiredDocumentIds
        : [requirement.offeringRequiredDocumentId]
    setBusyKey(`link:${docId}`)
    setError(null)
    try {
      await linkAcademicDocument(applicantId, docId, ids)
      setLinkSelection((prev) => {
        const next = { ...prev }
        delete next[docId]
        return next
      })
      await onChanged()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to link academic document.',
      )
    } finally {
      setBusyKey(null)
    }
  }

  const outstanding = requirements.filter((r) => r.status === 'RESUBMISSION_REQUIRED')

  return (
    <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#071759]">Admission documents</h2>
          <p className="mt-1 text-sm text-[#6374ab]">
            Upload required documents. If admissions requests a correction, replace the file using
            the reason shown below.
          </p>
        </div>
        {completeness ? (
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              completeness.complete
                ? 'bg-[#dcfce7] text-[#166534]'
                : 'bg-[#fff7ed] text-[#c2410c]'
            }`}
          >
            {completeness.complete ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {completeness.verifiedCount}/{completeness.requiredCount} verified
          </div>
        ) : null}
      </div>

      {outstanding.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
          <p className="font-semibold">
            {outstanding.length} document{outstanding.length === 1 ? '' : 's'} need
            {outstanding.length === 1 ? 's' : ''} resubmission
          </p>
          <p className="mt-1 text-xs text-[#b91c1c]">
            Review the objection reason on each item and upload a corrected file.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {academicDocuments.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-[#071759]">
            Files uploaded with your qualifications
          </h3>
          <p className="mt-1 text-xs text-[#6374ab]">
            Matching marksheets, certificates, and transcripts are linked to
            admission requirements automatically via link-academic. You can still
            link manually if a file was not matched.
            {autoLinking ? ' Linking…' : ''}
          </p>
          <ul className="mt-3 space-y-2">
            {academicDocuments.map((doc) => {
              const linkable = linkableRequirementsForDoc(doc, requirements)
              const linking = busyKey === `link:${doc.id}`
              return (
                <li
                  key={doc.id}
                  className="rounded-lg border border-[#e8edf5] bg-[#f8faff] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-[#0c3cff]" />
                        <p className="font-medium text-[#071759]">
                          {doc.originalFileName || doc.documentType}
                        </p>
                        <span className="rounded bg-[#e2e8f0] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#475569]">
                          {doc.documentType}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#6374ab]">
                        {academicRecordTitle(
                          doc.degreeType,
                          doc.qualificationName,
                        )}
                        {doc.uploadedAt
                          ? ` · Uploaded ${new Date(doc.uploadedAt).toLocaleString()}`
                          : ''}
                      </p>
                    </div>
                    {doc.downloadUrl ? (
                      <a
                        href={doc.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c9d4ef] bg-white px-3 text-xs font-medium text-[#071759] hover:bg-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View file
                      </a>
                    ) : null}
                  </div>
                  {linkable.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#e8edf5] pt-3">
                      <label className="min-w-[12rem] flex-1 text-xs">
                        <span className="font-medium text-[#6374ab]">
                          Use for requirement
                        </span>
                        <select
                          value={linkSelection[doc.id] || ''}
                          onChange={(e) =>
                            setLinkSelection((prev) => ({
                              ...prev,
                              [doc.id]: e.target.value,
                            }))
                          }
                          className="mt-1 h-9 w-full rounded-lg border border-[#c9d4ef] bg-white px-2 text-xs text-[#071759]"
                        >
                          <option value="">Select…</option>
                          {linkable.map((req) => (
                            <option
                              key={req.offeringRequiredDocumentId}
                              value={req.offeringRequiredDocumentId}
                            >
                              {req.documentTypeName}
                              {req.mandatory ? ' (required)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={linking || !linkSelection[doc.id]}
                        onClick={() => void handleLinkAcademic(doc.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c9d4ef] bg-white px-3 text-xs font-medium text-[#071759] hover:bg-white disabled:opacity-60"
                      >
                        {linking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                        Link to application
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {requirements.length === 0 ? (
        <p className="mt-6 text-sm text-[#6374ab]">
          {academicDocuments.length > 0
            ? 'Additional admission document slots appear here once admissions configures requirements for your selected programmes.'
            : 'No admission document requirements are configured for your selected programmes yet. Qualification files you upload during Academic Details appear above once saved.'}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {requirements.map((req) => {
            const key = req.offeringRequiredDocumentId
            const busy = busyKey === key
            const canUpload = req.status === 'NOT_SUBMITTED' || req.status === 'RESUBMISSION_REQUIRED'
            const canReplace =
              !!req.document?.id &&
              (req.status === 'SUBMITTED' || req.status === 'RESUBMISSION_REQUIRED')
            const action: 'upload' | 'replace' =
              req.status === 'NOT_SUBMITTED' || !req.document?.id ? 'upload' : 'replace'

            return (
              <li
                key={key}
                className={`rounded-lg border px-4 py-3 ${
                  req.status === 'RESUBMISSION_REQUIRED'
                    ? 'border-[#fecaca] bg-[#fffafa]'
                    : 'border-[#e8edf5] bg-[#f8faff]'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[#071759]">{req.documentTypeName}</p>
                      {req.mandatory ? (
                        <span className="rounded bg-[#fee2e2] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#b91c1c]">
                          Required
                        </span>
                      ) : (
                        <span className="rounded bg-[#e2e8f0] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#475569]">
                          Optional
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles(req.status)}`}
                      >
                        {statusLabel(req.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#6374ab]">
                      {req.documentTypeCode}
                      {req.conditionCode ? ` · ${req.conditionCode}` : ''}
                    </p>
                    {req.document?.fileName ? (
                      <p className="mt-1 text-xs text-[#354a8d]">
                        File:{' '}
                        {req.document.downloadUrl ? (
                          <a
                            href={req.document.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#0c3cff] underline-offset-2 hover:underline"
                          >
                            {req.document.fileName}
                          </a>
                        ) : (
                          req.document.fileName
                        )}
                      </p>
                    ) : null}
                    {req.status === 'RESUBMISSION_REQUIRED' && req.document?.resubmissionReason ? (
                      <p className="mt-2 text-sm text-[#991b1b]">
                        <span className="font-semibold">Objection: </span>
                        {req.document.resubmissionReason}
                      </p>
                    ) : null}
                  </div>

                  {(canUpload || canReplace) && req.status !== 'VERIFIED' ? (
                    <div>
                      <input
                        ref={(el) => {
                          inputRefs.current[key] = el
                        }}
                        type="file"
                        accept=".jpg,.jpeg,.png,.gif,.bmp,.pdf,image/*,application/pdf"
                        className="hidden"
                        onChange={(e) =>
                          void handleFile(key, e.target.files?.[0], action, req)
                        }
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => inputRefs.current[key]?.click()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c9d4ef] bg-white px-3 text-xs font-medium text-[#071759] hover:bg-[#f8faff] disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : action === 'replace' ? (
                          <RefreshCw className="h-3.5 w-3.5" />
                        ) : (
                          <FileUp className="h-3.5 w-3.5" />
                        )}
                        {action === 'replace' ? 'Replace file' : 'Upload file'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
