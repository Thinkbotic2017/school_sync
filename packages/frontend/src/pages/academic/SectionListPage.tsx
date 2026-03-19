import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type ColumnDef } from '@/components/ui/data-table';
import { MoreHorizontal, Plus } from 'lucide-react';

import {
  sectionApi,
  classApi,
  type Section,
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
import { SectionFormDialog } from './SectionFormDialog';

export function SectionListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Section | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Section | undefined>();

  // ─── Fetch classes for filter ──────────────────────────────────────────────
  const { data: classesData } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => classApi.list({ limit: 200 }),
  });
  const { data: classes } = unwrapList<{ id: string; name: string }>(classesData);

  // ─── Fetch sections ────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['sections', page, selectedClassId],
    queryFn: () =>
      sectionApi.list({
        page,
        limit: 20,
        ...(selectedClassId ? { classId: selectedClassId } : {}),
      }),
  });

  const { data: sections, meta } = unwrapList<Section>(data);
  const totalPages = meta.totalPages;

  // ─── Mutations ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => sectionApi.delete(id),
    onSuccess: () => {
      toast.success(t('academic.section.deleted'));
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  // ─── Columns ─────────────────────────────────────────────────────────────
  const columns: ColumnDef<Section>[] = [
    {
      accessorKey: 'name',
      header: t('academic.section.name'),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'class',
      header: t('academic.section.class'),
      cell: ({ row }) => row.original.class?.name ?? '—',
    },
    {
      accessorKey: 'capacity',
      header: t('academic.section.capacity'),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const section = row.original;
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
                  setEditTarget(section);
                  setFormOpen(true);
                }}
              >
                {t('common.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(section)}
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
        title={t('academic.section.title')}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('academic.section.add')}
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={selectedClassId}
          onValueChange={(val) => {
            setSelectedClassId(val === '__all__' ? '' : val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t('academic.section.class')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('academic.section.all_classes')}</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={sections}
        isLoading={isLoading}
        emptyMessage={t('academic.section.empty_message')}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <SectionFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(undefined);
        }}
        existing={editTarget}
        defaultClassId={selectedClassId || undefined}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t('academic.section.delete_title')}
        description={t('academic.section.delete_confirm')}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.id)
        }
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
