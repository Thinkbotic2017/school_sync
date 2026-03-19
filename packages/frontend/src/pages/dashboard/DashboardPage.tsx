import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const name = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.welcome', { name })}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t('dashboard.overview')}</p>
      </div>

      {/* Placeholder KPI cards — will be implemented in Phase 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['Total Students', 'Total Staff', 'Attendance %', 'Fee Collection %'].map((label) => (
          <div
            key={label}
            className="rounded-lg border bg-card p-5 shadow-sm"
          >
            <p className="text-sm text-muted-foreground font-medium">{label}</p>
            <p className="text-3xl font-bold mt-2 text-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-1">No data yet</p>
          </div>
        ))}
      </div>
    </div>
  );
}
