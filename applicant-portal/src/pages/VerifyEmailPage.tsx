import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'

type LocationState = {
  email?: string
  applicationReference?: string
  verificationEmailSent?: boolean
  intakeName?: string
}

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? {}
  const token = searchParams.get('token')

  if (token) {
    return <Navigate to={`/set-password?token=${encodeURIComponent(token)}`} replace />
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <div className="rounded-xl border border-[#e4e9f4] bg-white px-6 py-10">
        <h1 className="text-2xl font-bold text-[#071759]">Check your email</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#354a8d]">
          {state.verificationEmailSent === false
            ? 'Your application was created, but the verification email could not be sent. Please contact support.'
            : `We sent a verification link${state.email ? ` to ${state.email}` : ''}. Open that link to set your password and activate your account.`}
        </p>
        {state.applicationReference ? (
          <p className="mt-4 rounded-lg bg-[#f8faff] px-3 py-2 text-sm text-[#19316f]">
            Application reference: <strong>{state.applicationReference}</strong>
          </p>
        ) : null}
        {state.intakeName ? (
          <p className="mt-3 text-xs text-[#6374ab]">{state.intakeName}</p>
        ) : null}
        <Link
          to="/sign-in"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-[#0c3cff] px-5 text-sm font-medium text-white hover:bg-[#0934dc]"
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  )
}
