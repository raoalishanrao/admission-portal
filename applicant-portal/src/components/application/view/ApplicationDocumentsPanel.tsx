import { useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import {
  replaceApplicantDocument,
  uploadApplicantDocument,
} from '@/lib/api/documents'
import type {
  AdmissionDocumentStatus,
  ApplicantDocumentRequirement,
  DocumentCompleteness,
} from '@/lib/api/types'

type Props = {
  applicantId: string
  requirements: ApplicantDocumentRequirement[]
  completeness: DocumentCompleteness | null
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

export function ApplicationDocumentsPanel({
  applicantId,
  requirements,
  completeness,
  onChanged,
}: Props) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

  const outstanding = requirements.filter((r) => r.status === 'RESUBMISSION_REQUIRED')

  return (
    <section className="rounded-xl border border-[#e4e9f4] bg-white px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#071759]">Admission documents</h2>
          <p className="mt-1 text-sm text-[#6374ab]">
            Upload required documents for each slot below. If admissions requests a
            correction, replace the file using the reason shown.
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

      {requirements.length === 0 ? (
        <p className="mt-6 text-sm text-[#6374ab]">
          No admission document requirements are configured for your selected
          programmes yet.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {requirements.map((req) => {
            const key = req.offeringRequiredDocumentId
            const busy = busyKey === key
            const canUpload =
              req.status === 'NOT_SUBMITTED' || req.status === 'RESUBMISSION_REQUIRED'
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
                    {req.conditionCode ? (
                      <p className="mt-1 text-xs text-[#6374ab]">{req.conditionCode}</p>
                    ) : null}
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
                    {req.status === 'RESUBMISSION_REQUIRED' &&
                    req.document?.resubmissionReason ? (
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
