import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlusCircle, Upload, Pencil, Trash2 } from 'lucide-react';

import { studentApi, Student } from '@/services/student.service';
import { apiClient } from '@/services/api';
import { PageHeader } from '@/components/custom/PageHeader';
import { ConfirmDialog } from '@/components/custom/ConfirmDialog';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type StudentStatus = Student['status'];

const STATUS_CLASS: Record<StudentStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  INACTIVE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  GRADUATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  TRANSFERRED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  SUSPENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

export function StudentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [sectionId, setSectionId] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, classId, sectionId, status]);

  // Fetch classes for filter
  const { data: classesData } = useQuery({
    queryKey: ['classes-filter'],
    queryFn: () => apiClient.get('/classes', { params: { limit: 100 } }),
  });

  // Fetch sections when class is selected
  const { data: sectionsData } = useQuery({
    queryKey: ['sections-filter', classId],
    queryFn: () => apiClient.get('/sections', { params: { classId, limit: 100 } }),
    enabled: !!classId,
  });

  // Fetch students
  const { data, isLoading } = useQuery({
    queryKey: ['students', { page, search: debouncedSearch, classId, sectionId, status }],
    queryFn: () =>
      studentApi.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        status: status || undefined,
      }),
  });

  const students: Student[] = data?.data?.data?.data ?? [];
  const meta = data?.data?.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentApi.delete(id),
    onSuccess: () => {
      toast.success(t('common.actions.delete') + ' ' + t('students.title'));
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setDeleteTargetId(null);
    },
    onError: () => {
      toast.error(t('common.errors.server_error'));
      setDeleteTargetId(null);
    },
  });

  const classes: Array<{ id: string; name: string }> = classesData?.data?.data?.data ?? [];
  const sections: Array<{ id: string; name: string }> = sectionsData?.data?.data?.data ?? [];

  const columns: ColumnDef<Student>[] = [
    {
      id: 'photo',
      header: '',
      cell: ({ row }) => {
        const s = row.original;
        const initials = `${s.firstName[0] ?? ''}${s.lastName[0] ?? ''}`.toUpperCase();
        return (
          <Avatar className="h-8 w-8">
            {s.photo && <AvatarImage src={s.photo} alt={`${s.firstName} ${s.lastName}`} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        );
      },
    },
    {
      id: 'name',
      header: t('students.first_name') + ' / ' + t('students.last_name'),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    {
      id: 'admissionNumber',
      header: t('students.admission_number'),
      accessorKey: 'admissionNumber',
    },
    {
      id: 'class',
      header: t('students.class'),
      cell: ({ row }) => row.original.class?.name ?? '—',
    },
    {
      id: 'section',
      header: t('students.section'),
      cell: ({ row }) => row.original.section?.name ?? '—',
    },
    {
      id: 'status',
      header: t('students.status'),
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[s]}`}
          >
            {t(`students.status_${s.toLowerCase()}`)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/students/${row.original.id}/edit`)}
            title={t('common.actions.edit')}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <ConfirmDialog
            open={deleteTargetId === row.original.id}
            onOpenChange={(open) => !open && setDeleteTargetId(null)}
            title={t('common.actions.delete')}
            description={t('students.delete_confirm')}
            onConfirm={() => deleteMutation.mutate(row.original.id)}
            isLoading={deleteMutation.isPending}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteTargetId(row.original.id)}
            title={t('common.actions.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title={t('students.title')}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate('/students/bulk-import')}>
              <Upload className="h-4 w-4 mr-2" />
              {t('students.bulk_import')}
            </Button>
            <Button onClick={() => navigate('/students/new')}>
              <PlusCircle className="h-4 w-4 mr-2" />
              {t('students.add')}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder={t('students.search_placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <Select
          value={classId}
          onValueChange={(val) => {
            setClassId(val === '__all__' ? '' : val);
            setSectionId('');
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('students.filter_class')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('students.filter_class')}</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sectionId}
          onValueChange={(val) => setSectionId(val === '__all__' ? '' : val)}
          disabled={!classId}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('students.filter_section')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('students.filter_section')}</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(val) => setStatus(val === '__all__' ? '' : val)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('students.filter_status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('students.filter_status')}</SelectItem>
            {(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED'] as StudentStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {t(`students.status_${s.toLowerCase()}`)}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={students}
        isLoading={isLoading}
        emptyMessage={t('students.no_students')}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(student) => navigate(`/students/${student.id}`)}
      />
    </div>
  );
}
