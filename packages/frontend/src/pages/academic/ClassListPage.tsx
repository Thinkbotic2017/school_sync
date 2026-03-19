import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type ColumnDef } from '@/components/ui/data-table';
import { MoreHorizontal, Plus } from 'lucide-react';

import {
  classApi,
  academicYearApi,
  type Class,
} from '@/services/academic.service';
import { unwrapList } from '@/lib/api-helpers';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/custom/PageHeader';
import { ConfirmDialog } from '@/components/custom/ConfirmDialog';
import { ClassFormDialog } from './ClassFormDialog';

export function ClassListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Class | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Class | undefined>();

  // ─── Fetch academic years for filter ──────────────────────────────────────
  const { data: yearsData } = useQuery({
    queryKey: ['academic-years', 'all'],
    queryFn: () => academicYearApi.list({ limit: 100 }),
  });
  const { data: academicYears } = unwrapList<{ id: string; name: string }>(yearsData);

  // ─── Fetch classes ────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['classes', page, selectedYearId],
    queryFn: () =>
      classApi.list({
        page,
        limit: 20,
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
      }),
  });

  const { data: classes, meta } = unwrapList<Class>(data);
  const totalPages = meta.totalPages;

  // ─── Mutations ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => classApi.delete(id),
    onSuccess: () => {
      toast.success(t('academic.class.deleted'));
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  // ─── Columns ─────────────────────────────────────────────────────────────
  const columns: ColumnDef<Class>[] = [
    {
      accessorKey: 'name',
      header: t('academic.class.name'),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'numericOrder',
      header: t('academic.class.order'),
    },
    {
      accessorKey: 'academicYear',
      header: t('academic.class.academic_year'),
      cell: ({ row }) =>
        row.original.academicYear?.name ?? '—',
    },
    {
      id: 'sectionsCount',
      header: t('academic.class.sections_count'),
      cell: ({ row }) => row.original._count?.sections ?? 0,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const cls = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditTarget(cls);
                  setFormOpen(true);
                }}
              >
                {t('common.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(cls)}
                className="text-destructive focus:text-destructive"
              >
                {t('common.actions.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('academic.class.title')}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('academic.class.add')}
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={selectedYearId}
          onValueChange={(val) => {
            setSelectedYearId(val === '__all__' ? '' : val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t('academic.class.academic_year')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('academic.class.all_academic_years')}</SelectItem>
            {academicYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={classes}
        isLoading={isLoading}
        emptyMessage={t('academic.class.empty_message')}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <ClassFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(undefined);
        }}
        existing={editTarget}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('academic.class.delete_title')}
        description={t('academic.class.delete_confirm')}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
