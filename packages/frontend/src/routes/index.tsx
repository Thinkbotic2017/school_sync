import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
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
import { useAuthStore } from '@/store/auth.store';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
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
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
