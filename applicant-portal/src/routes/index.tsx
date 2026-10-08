import { createBrowserRouter, Navigate } from 'react-router-dom'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { AdmitCardPage } from '@/pages/AdmitCardPage'
import { AdmissionsPage } from '@/pages/AdmissionsPage'
import { ApplicationFlowPage } from '@/pages/ApplicationFlowPage'
import { ApplicationSuccessPage } from '@/pages/ApplicationSuccessPage'
import { CreateApplicationPage } from '@/pages/CreateApplicationPage'
import { IntakeDetailPage } from '@/pages/IntakeDetailPage'
import { MyApplicationPage } from '@/pages/MyApplicationPage'
import { OfferingDetailPage } from '@/pages/OfferingDetailPage'
import { ProcessingFeeChallanPage } from '@/pages/ProcessingFeeChallanPage'
import { OfferFeeChallanPage } from '@/pages/OfferFeeChallanPage'
import { OfferPage } from '@/pages/OfferPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { SetPasswordPage } from '@/pages/SetPasswordPage'
import { SignInPage } from '@/pages/SignInPage'
import { SubmittedApplicationPage } from '@/pages/SubmittedApplicationPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <SiteLayout />,
    children: [
      { index: true, element: <AdmissionsPage /> },
      { path: 'intakes/:intakeId', element: <IntakeDetailPage /> },
      { path: 'offerings/:offeringId', element: <OfferingDetailPage /> },
      { path: 'apply/:intakeId', element: <CreateApplicationPage /> },
      { path: 'my-application', element: <MyApplicationPage /> },
      { path: 'results', element: <ResultsPage /> },
      { path: 'offer', element: <OfferPage /> },
      { path: 'applications/:applicantId', element: <ApplicationFlowPage /> },
      { path: 'applications/:applicantId/view', element: <SubmittedApplicationPage /> },
      { path: 'applications/:applicantId/success', element: <ApplicationSuccessPage /> },
      {
        path: 'applications/:applicantId/processing-fee/challan',
        element: <ProcessingFeeChallanPage />,
      },
      {
        path: 'applications/:applicantId/admit-card',
        element: <AdmitCardPage />,
      },
      {
        path: 'applications/:applicantId/offer-fee/challan',
        element: <OfferFeeChallanPage />,
      },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'set-password', element: <SetPasswordPage /> },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'admissions', element: <Navigate to="/" replace /> },
      { path: 'admissions/offerings/:offeringId', element: <OfferingDetailPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
