import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api/client'
import { startOfferingApplication } from '@/lib/api/admissions'
import {
  applicationPath,
  getActiveApplication,
} from '@/lib/application-session'
import { cn } from '@/lib/utils'

type Props = {
  intakeId: string
  offeringId?: string
  className?: string
  size?: 'sm' | 'default'
  createLabel?: string
  continueLabel?: string
}

export function ApplyOrContinueButton({
  intakeId,
  offeringId,
  className,
  size = 'default',
  createLabel = 'Create Application',
  continueLabel = 'Continue Application',
}: Props) {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const active =
    isAuthenticated && user ? getActiveApplication(user.email) : null

  const createTo = offeringId
    ? `/apply/${intakeId}?offeringId=${encodeURIComponent(offeringId)}`
    : `/apply/${intakeId}`

  const to = active ? applicationPath(active.applicantId, offeringId) : createTo
  const label = active ? continueLabel : createLabel

  const needsHandoff =
    isAuthenticated && !active && !!offeringId

  async function handleStart() {
    if (!offeringId) {
      navigate(createTo)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await startOfferingApplication(offeringId)
      navigate(createTo)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Unable to start application for this programme.',
      )
    } finally {
      setBusy(false)
    }
  }

  const buttonClass = cn(
    'inline-flex items-center justify-center rounded-lg bg-[#0c3cff] font-medium text-white hover:bg-[#0934dc] disabled:opacity-60',
    size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-5 text-sm',
    className,
  )

  if (needsHandoff) {
    return (
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleStart()}
          className={buttonClass}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking…
            </>
          ) : (
            label
          )}
        </button>
        {error ? (
          <p className="max-w-xs text-right text-xs text-red-600">{error}</p>
        ) : null}
      </div>
    )
  }

  return (
    <Link to={to} className={buttonClass}>
      {label}
    </Link>
  )
}
