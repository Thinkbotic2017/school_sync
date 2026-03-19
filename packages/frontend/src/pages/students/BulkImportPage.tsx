import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

import { studentApi } from '@/services/student.service';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ImportError {
  row: number;
  error: string;
}

interface ImportResult {
  created: number;
  errors: ImportError[];
}

export function BulkImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) => studentApi.bulkImport(file),
    onSuccess: (res) => {
      const data = res.data.data;
      setResult(data);
      if (data.errors.length === 0) {
        toast.success(
          t('students.import_result', { created: data.created }),
        );
      } else {
        toast.warning(
          t('students.import_result', { created: data.created }) +
            ` (${data.errors.length} errors)`,
        );
      }
    },
    onError: () => {
      toast.error(t('common.errors.server_error'));
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = 'firstName,lastName,dateOfBirth,gender,classId,sectionId,admissionDate,nationality,status\n';
    const example =
      'Abebe,Teshome,2010-03-15,MALE,<classId>,<sectionId>,2024-09-01,Ethiopian,ACTIVE\n';
    const blob = new Blob([headers + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title={t('students.bulk_import')}
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.actions.back')}
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Step 1: Download Template */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              {t('students.import_template')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {t('bulk_import.template_description')}
            </p>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              {t('students.import_template')}
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Select File */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </span>
              {t('students.import_select_file')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('students.import_select_file')}
              </Button>
              {selectedFile && (
                <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Import */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </span>
              {t('common.actions.import')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              disabled={!selectedFile || importMutation.isPending}
              onClick={() => selectedFile && importMutation.mutate(selectedFile)}
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {importMutation.isPending
                ? t('common.actions.loading')
                : t('common.actions.import')}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {importMutation.isPending && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                )}
                {t('students.import_result', { created: result.created })}
              </CardTitle>
            </CardHeader>
            {result.errors.length > 0 && (
              <CardContent>
                <p className="text-sm font-medium text-destructive mb-3">
                  {t('students.import_errors_count', { count: result.errors.length })}
                </p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">{t('students.import_row')}</th>
                        <th className="text-left px-4 py-2 font-medium">{t('students.import_error')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.errors.map((err, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-muted-foreground">{err.row}</td>
                          <td className="px-4 py-2 text-destructive">{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => navigate('/students')}>
                    {t('students.title')}
                  </Button>
                </div>
              </CardContent>
            )}
            {result.errors.length === 0 && (
              <CardContent>
                <Button onClick={() => navigate('/students')}>
                  {t('students.title')}
                </Button>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
