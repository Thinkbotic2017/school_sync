import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/custom/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  feeRecordApi,
  feeStructureApi,
  FeeRecord,
  FeeStatus,
  FeeStructure,
  PaymentMethod,
} from '@/services/fee.service';
import { classApi, Class } from '@/services/academic.service';
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

const PAYMENT_METHODS: { value: PaymentMethod; labelKey: string }[] = [
  { value: 'CASH', labelKey: 'finance.payments.method_cash' },
  { value: 'BANK_TRANSFER', labelKey: 'finance.payments.method_bank_transfer' },
  { value: 'MOBILE_MONEY', labelKey: 'finance.payments.method_mobile_money' },
  { value: 'CHEQUE', labelKey: 'finance.payments.method_cheque' },
  { value: 'OTHER', labelKey: 'finance.payments.method_other' },
];

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Must be positive'),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'OTHER']),
  receiptNumber: z.string().optional(),
  remarks: z.string().optional(),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

const waiveSchema = z.object({
  reason: z.string().min(1, 'Required'),
  approvedById: z.string().min(1, 'Required'),
});
type WaiveFormValues = z.infer<typeof waiveSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function FeePaymentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [classFilter, setClassFilter] = React.useState('all');
  const [feeTypeFilter, setFeeTypeFilter] = React.useState('all');

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [paymentRecord, setPaymentRecord] = React.useState<FeeRecord | null>(null);
  const [waiveRecord, setWaiveRecord] = React.useState<FeeRecord | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  const queryParams: Record<string, string | number | undefined> = {
    page,
    limit: 20,
    ...(search ? { search } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(classFilter !== 'all' ? { classId: classFilter } : {}),
    ...(feeTypeFilter !== 'all' ? { feeStructureId: feeTypeFilter } : {}),
  };

  const { data: recordsRes, isLoading } = useQuery({
    queryKey: ['fee-records', queryParams],
    queryFn: () => feeRecordApi.list(queryParams),
  });
  const { data: records, meta } = unwrapList<FeeRecord>(recordsRes);

  const { data: classesRes } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => classApi.list({ limit: 200 }),
  });
  const { data: classes } = unwrapList<Class>(classesRes);

  const { data: structuresRes } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => feeStructureApi.list({ limit: 100 }),
  });
  const { data: feeStructures } = unwrapList<FeeStructure>(structuresRes);

  // ── Forms ─────────────────────────────────────────────────────────────────

  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentMethod: 'CASH' },
  });

  const waiveForm = useForm<WaiveFormValues>({
    resolver: zodResolver(waiveSchema),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const payMutation = useMutation({
    mutationFn: (values: PaymentFormValues) =>
      feeRecordApi.pay(paymentRecord!.id, {
        amount: values.amount,
        paymentMethod: values.paymentMethod,
        receiptNumber: values.receiptNumber || undefined,
        remarks: values.remarks || undefined,
      }),
    onSuccess: (res) => {
      const invoiceNumber =
        (res as any)?.data?.data?.invoiceNumber ?? '—';
      toast.success(t('finance.payments.payment_saved', { invoice: invoiceNumber }));
      queryClient.invalidateQueries({ queryKey: ['fee-records'] });
      setPaymentRecord(null);
      paymentForm.reset({ paymentMethod: 'CASH' });
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  const waiveMutation = useMutation({
    mutationFn: (values: WaiveFormValues) =>
      feeRecordApi.waive(waiveRecord!.id, values),
    onSuccess: () => {
      toast.success(t('finance.payments.waived'));
      queryClient.invalidateQueries({ queryKey: ['fee-records'] });
      setWaiveRecord(null);
      waiveForm.reset();
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearch(searchInput);
      setPage(1);
    }
  };

  const openPaymentDialog = (record: FeeRecord) => {
    const balance = parseFloat(record.amount) - parseFloat(record.paidAmount);
    setPaymentRecord(record);
    paymentForm.reset({ amount: balance > 0 ? balance : 0, paymentMethod: 'CASH' });
  };

  const openWaiveDialog = (record: FeeRecord) => {
    setWaiveRecord(record);
    waiveForm.reset();
  };

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnDef<FeeRecord>[] = [
    {
      id: 'student',
      header: t('finance.payments.student'),
      cell: ({ row }) => {
        const s = row.original.student;
        return (
          <div>
            <p className="text-sm font-medium">
              {s ? `${s.firstName} ${s.lastName}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              {s?.admissionNumber ?? ''}{s?.class?.name ? ` · ${s.class.name}` : ''}
            </p>
          </div>
        );
      },
    },
    {
      id: 'feeType',
      header: t('finance.payments.fee_type'),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.feeStructure?.name ?? '—'}</span>
      ),
    },
    {
      id: 'total',
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
      cell: ({ row }) => {
        const balance = parseFloat(row.original.amount) - parseFloat(row.original.paidAmount);
        return (
          <span className="text-sm font-mono font-semibold">
            {formatETB(balance)}
          </span>
        );
      },
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
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isPaidOrWaived =
          row.original.status === 'PAID' || row.original.status === 'WAIVED';
        return (
          <div className="flex items-center gap-1 justify-end">
            {!isPaidOrWaived && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => openPaymentDialog(row.original)}
                >
                  {t('finance.payments.record_payment')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => openWaiveDialog(row.original)}
                >
                  {t('finance.payments.waive_fee')}
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('finance.payments.title')}
        description={t('finance.payments.description')}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder={t('common.actions.search')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder={t('finance.payments.filter_status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('finance.payments.filter_status')}</SelectItem>
            {(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED'] as FeeStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {t(`finance.status.${s}`)}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>

        <Select
          value={classFilter}
          onValueChange={(v) => {
            setClassFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder={t('finance.payments.filter_class')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('finance.payments.filter_class')}</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={feeTypeFilter}
          onValueChange={(v) => {
            setFeeTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder={t('finance.payments.filter_fee_type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('finance.payments.filter_fee_type')}</SelectItem>
            {feeStructures.map((fs) => (
              <SelectItem key={fs.id} value={fs.id}>
                {fs.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable<FeeRecord>
        columns={columns}
        data={records}
        isLoading={isLoading}
        emptyMessage={t('finance.payments.empty')}
        page={page}
        totalPages={meta.totalPages}
        onPageChange={setPage}
      />

      {/* Record Payment Dialog */}
      <Dialog
        open={!!paymentRecord}
        onOpenChange={(open) => !open && setPaymentRecord(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('finance.payments.record_payment')}</DialogTitle>
          </DialogHeader>

          {paymentRecord && (
            <div className="space-y-3 mb-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.payments.student')}</span>
                  <span className="font-medium">
                    {paymentRecord.student
                      ? `${paymentRecord.student.firstName} ${paymentRecord.student.lastName}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('finance.payments.fee_type')}</span>
                  <span>{paymentRecord.feeStructure?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t('finance.payments.already_paid')}
                  </span>
                  <span>{formatETB(paymentRecord.paidAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-muted-foreground">
                    {t('finance.payments.remaining_balance')}
                  </span>
                  <span>
                    {formatETB(parseFloat(paymentRecord.amount) - parseFloat(paymentRecord.paidAmount))}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Form {...paymentForm}>
            <form
              onSubmit={paymentForm.handleSubmit((v) => payMutation.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.payment_amount')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0.01" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.payment_method')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {t(m.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="receiptNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.receipt_number')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.remarks')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentRecord(null)}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={payMutation.isPending}>
                  {payMutation.isPending
                    ? t('common.actions.loading')
                    : t('common.actions.save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Waive Fee Dialog */}
      <Dialog
        open={!!waiveRecord}
        onOpenChange={(open) => !open && setWaiveRecord(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('finance.payments.waive_fee')}</DialogTitle>
          </DialogHeader>

          <Form {...waiveForm}>
            <form
              onSubmit={waiveForm.handleSubmit((v) => waiveMutation.mutate(v))}
              className="space-y-4"
            >
              <FormField
                control={waiveForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.waive_reason')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={waiveForm.control}
                name="approvedById"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.waive_approved_by')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWaiveRecord(null)}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={waiveMutation.isPending}>
                  {waiveMutation.isPending
                    ? t('common.actions.loading')
                    : t('common.actions.confirm')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
