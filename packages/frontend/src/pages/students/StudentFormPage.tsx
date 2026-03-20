import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Loader2 } from 'lucide-react';

import { studentApi } from '@/services/student.service';
import { academicYearApi, classApi } from '@/services/academic.service';
import { apiClient } from '@/services/api';
import { unwrapList } from '@/lib/api-helpers';
import { PageHeader } from '@/components/custom/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const studentSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE']),
  nationality: z.string().min(1).default('Ethiopian'),
  bloodGroup: z.string().optional(),
  academicYearId: z.string().optional(),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  rollNumber: z.string().optional(),
  admissionDate: z.string().min(1),
  rfidCardNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED']).default('ACTIVE'),
});

type StudentFormValues = z.infer<typeof studentSchema>;

export function StudentFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const queryClient = useQueryClient();

  const [selectedAcademicYearId, setSelectedAcademicYearId] = React.useState('');
  const [selectedClassId, setSelectedClassId] = React.useState('');
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'MALE',
      nationality: 'Ethiopian',
      bloodGroup: '',
      academicYearId: '',
      classId: '',
      sectionId: '',
      rollNumber: '',
      admissionDate: new Date().toISOString().split('T')[0],
      rfidCardNumber: '',
      status: 'ACTIVE',
    },
  });

  // Load student data into form
  const { data: studentData } = useQuery({
    queryKey: ['student', id],
    queryFn: () => studentApi.getById(id!),
    enabled: isEdit,
    select: (res) => res.data.data,
  });

  React.useEffect(() => {
    if (studentData && isEdit) {
      const s = studentData;
      // Restore cascading state so dropdowns populate correctly on edit
      const yearId: string = s.class?.academicYearId ?? '';
      setSelectedAcademicYearId(yearId);
      setSelectedClassId(s.classId);
      form.reset({
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dateOfBirth ? s.dateOfBirth.split('T')[0] : '',
        gender: s.gender,
        nationality: s.nationality,
        bloodGroup: s.bloodGroup ?? '',
        academicYearId: yearId,
        classId: s.classId,
        sectionId: s.sectionId,
        rollNumber: s.rollNumber ?? '',
        admissionDate: s.admissionDate ? s.admissionDate.split('T')[0] : '',
        rfidCardNumber: s.rfidCardNumber ?? '',
        status: s.status,
      });
      if (s.photo) setPhotoPreview(s.photo);
    }
  }, [studentData, isEdit, form]);

  // Academic years — always fetch so the dropdown is populated
  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years-list'],
    queryFn: () => academicYearApi.list({ limit: 50 }),
  });
  const { data: academicYears } = unwrapList<{ id: string; name: string }>(academicYearsData);

  // Classes — only fetch after an academic year is selected
  const { data: classesData } = useQuery({
    queryKey: ['classes-form', selectedAcademicYearId],
    queryFn: () =>
      classApi.list({ academicYearId: selectedAcademicYearId, limit: 100 }),
    enabled: !!selectedAcademicYearId,
  });
  const { data: classes } = unwrapList<{ id: string; name: string }>(classesData);

  // Sections — only fetch after a class is selected
  const { data: sectionsData } = useQuery({
    queryKey: ['sections-form', selectedClassId],
    queryFn: () => apiClient.get('/sections', { params: { classId: selectedClassId, limit: 100 } }),
    enabled: !!selectedClassId,
  });
  const { data: sections } = unwrapList<{ id: string; name: string }>(sectionsData);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const { academicYearId, ...dto } = values;
      const res = await studentApi.create(dto);
      const newStudent = res.data.data;
      if (photoFile && newStudent.id) {
        await studentApi.uploadPhoto(newStudent.id, photoFile);
      }
      return newStudent;
    },
    onSuccess: (student) => {
      toast.success(t('students.add') + ' ' + t('common.actions.save'));
      queryClient.invalidateQueries({ queryKey: ['students'] });
      navigate(`/students/${student.id}`);
    },
    onError: () => {
      toast.error(t('common.errors.server_error'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: StudentFormValues) => {
      const { academicYearId, ...dto } = values;
      const res = await studentApi.update(id!, dto);
      const updated = res.data.data;
      if (photoFile && id) {
        await studentApi.uploadPhoto(id, photoFile);
      }
      return updated;
    },
    onSuccess: () => {
      toast.success(t('students.edit') + ' ' + t('common.actions.save'));
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      navigate(`/students/${id}`);
    },
    onError: () => {
      toast.error(t('common.errors.server_error'));
    },
  });

  const onSubmit = (values: StudentFormValues) => {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <PageHeader
        title={isEdit ? t('students.edit') : t('students.add')}
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.actions.back')}
          </Button>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('students.personal_info')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.first_name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.last_name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.date_of_birth')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.gender')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MALE">{t('students.gender_male')}</SelectItem>
                        <SelectItem value="FEMALE">{t('students.gender_female')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.nationality')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bloodGroup"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.blood_group')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. A+" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Academic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('students.academic_info')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Academic Year (used for filtering classes, not saved to form) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium leading-none">
                  {t('students.academic_year')}
                </Label>
                <Select
                  value={selectedAcademicYearId}
                  onValueChange={(val) => {
                    setSelectedAcademicYearId(val);
                    setSelectedClassId('');
                    form.setValue('classId', '');
                    form.setValue('sectionId', '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('students.academic_year')} />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((ay) => (
                      <SelectItem key={ay.id} value={ay.id}>
                        {ay.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.class')}</FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        setSelectedClassId(val);
                        form.setValue('sectionId', '');
                      }}
                      value={field.value}
                      disabled={!selectedAcademicYearId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            selectedAcademicYearId
                              ? t('students.class')
                              : t('students.select_year_first')
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

              <FormField
                control={form.control}
                name="sectionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.section')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!selectedClassId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('students.section')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rollNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.roll_number')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="admissionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.admission_date')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rfidCardNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.rfid_card')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('students.status')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'SUSPENDED'] as const).map(
                          (s) => (
                            <SelectItem key={s} value={s}>
                              {t(`students.status_${s.toLowerCase()}`)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Photo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('students.photo')}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Student photo"
                  className="h-20 w-20 rounded-full object-cover border"
                />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('students.upload_photo')}
              </Button>
              {photoFile && (
                <span className="text-sm text-muted-foreground">{photoFile.name}</span>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.actions.save')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
