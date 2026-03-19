import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/custom/PageHeader';
import { ConfirmDialog } from '@/components/custom/ConfirmDialog';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { feeStructureApi, FeeStructure, FeeFrequency } from '@/services/fee.service';
import { classApi, academicYearApi, Class, AcademicYear } from '@/services/academic.service';
import { unwrapList } from '@/lib/api-helpers';
import { formatETB } from '@/utils/currency';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const feeStructureSchema = z.object({
  name: z.string().min(1, 'Required'),
  amount: z.coerce.number().positive('Must be positive'),
  frequency: z.enum(['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMESTER', 'ANNUAL']),
  classId: z.string().optional(),
  academicYearId: z.string().min(1, 'Required'),
});
type FormValues = z.infer<typeof feeStructureSchema>;

// ─── Frequency badge colors ───────────────────────────────────────────────────

const FREQ_CLASS: Record<FeeFrequency, string> = {
  ONE_TIME: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  MONTHLY: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  QUARTERLY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  SEMESTER: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  ANNUAL: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function FeeStructuresPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<FeeStructure | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<FeeStructure | null>(null);
  const [generateTarget, setGenerateTarget] = React.useState<FeeStructure | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: structuresRes, isLoading } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => feeStructureApi.list({ limit: 100 }),
  });
  const { data: structures, meta } = unwrapList<FeeStructure>(structuresRes);

  const { data: classesRes } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => classApi.list({ limit: 200 }),
  });
  const { data: classes } = unwrapList<Class>(classesRes);

  const { data: yearsRes } = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => academicYearApi.list({ limit: 50 }),
  });
  const { data: years } = unwrapList<AcademicYear>(yearsRes);

  // ── Form ──────────────────────────────────────────────────────────────────

  const form = useForm<FormValues>({
    resolver: zodResolver(feeStructureSchema),
    defaultValues: { name: '', frequency: 'MONTHLY', classId: 'all', academicYearId: '' },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const classId =
        values.classId && values.classId !== 'all' ? values.classId : undefined;
      if (editTarget) {
        return feeStructureApi.update(editTarget.id, {
          name: values.name,
          amount: values.amount,
          frequency: values.frequency,
          classId: classId ?? null,
        });
      }
      return feeStructureApi.create({
        name: values.name,
        amount: values.amount,
        frequency: values.frequency,
        classId,
        academicYearId: values.academicYearId,
      });
    },
    onSuccess: () => {
      toast.success(t('finance.fee_structures.saved'));
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      setDialogOpen(false);
      setEditTarget(null);
      form.reset();
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => feeStructureApi.delete(id),
    onSuccess: () => {
      toast.success(t('finance.fee_structures.deleted'));
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      setDeleteTarget(null);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  const generateMutation = useMutation({
    mutationFn: (id: string) => feeStructureApi.generateRecords(id),
    onSuccess: (res) => {
      const result = (res as any)?.data?.data ?? { created: 0, skipped: 0 };
      toast.success(
        t('finance.fee_structures.generate_success', {
          created: result.created,
          skipped: result.skipped,
        }),
      );
      queryClient.invalidateQueries({ queryKey: ['fee-records'] });
      setGenerateTarget(null);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null);
    form.reset({
      name: '',
      frequency: 'MONTHLY',
      classId: 'all',
      academicYearId: years[0]?.id ?? '',
    });
    setDialogOpen(true);
  };

  const openEdit = (s: FeeStructure) => {
    setEditTarget(s);
    form.reset({
      name: s.name,
      amount: s.amount,
      frequency: s.frequency,
      classId: s.classId ?? 'all',
      academicYearId: s.academicYearId,
    });
    setDialogOpen(true);
  };

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnDef<FeeStructure>[] = [
    {
      id: 'name',
      header: t('finance.fee_structures.name'),
      cell: ({ row }) => (
        <span className="font-medium text-sm">{row.original.name}</span>
      ),
    },
    {
      id: 'amount',
      header: t('finance.fee_structures.amount'),
      cell: ({ row }) => (
        <span className="text-sm font-mono">{formatETB(row.original.amount)}</span>
      ),
    },
    {
      id: 'frequency',
      header: t('finance.fee_structures.frequency'),
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${FREQ_CLASS[row.original.frequency]}`}
        >
          {t(
            `finance.fee_structures.frequency_${row.original.frequency.toLowerCase()}`,
          )}
        </span>
      ),
    },
    {
      id: 'class',
      header: t('finance.fee_structures.class'),
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.class?.name ?? t('finance.fee_structures.all_classes')}
        </span>
      ),
    },
    {
      id: 'academicYear',
      header: t('finance.fee_structures.academic_year'),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.academicYear?.name ?? '—'}</span>
      ),
    },
    {
      id: 'status',
      header: t('finance.fee_structures.status'),
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            row.original.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
          }`}
        >
          {row.original.isActive
            ? t('finance.fee_structures.active')
            : t('finance.fee_structures.inactive')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={t('finance.fee_structures.generate_records')}
            onClick={() => setGenerateTarget(row.original)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('finance.fee_structures.title')}
        description={t('finance.fee_structures.description')}
        actions={
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t('finance.fee_structures.add')}
          </Button>
        }
      />

      <DataTable<FeeStructure>
        columns={columns}
        data={structures}
        isLoading={isLoading}
        emptyMessage={t('finance.fee_structures.empty')}
        page={meta.page}
        totalPages={meta.totalPages}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editTarget
                ? t('finance.fee_structures.edit')
                : t('finance.fee_structures.add')}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
              className="space-y-4"
            >
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.fee_structures.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.fee_structures.amount')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Frequency */}
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.fee_structures.frequency')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(
                          [
                            'ONE_TIME',
                            'MONTHLY',
                            'QUARTERLY',
                            'SEMESTER',
                            'ANNUAL',
                          ] as FeeFrequency[]
                        ).map((f) => (
                          <SelectItem key={f} value={f}>
                            {t(
                              `finance.fee_structures.frequency_${f.toLowerCase()}`,
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Academic Year — only shown on create */}
              {!editTarget && (
                <FormField
                  control={form.control}
                  name="academicYearId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('finance.fee_structures.academic_year')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y.id} value={y.id}>
                              {y.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Class (optional) */}
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.fee_structures.class')}</FormLabel>
                    <Select value={field.value ?? 'all'} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">
                          {t('finance.fee_structures.all_classes')}
                        </SelectItem>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? t('common.actions.loading')
                    : t('common.actions.save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('finance.fee_structures.delete_confirm')}
        description={deleteTarget?.name ?? ''}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />

      {/* Generate Records Confirm */}
      <AlertDialog
        open={!!generateTarget}
        onOpenChange={(open) => !open && setGenerateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('finance.fee_structures.generate_confirm_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('finance.fee_structures.generate_confirm_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                generateTarget && generateMutation.mutate(generateTarget.id)
              }
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? t('common.actions.loading')
                : t('finance.fee_structures.generate_records')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
