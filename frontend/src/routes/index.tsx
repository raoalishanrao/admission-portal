import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { IntakesPage } from '@/pages/IntakesPage'
import { IntakeCreatePage } from '@/pages/IntakeCreatePage'
import { IntakeConfigurePage } from '@/pages/IntakeConfigurePage'
import { IntakeReviewPage } from '@/pages/IntakeReviewPage'
import { DepartmentsPage } from '@/pages/DepartmentsPage'
import { DepartmentDetailPage } from '@/pages/DepartmentDetailPage'
import { ProgrammesPage } from '@/pages/ProgrammesPage'
import { AdmissionCriteriaPage } from '@/pages/AdmissionCriteriaPage'
import { ApplicationFeesPage } from '@/pages/ApplicationFeesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AuditActivityPage } from '@/pages/AuditActivityPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AttendanceQrPage } from '@/pages/AttendanceQrPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { path: 'attendance/qr/:qrToken', element: <AttendanceQrPage /> },
      {
        element: <AppLayout />,
        children: [
      { index: true, element: <Navigate to="/intakes" replace /> },
      { path: 'dashboard', element: <Navigate to="/intakes" replace /> },
      { path: 'intakes', element: <IntakesPage /> },
      { path: 'intakes/create/:step', element: <IntakeCreatePage /> },
      { path: 'intakes/:intakeId/configure/:step', element: <IntakeConfigurePage /> },
      { path: 'intakes/:intakeId/review', element: <IntakeReviewPage /> },
      { path: 'catalog/departments', element: <DepartmentsPage /> },
      { path: 'catalog/departments/:departmentId', element: <DepartmentDetailPage /> },
      { path: 'catalog/programmes', element: <ProgrammesPage /> },
      { path: 'configuration/admission-criteria', element: <AdmissionCriteriaPage /> },
      { path: 'configuration/application-fees', element: <ApplicationFeesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'audit-activity', element: <AuditActivityPage /> },
      { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
