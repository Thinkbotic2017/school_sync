import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { PageHeader } from '@/components/custom/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

import {
  feeReportApi,
  CollectionSummary,
  ClassFeeSummary,
  FeeRecord,
  FeeStatus,
  StudentLedger,
} from '@/services/fee.service';
import { studentApi } from '@/services/student.service';
import { unwrapList } from '@/lib/api-helpers';
import { formatETB } from '@/utils/currency';

// ─── Status badge colors ──────────────────────────────────────────────────────

const STATUS_CLASS: Record<FeeStatus, string> = {
  PAID: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  PARTIAL: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  PENDING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  OVERDUE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  WAIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

// ─── Pie chart colours ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<FeeStatus, string> = {
  PAID: '#22c55e',
  PARTIAL: '#eab308',
  PENDING: '#3b82f6',
  OVERDUE: '#ef4444',
  WAIVED: '#9ca3af',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
      {loading ? (
        <Skeleton className="h-8 w-28 mt-2" />
      ) : (
        <p className="text-2xl font-bold mt-2 text-foreground">{value}</p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FinancialReportsPage() {
  const { t } = useTranslation();
  const [ledgerStudentId, setLedgerStudentId] = React.useState('');
  const [studentSearch, setStudentSearch] = React.useState('');

  // ── Collection Summary ────────────────────────────────────────────────────

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['fee-reports', 'collection-summary'],
    queryFn: () => feeReportApi.collectionSummary(),
  });
  const summary: CollectionSummary | null =
    (summaryRes as any)?.data?.data ?? null;

  // ── Class Summary ─────────────────────────────────────────────────────────

  const { data: classSummaryRes, isLoading: classLoading } = useQuery({
    queryKey: ['fee-reports', 'class-summary'],
    queryFn: () => feeReportApi.classSummary(),
  });
  const classSummary: ClassFeeSummary[] =
    (classSummaryRes as any)?.data?.data ?? [];

  // ── Overdue Report ────────────────────────────────────────────────────────

  const { data: overdueRes, isLoading: overdueLoading } = useQuery({
    queryKey: ['fee-reports', 'overdue'],
    queryFn: () => feeReportApi.overdueReport(),
  });
  const overdueRecords: Array<FeeRecord & { daysOverdue: number; balance: number }> =
    (overdueRes as any)?.data?.data ?? [];

  // ── Student search for ledger ─────────────────────────────────────────────

  const { data: studentsRes } = useQuery({
    queryKey: ['students', 'search', studentSearch],
    queryFn: () =>
      studentApi.list({ search: studentSearch, limit: 10, page: 1 }),
    enabled: studentSearch.length > 1,
  });
  const { data: studentOptions } = unwrapList<{
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  }>(studentsRes);

  // ── Ledger ────────────────────────────────────────────────────────────────

  const { data: ledgerRes, isLoading: ledgerLoading } = useQuery({
    queryKey: ['fee-reports', 'ledger', ledgerStudentId],
    queryFn: () => feeReportApi.studentLedger(ledgerStudentId),
    enabled: !!ledgerStudentId,
  });
  const ledger: StudentLedger | null = (ledgerRes as any)?.data?.data ?? null;

  // ── Pie chart data ────────────────────────────────────────────────────────

  const pieData = summary
    ? (
        [
          'PAID',
          'PARTIAL',
          'PENDING',
          'OVERDUE',
          'WAIVED',
        ] as FeeStatus[]
      )
        .filter((s) => (summary.statusBreakdown?.[s] ?? 0) > 0)
        .map((s) => ({
          name: t(`finance.status.${s}`),
          value: summary.statusBreakdown?.[s] ?? 0,
          color: STATUS_COLORS[s],
        }))
    : [];

  // ── Bar chart data ────────────────────────────────────────────────────────

  const barData = classSummary.map((cs) => ({
    name: cs.className,
    pct: Math.round(cs.collectionPercentage),
  }));

  // ── Overdue columns ───────────────────────────────────────────────────────

  const overdueColumns: ColumnDef<FeeRecord & { daysOverdue: number; balance: number }>[] =
    [
      {
        id: 'student',
        header: t('finance.reports.overdue_student'),
        cell: ({ row }) => {
          const s = row.original.student;
          return (
            <div>
              <p className="text-sm font-medium">
                {s ? `${s.firstName} ${s.lastName}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">{s?.admissionNumber}</p>
            </div>
          );
        },
      },
      {
        id: 'feeType',
        header: t('finance.reports.overdue_fee'),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.feeStructure?.name ?? '—'}</span>
        ),
      },
      {
        id: 'amount',
        header: t('finance.reports.overdue_amount'),
        cell: ({ row }) => (
          <span className="text-sm font-mono">{formatETB(row.original.balance)}</span>
        ),
      },
      {
        id: 'dueDate',
        header: t('finance.reports.overdue_due_date'),
        cell: ({ row }) => (
          <span className="text-sm">
            {new Date(row.original.dueDate).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'daysOverdue',
        header: t('finance.reports.overdue_days'),
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
            {row.original.daysOverdue}
          </span>
        ),
      },
    ];

  // ── Class summary columns ─────────────────────────────────────────────────

  const classColumns: ColumnDef<ClassFeeSummary>[] = [
    {
      id: 'class',
      header: t('finance.reports.class_name'),
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.className}</span>
      ),
    },
    {
      id: 'students',
      header: t('finance.reports.total_students'),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.totalStudents}</span>
      ),
    },
    {
      id: 'collected',
      header: t('finance.reports.collected'),
      cell: ({ row }) => (
        <span className="text-sm font-mono">{formatETB(row.original.collected)}</span>
      ),
    },
    {
      id: 'outstanding',
      header: t('finance.reports.outstanding'),
      cell: ({ row }) => (
        <span className="text-sm font-mono">{formatETB(row.original.outstanding)}</span>
      ),
    },
    {
      id: 'pct',
      header: t('finance.reports.collection_pct'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${Math.min(row.original.collectionPercentage, 100)}%` }}
            />
          </div>
          <span className="text-sm font-semibold">
            {row.original.collectionPercentage.toFixed(1)}%
          </span>
        </div>
      ),
    },
  ];

  // ── Ledger columns ────────────────────────────────────────────────────────

  type LedgerRow = FeeRecord & { balance: number; runningBalance: number };

  const ledgerColumns: ColumnDef<LedgerRow>[] = [
    {
      id: 'feeType',
      header: t('finance.payments.fee_type'),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.feeStructure?.name ?? '—'}</span>
      ),
    },
    {
      id: 'amount',
      header: t('finance.payments.total_amount'),
      cell: ({ row }) => (
        <span className="text-sm font-mono">{formatETB(row.original.amount)}</span>
      ),
    },
    {
      id: 'paid',
      header: t('finance.payments.paid_amount'),
      cell: ({ row }) => (
        <span className="text-sm font-mono">{formatETB(row.original.paidAmount)}</span>
      ),
    },
    {
      id: 'balance',
      header: t('finance.payments.balance'),
      cell: ({ row }) => (
        <span className="text-sm font-mono">{formatETB(row.original.balance)}</span>
      ),
    },
    {
      id: 'dueDate',
      header: t('finance.payments.due_date'),
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.dueDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('finance.payments.status'),
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[row.original.status]}`}
        >
          {t(`finance.status.${row.original.status}`)}
        </span>
      ),
    },
    {
      id: 'runningBalance',
      header: t('finance.reports.ledger_running_balance'),
      cell: ({ row }) => (
        <span className="text-sm font-mono font-semibold">
          {formatETB(row.original.runningBalance)}
        </span>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('finance.reports.title')}
        description={t('finance.reports.description')}
      />

      <Tabs defaultValue="collection">
        <TabsList>
          <TabsTrigger value="collection">{t('finance.reports.collection_tab')}</TabsTrigger>
          <TabsTrigger value="class">{t('finance.reports.class_tab')}</TabsTrigger>
          <TabsTrigger value="overdue">{t('finance.reports.overdue_tab')}</TabsTrigger>
          <TabsTrigger value="ledger">{t('finance.reports.ledger_tab')}</TabsTrigger>
        </TabsList>

        {/* ── Collection Summary Tab ── */}
        <TabsContent value="collection" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              label={t('finance.reports.total_generated')}
              value={formatETB(summary?.totalGenerated)}
              loading={summaryLoading}
            />
            <KpiCard
              label={t('finance.reports.total_collected')}
              value={formatETB(summary?.totalCollected)}
              loading={summaryLoading}
            />
            <KpiCard
              label={t('finance.reports.total_outstanding')}
              value={formatETB(summary?.totalOutstanding)}
              loading={summaryLoading}
            />
            <KpiCard
              label={t('finance.reports.total_waived')}
              value={formatETB(summary?.totalWaived)}
              loading={summaryLoading}
            />
            <KpiCard
              label={t('finance.reports.collection_pct')}
              value={`${summary?.collectionPercentage?.toFixed(1) ?? '0.0'}%`}
              loading={summaryLoading}
            />
          </div>

          {summaryLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : pieData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('finance.reports.chart_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [value, t('finance.payments.total_amount')]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t('finance.reports.no_data')}
            </p>
          )}
        </TabsContent>

        {/* ── Class Summary Tab ── */}
        <TabsContent value="class" className="space-y-6 mt-4">
          {classLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : classSummary.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('finance.reports.class_tab')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        unit="%"
                        domain={[0, 100]}
                        className="text-muted-foreground"
                      />
                      <Tooltip formatter={(v: number) => [`${v}%`, t('finance.reports.collection_pct')]} />
                      <Bar dataKey="pct" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <DataTable<ClassFeeSummary>
                columns={classColumns}
                data={classSummary}
                isLoading={classLoading}
                emptyMessage={t('finance.reports.class_empty')}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t('finance.reports.class_empty')}
            </p>
          )}
        </TabsContent>

        {/* ── Overdue Tab ── */}
        <TabsContent value="overdue" className="mt-4">
          <DataTable<FeeRecord & { daysOverdue: number; balance: number }>
            columns={overdueColumns}
            data={overdueRecords}
            isLoading={overdueLoading}
            emptyMessage={t('finance.reports.overdue_empty')}
          />
        </TabsContent>

        {/* ── Student Ledger Tab ── */}
        <TabsContent value="ledger" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 max-w-sm space-y-1">
              <Input
                placeholder={t('finance.reports.ledger_select_student')}
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              {studentOptions && studentOptions.length > 0 && studentSearch.length > 1 && (
                <div className="rounded-md border bg-popover shadow-md overflow-hidden">
                  {studentOptions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        setLedgerStudentId(s.id);
                        setStudentSearch(`${s.firstName} ${s.lastName}`);
                      }}
                    >
                      {s.firstName} {s.lastName}
                      <span className="text-muted-foreground ml-2 text-xs">
                        #{s.admissionNumber}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {ledgerStudentId && (
            <>
              {ledgerLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : ledger ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <KpiCard
                      label={t('finance.reports.ledger_total_fees')}
                      value={formatETB(ledger.summary.totalFees)}
                    />
                    <KpiCard
                      label={t('finance.reports.ledger_total_paid')}
                      value={formatETB(ledger.summary.totalPaid)}
                    />
                    <KpiCard
                      label={t('finance.reports.ledger_outstanding')}
                      value={formatETB(ledger.summary.outstanding)}
                    />
                  </div>

                  <DataTable<LedgerRow>
                    columns={ledgerColumns}
                    data={ledger.records}
                    isLoading={false}
                    emptyMessage={t('finance.reports.ledger_empty')}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  {t('finance.reports.ledger_empty')}
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
