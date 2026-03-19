import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-amber-500 flex items-center justify-center mb-3 shadow-lg shadow-amber-500/25">
            <span className="text-2xl font-bold text-slate-900">S</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">SchoolSync</h1>
          <p className="text-sm text-slate-400 mt-0.5">School Management Platform</p>
        </div>
        <Outlet />
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
