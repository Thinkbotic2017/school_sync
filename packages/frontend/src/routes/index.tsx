import React, { useEffect, useState } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { AcademicYearListPage } from '@/pages/academic/AcademicYearListPage';
import { ClassListPage } from '@/pages/academic/ClassListPage';
import { SectionListPage } from '@/pages/academic/SectionListPage';
import { SubjectListPage } from '@/pages/academic/SubjectListPage';
import { StudentListPage } from '@/pages/students/StudentListPage';
import { StudentFormPage } from '@/pages/students/StudentFormPage';
import { StudentDetailPage } from '@/pages/students/StudentDetailPage';
import { BulkImportPage } from '@/pages/students/BulkImportPage';
import { LiveMonitorPage } from '@/pages/attendance/LiveMonitorPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { AttendanceReportsPage } from '@/pages/attendance/AttendanceReportsPage';
import { FeeStructuresPage } from '@/pages/finance/FeeStructuresPage';
import { FeePaymentsPage } from '@/pages/finance/FeePaymentsPage';
import { FinancialReportsPage } from '@/pages/finance/FinancialReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { SetupWizardPage } from '@/pages/setup/SetupWizardPage';
import { useAuthStore } from '@/store/auth.store';
import { setupApi } from '@/services/setup.service';

// ─── Guest route (redirect if already authenticated) ─────────────────────────

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ─── Protected route ──────────────────────────────────────────────────────────
// Checks auth, then checks setup status.
// /setup is exempt from the setupComplete redirect to avoid recursion.

function ProtectedRoute({ children, skipSetupCheck = false }: { children: React.ReactNode; skipSetupCheck?: boolean }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupComplete, setSetupComplete] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || skipSetupCheck) {
      setSetupChecked(true);
      return;
    }

    setupApi
      .getStatus()
      .then((res) => {
        setSetupComplete(res.setupComplete);
      })
      .catch(() => {
        // If the endpoint fails (e.g. not yet implemented), treat as complete
        setSetupComplete(true);
      })
      .finally(() => setSetupChecked(true));
  }, [isAuthenticated, skipSetupCheck, location.pathname]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!setupChecked) return null; // brief blank while checking
  if (!setupComplete && !skipSetupCheck) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    element: (
      <GuestRoute>
        <AuthLayout />
      </GuestRoute>
    ),
    children: [
      { path: '/login', element: <LoginPage /> },
    ],
  },
  // Setup wizard — needs auth but is exempt from the setupComplete redirect
  {
    path: '/setup',
    element: (
      <ProtectedRoute skipSetupCheck>
        <SetupWizardPage />
      </ProtectedRoute>
    ),
  },
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/academic-years', element: <AcademicYearListPage /> },
      { path: '/classes', element: <ClassListPage /> },
      { path: '/sections', element: <SectionListPage /> },
      { path: '/subjects', element: <SubjectListPage /> },
      { path: '/students', element: <StudentListPage /> },
      { path: '/students/new', element: <StudentFormPage /> },
      { path: '/students/bulk-import', element: <BulkImportPage /> },
      { path: '/students/:id', element: <StudentDetailPage /> },
      { path: '/students/:id/edit', element: <StudentFormPage /> },
      { path: '/attendance', element: <AttendancePage /> },
      { path: '/attendance/live', element: <LiveMonitorPage /> },
      { path: '/attendance/reports', element: <AttendanceReportsPage /> },
      { path: '/finance/fee-structures', element: <FeeStructuresPage /> },
      { path: '/finance/payments', element: <FeePaymentsPage /> },
      { path: '/finance/reports', element: <FinancialReportsPage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
