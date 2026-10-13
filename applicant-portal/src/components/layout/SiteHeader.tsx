import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useAuth } from '@/context/AuthContext'
import { getActiveApplication } from '@/lib/application-session'
import { UNIVERSITY_LOGO_URL } from '@/lib/brand-assets'
import { getInitials } from '@/lib/auth'

const navLinkClass = (active: boolean) =>
  `px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? 'border-b-2 border-[#0c3cff] text-[#0c3cff]'
      : 'text-[#4a5d8f] hover:text-[#071759] dark:text-[#9eb0d8] dark:hover:text-[#e8eef8]'
  }`

export function SiteHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const activeApp =
    isAuthenticated && user ? getActiveApplication(user.email) : null
  const admitCardApplicantId = user?.applicantId || activeApp?.applicantId || ''
  const onHome = location.pathname === '/'
  const onAbout = location.pathname.startsWith('/about')
  const onFaq = location.pathname.startsWith('/faq')
  const onMyApplication =
    location.pathname.startsWith('/my-application') ||
    location.pathname.startsWith('/applications')
  const onResults = location.pathname.startsWith('/results')
  const onOffer = location.pathname.startsWith('/offer')
  const onAdmitCard = location.pathname.includes('/admit-card')
  const onAdmissions =
    !onHome &&
    !onAbout &&
    !onFaq &&
    !onMyApplication &&
    !onResults &&
    !onOffer &&
    !onAdmitCard &&
    (location.pathname.startsWith('/intakes') ||
      location.pathname.startsWith('/offerings') ||
      location.pathname.startsWith('/apply'))

  function handleLogout() {
    logout()
    navigate('/sign-in', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#e8eef8] bg-white dark:border-[#243044] dark:bg-[#0f1729]">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src={UNIVERSITY_LOGO_URL}
            alt="Iqra University"
            className="h-10 w-auto max-w-[220px] object-contain object-left sm:h-11 sm:max-w-[260px]"
          />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex">
          <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
            Home
          </NavLink>
          <a href="/#admissions" className={navLinkClass(onAdmissions)}>
            Admissions
          </a>
          <a href="/#programmes" className={navLinkClass(false)}>
            Programmes
          </a>
          <NavLink
            to="/about"
            className={({ isActive }) => navLinkClass(isActive || onAbout)}
          >
            About Us
          </NavLink>
          <NavLink
            to="/faq"
            className={({ isActive }) => navLinkClass(isActive || onFaq)}
          >
            FAQ
          </NavLink>
          {isAuthenticated ? (
            <>
              <NavLink
                to="/my-application"
                className={({ isActive }) =>
                  navLinkClass(isActive || onMyApplication)
                }
              >
                My Application
              </NavLink>
              <NavLink
                to="/results"
                className={({ isActive }) => navLinkClass(isActive || onResults)}
              >
                Results
              </NavLink>
              <NavLink
                to="/offer"
                className={({ isActive }) => navLinkClass(isActive || onOffer)}
              >
                Offer
              </NavLink>
              {admitCardApplicantId ? (
                <NavLink
                  to={`/applications/${admitCardApplicantId}/admit-card`}
                  className={({ isActive }) =>
                    navLinkClass(isActive || onAdmitCard)
                  }
                >
                  Admit card
                </NavLink>
              ) : null}
            </>
          ) : null}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {isAuthenticated && user ? (
            <>
              <Link
                to="/my-application"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-[#c5d0ea] px-3 text-sm font-medium text-[#19316f] hover:bg-[#f8faff] dark:border-[#334155] dark:text-[#e8eef8] dark:hover:bg-[#1a2438] lg:hidden"
              >
                My App
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-9 items-center gap-2 rounded-md px-1.5 text-sm font-medium text-[#19316f] hover:bg-[#f8faff] dark:text-[#e8eef8] dark:hover:bg-[#1a2438] sm:px-2"
                title="Log out"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#edf3ff] text-xs font-semibold text-[#0c3cff] dark:bg-[#1e3a5f]">
                  {getInitials(user.name) || 'A'}
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <LogOut className="h-4 w-4" />
                  Log out
                </span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/sign-in"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-md border border-[#0c3cff] px-3 text-sm font-semibold text-[#0c3cff] hover:bg-[#f8faff] dark:hover:bg-[#1a2438] sm:px-4"
              >
                Sign In
              </Link>
              <Link
                to="/#admissions"
                className="inline-flex h-9 items-center whitespace-nowrap rounded-md bg-[#0c3cff] px-3 text-sm font-semibold text-white hover:bg-[#0934dc] sm:px-4"
              >
                Create Application
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
