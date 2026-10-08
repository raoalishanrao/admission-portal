import { Outlet } from 'react-router-dom'
import { SiteHeader } from '@/components/layout/SiteHeader'

export function SiteLayout() {
  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden" data-site-header>
        <SiteHeader />
      </div>
      <Outlet />
    </div>
  )
}
