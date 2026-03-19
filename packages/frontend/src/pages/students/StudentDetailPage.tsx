import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Trash2, FileText, Plus, Loader2, ExternalLink, Upload } from 'lucide-react';

import { studentApi, StudentDocument, ParentLink } from '@/services/student.service';
import { PageHeader } from '@/components/custom/PageHeader';
import { ConfirmDialog } from '@/components/custom/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  INACTIVE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  GRADUATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  TRANSFERRED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  SUSPENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};

export function StudentDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Document upload state
  const [docDialogOpen, setDocDialogOpen] = React.useState(false);
  const [docName, setDocName] = React.useState('');
  const [docFile, setDocFile] = React.useState<File | null>(null);
  const docFileRef = React.useRef<HTMLInputElement>(null);

  // Parent assign state
  const [parentDialogOpen, setParentDialogOpen] = React.useState(false);
  const [parentId, setParentId] = React.useState('');
  const [relationship, setRelationship] = React.useState('GUARDIAN');
  const [isPrimary, setIsPrimary] = React.useState(false);

  // Delete state
  const [deleteDocId, setDeleteDocId] = React.useState<string | null>(null);
  const [deleteParentId, setDeleteParentId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentApi.getById(id!),
    enabled: !!id,
    select: (res) => res.data.data,
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['student-docs', id],
    queryFn: () => studentApi.listDocuments(id!),
    enabled: !!id,
    select: (res) => res.data.data,
  });

  const uploadDocMutation = useMutation({
    mutationFn: () => studentApi.uploadDocument(id!, docName, docFile!),
    onSuccess: () => {
      toast.success(t('students.saved_document'));
      queryClient.invalidateQueries({ queryKey: ['student-docs', id] });
      setDocDialogOpen(false);
      setDocName('');
      setDocFile(null);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => studentApi.deleteDocument(id!, docId),
    onSuccess: () => {
      toast.success(t('students.deleted_document'));
      queryClient.invalidateQueries({ queryKey: ['student-docs', id] });
      setDeleteDocId(null);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  const assignParentMutation = useMutation({
    mutationFn: () =>
      studentApi.assignParent(id!, { parentId, relationship, isPrimary }),
    onSuccess: () => {
      toast.success(t('students.saved_parent'));
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      setParentDialogOpen(false);
      setParentId('');
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  const removeParentMutation = useMutation({
    mutationFn: (pId: string) => studentApi.removeParent(id!, pId),
    onSuccess: () => {
      toast.success(t('students.deleted_parent'));
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      setDeleteParentId(null);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const student = data;
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.actions.back')}
            </Button>
            <Button onClick={() => navigate(`/students/${id}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" />
              {t('common.actions.edit')}
            </Button>
          </>
        }
      />

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile">{t('students.detail')}</TabsTrigger>
          <TabsTrigger value="documents">{t('students.documents')}</TabsTrigger>
          <TabsTrigger value="parents">{t('students.parents')}</TabsTrigger>
          <TabsTrigger value="attendance">{t('students.attendance')}</TabsTrigger>
          <TabsTrigger value="fees">{t('students.fees')}</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-24 w-24">
                    {student.photo && <AvatarImage src={student.photo} alt={initials} />}
                    <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                  </Avatar>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[student.status] ?? ''}`}
                  >
                    {t(`students.status_${student.status.toLowerCase()}`)}
                  </span>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <InfoRow label={t('students.first_name')} value={student.firstName} />
                  <InfoRow label={t('students.last_name')} value={student.lastName} />
                  <InfoRow label={t('students.admission_number')} value={student.admissionNumber} />
                  <InfoRow
                    label={t('students.date_of_birth')}
                    value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'}
                  />
                  <InfoRow label={t('students.gender')} value={t(`students.gender_${student.gender.toLowerCase()}`)} />
                  <InfoRow label={t('students.nationality')} value={student.nationality} />
                  <InfoRow label={t('students.blood_group')} value={student.bloodGroup ?? '—'} />
                  <InfoRow label={t('students.class')} value={student.class?.name ?? '—'} />
                  <InfoRow label={t('students.section')} value={student.section?.name ?? '—'} />
                  <InfoRow label={t('students.roll_number')} value={student.rollNumber ?? '—'} />
                  <InfoRow
                    label={t('students.admission_date')}
                    value={student.admissionDate ? new Date(student.admissionDate).toLocaleDateString() : '—'}
                  />
                  <InfoRow label={t('students.rfid_card')} value={student.rfidCardNumber ?? '—'} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('students.documents')}</CardTitle>
              <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    {t('common.actions.add')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('students.documents')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>{t('students.document_name')}</Label>
                      <Input
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        placeholder="e.g. Birth Certificate"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('students.upload_document')}</Label>
                      <input
                        type="file"
                        ref={docFileRef}
                        className="hidden"
                        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => docFileRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {t('students.upload_photo')}
                        </Button>
                        {docFile && (
                          <span className="text-sm text-muted-foreground">{docFile.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDocDialogOpen(false)}
                    >
                      {t('common.actions.cancel')}
                    </Button>
                    <Button
                      onClick={() => uploadDocMutation.mutate()}
                      disabled={!docName || !docFile || uploadDocMutation.isPending}
                    >
                      {uploadDocMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {t('common.actions.save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !documents || documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('students.no_documents')}
                </p>
              ) : (
                <div className="divide-y">
                  {documents.map((doc: StudentDocument) => (
                    <div key={doc.id} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileType} &bull;{' '}
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={doc.filePath} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <ConfirmDialog
                          open={deleteDocId === doc.id}
                          onOpenChange={(open) => !open && setDeleteDocId(null)}
                          title={t('common.actions.delete')}
                          description={t('students.delete_confirm')}
                          onConfirm={() => deleteDocMutation.mutate(doc.id)}
                          isLoading={deleteDocMutation.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteDocId(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parents Tab */}
        <TabsContent value="parents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('students.parents')}</CardTitle>
              <Dialog open={parentDialogOpen} onOpenChange={setParentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    {t('common.actions.add')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('students.parents')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>{t('students.parent_id')}</Label>
                      <Input
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        placeholder={t('students.parent_id_placeholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('students.relationship')}</Label>
                      <Select value={relationship} onValueChange={setRelationship}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FATHER">{t('students.relationship_father')}</SelectItem>
                          <SelectItem value="MOTHER">{t('students.relationship_mother')}</SelectItem>
                          <SelectItem value="GUARDIAN">{t('students.relationship_guardian')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isPrimary"
                        checked={isPrimary}
                        onCheckedChange={(checked) => setIsPrimary(!!checked)}
                      />
                      <Label htmlFor="isPrimary">{t('students.is_primary')}</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setParentDialogOpen(false)}
                    >
                      {t('common.actions.cancel')}
                    </Button>
                    <Button
                      onClick={() => assignParentMutation.mutate()}
                      disabled={!parentId || assignParentMutation.isPending}
                    >
                      {assignParentMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {t('common.actions.save')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {!student.parentLinks || student.parentLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t('students.no_parents')}
                </p>
              ) : (
                <div className="divide-y">
                  {student.parentLinks.map((link: ParentLink) => (
                    <div key={link.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {link.parent
                            ? `${link.parent.firstName} ${link.parent.lastName}`
                            : link.parentId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {link.relationship}
                          {link.isPrimary && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 text-xs">
                              {t('students.is_primary')}
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <ConfirmDialog
                          open={deleteParentId === link.id}
                          onOpenChange={(open) => !open && setDeleteParentId(null)}
                          title={t('common.actions.delete')}
                          description={t('students.delete_confirm')}
                          onConfirm={() => removeParentMutation.mutate(link.parentId)}
                          isLoading={removeParentMutation.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteParentId(link.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Placeholder */}
        <TabsContent value="attendance">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center py-12">
                {t('students.attendance_placeholder')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fees Placeholder */}
        <TabsContent value="fees">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center py-12">
                {t('students.fees_placeholder')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}
