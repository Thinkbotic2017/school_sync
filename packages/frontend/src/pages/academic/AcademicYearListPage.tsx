import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type ColumnDef } from '@/components/ui/data-table';
import { MoreHorizontal, Plus, Star } from 'lucide-react';

import { academicYearApi, type AcademicYear } from '@/services/academic.service';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/custom/PageHeader';
import { ConfirmDialog } from '@/components/custom/ConfirmDialog';
import { AcademicYearFormDialog } from './AcademicYearFormDialog';

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function AcademicYearListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AcademicYear | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AcademicYear | undefined>();

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['academic-years', page],
    queryFn: () => academicYearApi.list({ page, limit: 20 }),
  });

  const years: AcademicYear[] = data?.data?.data?.data ?? [];
  const totalPages = data?.data?.data?.meta?.totalPages ?? 1;

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => academicYearApi.delete(id),
    onSuccess: () => {
      toast.success('Academic year deleted');
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  const setCurrentMutation = useMutation({
    mutationFn: (id: string) => academicYearApi.setCurrent(id),
    onSuccess: () => {
      toast.success('Current academic year updated');
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  // ─── Columns ─────────────────────────────────────────────────────────────

  const columns: ColumnDef<AcademicYear>[] = [
    {
      accessorKey: 'name',
      header: t('academic.year.name'),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'startDate',
      header: t('academic.year.start_date'),
      cell: ({ row }) => formatDate(row.original.startDate),
    },
    {
      accessorKey: 'endDate',
      header: t('academic.year.end_date'),
      cell: ({ row }) => formatDate(row.original.endDate),
    },
    {
      accessorKey: 'calendarType',
      header: t('academic.year.calendar_type'),
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs">
          {row.original.calendarType === 'ETHIOPIAN'
            ? t('academic.year.ethiopian')
            : t('academic.year.gregorian')}
        </Badge>
      ),
    },
    {
      accessorKey: 'isCurrent',
      header: 'Status',
      cell: ({ row }) =>
        row.original.isCurrent ? (
          <Badge variant="success">{t('academic.year.current')}</Badge>
        ) : (
          <Badge variant="secondary">Archived</Badge>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const year = row.original;
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
                  setEditTarget(year);
                  setFormOpen(true);
                }}
              >
                {t('common.actions.edit')}
              </DropdownMenuItem>
              {!year.isCurrent && (
                <DropdownMenuItem
                  onClick={() => setCurrentMutation.mutate(year.id)}
                  disabled={setCurrentMutation.isPending}
                >
                  <Star className="mr-2 h-4 w-4" />
                  {t('academic.year.set_current')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(year)}
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

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title={t('academic.year.title')}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('academic.year.add')}
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={years}
        isLoading={isLoading}
        emptyMessage="No academic years found. Add one to get started."
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {/* Create / Edit Dialog */}
      <AcademicYearFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(undefined);
        }}
        existing={editTarget}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('common.actions.delete') + ' Academic Year'}
        description={t('academic.year.delete_confirm')}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
