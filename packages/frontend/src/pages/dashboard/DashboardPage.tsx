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
        {([
          'dashboard.kpi_total_students',
          'dashboard.kpi_total_staff',
          'dashboard.kpi_attendance',
          'dashboard.kpi_fee_collection',
        ] as const).map((key) => (
          <div
            key={key}
            className="rounded-lg border bg-card p-5 shadow-sm"
          >
            <p className="text-sm text-muted-foreground font-medium">{t(key)}</p>
            <p className="text-3xl font-bold mt-2 text-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-1">{t('dashboard.no_data_yet')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
