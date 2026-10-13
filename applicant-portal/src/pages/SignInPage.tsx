import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  LineChart,
  Loader2,
  Lock,
  Mail,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { listMyApplications } from '@/lib/api/my-applications'
import {
  getApplicationBindingForIntake,
  getLatestApplicationBinding,
} from '@/lib/application-session'

function applicationIdFromPath(path: string): string | null {
  const match = path.match(/^\/applications\/([0-9a-f-]{36})(?:\/|$)/i)
  return match?.[1] ?? null
}

async function resolvePostLoginPath(from: string, email: string): Promise<string> {
  const applyMatch = from.match(/^\/apply\/([^/?]+)/)
  if (applyMatch?.[1]) {
    const binding = getApplicationBindingForIntake(email, applyMatch[1])
    if (binding) return `/applications/${binding.applicantId}`
  }

  const fromAppId = applicationIdFromPath(from)
  let ownedIds: string[] = []
  try {
    const apps = await listMyApplications()
    ownedIds = apps.map(app => app.applicantId)
  } catch {
    const latest = getLatestApplicationBinding(email)
    if (latest) ownedIds = [latest.applicantId]
  }

  if (fromAppId) {
    if (ownedIds.includes(fromAppId)) return from
    // Stale/foreign application deep-link — land on owned app or inbox.
    if (from.includes('/admit-card') && ownedIds[0]) {
      return `/applications/${ownedIds[0]}/admit-card`
    }
    if (ownedIds[0]) return `/applications/${ownedIds[0]}`
    return '/my-application'
  }

  if (from === '/' || from === '') {
    const latest = getLatestApplicationBinding(email)
    if (latest) return `/applications/${latest.applicantId}`
    if (ownedIds[0]) return `/applications/${ownedIds[0]}`
  }

  return from || '/'
}

type FieldErrors = {
  email?: string
  password?: string
  form?: string
}

export function SignInPage() {
  const { isAuthenticated, login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    // Avoid restoring a stale/foreign application deep-link (e.g. admit-card).
    const fromAppId = applicationIdFromPath(from)
    if (fromAppId && user?.applicantId && fromAppId === user.applicantId) {
      return <Navigate to={from} replace />
    }
    if (fromAppId) {
      return <Navigate to="/my-application" replace />
    }
    return <Navigate to={from === '' ? '/' : from} replace />
  }

  function validate() {
    const next: FieldErrors = {}
    if (!email.trim()) next.email = 'Email address is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Enter a valid email address.'
    }
    if (!password) next.password = 'Password is required.'
    return next
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length > 0) return

    setLoading(true)
    try {
      const result = await login(email, password)
      if (!result.ok) {
        setErrors({ form: result.message })
        return
      }

      const normalizedEmail = email.trim().toLowerCase()
      const nextPath = await resolvePostLoginPath(from, normalizedEmail)
      navigate(nextPath, { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const showError = (field: keyof FieldErrors) => (submitted || touched[field]) && errors[field]

  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <section
        className="relative hidden overflow-hidden bg-cover bg-center lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-12"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgb(7 23 89 / 0.35), rgb(7 23 89 / 0.72)), url('https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1600&q=80')",
        }}
      >
        <div />
        <div className="max-w-md text-white">
          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
            Learn Grow{' '}
            <span style={{ fontFamily: 'Georgia, "Times New Roman", serif' }} className="italic">
              Belong
            </span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/90 xl:text-base">
            Join a diverse and innovative learning environment with industry-focused programmes and
            experienced faculty.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-white">
          <Feature icon={<GraduationCap className="h-5 w-5" />} label="Quality Education" />
          <Feature icon={<Users className="h-5 w-5" />} label="Supportive Community" />
          <Feature icon={<LineChart className="h-5 w-5" />} label="Global Opportunities" />
        </div>
      </section>

      <section className="relative flex flex-col bg-[#f4f7fc] px-4 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <div className="rounded-2xl border border-[#e8edf5] bg-white px-6 py-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:px-8">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#0c3cff]">WELCOME BACK</p>
            <h2 className="mt-2 text-2xl font-bold text-[#071759] sm:text-3xl">
              Sign In to Your Account
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
              Log in to continue your application, track your progress, and manage your admissions
              journey.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[#334155]">
                  Email Address
                </label>
                <div
                  className={`flex h-11 items-center gap-2 rounded-lg border bg-white px-3 ${
                    showError('email') ? 'border-red-500' : 'border-[#dce5f6]'
                  }`}
                >
                  <Mail className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                    placeholder="Enter your registered email address"
                    className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  />
                </div>
                {showError('email') ? (
                  <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-semibold text-[#334155]"
                >
                  Password
                </label>
                <div
                  className={`flex h-11 items-center gap-2 rounded-lg border bg-white px-3 ${
                    showError('password') ? 'border-red-500' : 'border-[#dce5f6]'
                  }`}
                >
                  <Lock className="h-4 w-4 shrink-0 text-[#94a3b8]" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                    placeholder="Enter your password"
                    className="h-auto flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="text-[#64748b]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {showError('password') ? (
                  <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>
                ) : null}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled
                    title="Password reset is not available yet"
                    className="text-sm font-medium text-[#0c3cff] opacity-60"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {errors.form ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                  {errors.form}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="h-12 w-full bg-[#0c3cff] text-base font-semibold hover:bg-[#0934dc]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-8 flex items-center gap-3 text-sm text-[#6374ab]">
              <span className="h-px flex-1 bg-[#e4e9f4]" />
              OR
              <span className="h-px flex-1 bg-[#e4e9f4]" />
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#e8edf5] bg-[#f8faff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#071759]">Don&apos;t have an account yet?</p>
                <p className="mt-0.5 text-xs text-[#6374ab]">
                  Create a new application to start your admissions journey.
                </p>
              </div>
              <Link
                to="/#admissions"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#dce5f6] bg-white px-4 text-sm font-medium text-[#19316f] hover:bg-white"
              >
                Create Application
              </Link>
            </div>
          </div>

          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#0c3cff] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admissions
          </Link>
        </div>
      </section>
    </div>
  )
}

function Feature({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-white/95">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/15">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  )
}
