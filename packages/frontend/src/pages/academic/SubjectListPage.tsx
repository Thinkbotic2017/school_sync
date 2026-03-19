import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type ColumnDef } from '@/components/ui/data-table';
import { MoreHorizontal, Plus } from 'lucide-react';

import {
  subjectApi,
  academicYearApi,
  type Subject,
} from '@/services/academic.service';
import { unwrapList } from '@/lib/api-helpers';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/custom/PageHeader';
import { ConfirmDialog } from '@/components/custom/ConfirmDialog';
import { SubjectFormDialog } from './SubjectFormDialog';

type SubjectType = Subject['type'] | '__all__';

const TYPE_BADGE: Record<Subject['type'], 'info' | 'amber' | 'purple'> = {
  CORE: 'info',
  ELECTIVE: 'amber',
  EXTRACURRICULAR: 'purple',
};

export function SubjectListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<SubjectType>('__all__');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Subject | undefined>();

  // ─── Fetch academic years for filter ──────────────────────────────────────
  const { data: yearsData } = useQuery({
    queryKey: ['academic-years', 'all'],
    queryFn: () => academicYearApi.list({ limit: 100 }),
  });
  const { data: academicYears } = unwrapList<{ id: string; name: string }>(yearsData);

  // ─── Fetch subjects ────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['subjects', page, selectedYearId, selectedType],
    queryFn: () =>
      subjectApi.list({
        page,
        limit: 20,
        ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
        ...(selectedType !== '__all__' ? { type: selectedType } : {}),
      }),
  });

  const { data: subjects, meta } = unwrapList<Subject>(data);
  const totalPages = meta.totalPages;

  // ─── Mutations ──────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => subjectApi.delete(id),
    onSuccess: () => {
      toast.success(t('academic.subject.deleted'));
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setDeleteTarget(undefined);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  // ─── Columns ─────────────────────────────────────────────────────────────
  const columns: ColumnDef<Subject>[] = [
    {
      accessorKey: 'name',
      header: t('academic.subject.name'),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'nameAmharic',
      header: t('academic.subject.name_amharic'),
      cell: ({ row }) => (
        <span lang="am" className="font-[var(--font-ethiopic)]">
          {row.original.nameAmharic ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'code',
      header: t('academic.subject.code'),
    },
    {
      accessorKey: 'type',
      header: t('academic.subject.type'),
      cell: ({ row }) => {
        const type = row.original.type;
        const typeLabel: Record<Subject['type'], string> = {
          CORE: t('academic.subject.type_core'),
          ELECTIVE: t('academic.subject.type_elective'),
          EXTRACURRICULAR: t('academic.subject.type_extracurricular'),
        };
        return (
          <Badge variant={TYPE_BADGE[type]}>{typeLabel[type]}</Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const subject = row.original;
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
                  setEditTarget(subject);
                  setFormOpen(true);
                }}
              >
                {t('common.actions.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteTarget(subject)}
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
        title={t('academic.subject.title')}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('academic.subject.add')}
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Select
          value={selectedYearId}
          onValueChange={(val) => {
            setSelectedYearId(val === '__all__' ? '' : val);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder={t('academic.class.academic_year')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('academic.subject.all_academic_years')}</SelectItem>
            {academicYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedType}
          onValueChange={(val) => {
            setSelectedType(val as SubjectType);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('academic.subject.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('academic.subject.all_types')}</SelectItem>
            <SelectItem value="CORE">{t('academic.subject.type_core')}</SelectItem>
            <SelectItem value="ELECTIVE">{t('academic.subject.type_elective')}</SelectItem>
            <SelectItem value="EXTRACURRICULAR">
              {t('academic.subject.type_extracurricular')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={subjects}
        isLoading={isLoading}
        emptyMessage={t('academic.subject.empty_message')}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <SubjectFormDialog
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
        title={t('academic.subject.delete_title')}
        description={t('academic.subject.delete_confirm')}
        onConfirm={() =>
          deleteTarget && deleteMutation.mutate(deleteTarget.id)
        }
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
