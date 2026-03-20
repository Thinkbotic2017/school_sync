import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Trash2, Plus } from 'lucide-react';

import { useTenantConfig } from '@/hooks/useTenantConfig';
import { configApi } from '@/services/config.service';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';

// ─── Grading Presets ─────────────────────────────────────────────────────────

type GradeRow = { letter: string; min: number; max: number; gpa: number; description: string };

const GRADING_PRESETS: Record<string, GradeRow[]> = {
  Ethiopian: [
    { letter: 'A+', min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
    { letter: 'A',  min: 80, max: 89,  gpa: 4.0, description: 'Very Good' },
    { letter: 'B',  min: 70, max: 79,  gpa: 3.0, description: 'Good' },
    { letter: 'C',  min: 60, max: 69,  gpa: 2.0, description: 'Satisfactory' },
    { letter: 'D',  min: 50, max: 59,  gpa: 1.0, description: 'Pass' },
    { letter: 'F',  min: 0,  max: 49,  gpa: 0.0, description: 'Fail' },
  ],
  IGCSE: [
    { letter: 'A*', min: 90, max: 100, gpa: 4.0, description: 'Outstanding' },
    { letter: 'A',  min: 80, max: 89,  gpa: 4.0, description: 'Excellent' },
    { letter: 'B',  min: 70, max: 79,  gpa: 3.0, description: 'Very Good' },
    { letter: 'C',  min: 60, max: 69,  gpa: 2.0, description: 'Good' },
    { letter: 'D',  min: 50, max: 59,  gpa: 1.0, description: 'Satisfactory' },
    { letter: 'E',  min: 40, max: 49,  gpa: 0.5, description: 'Minimum Pass' },
    { letter: 'U',  min: 0,  max: 39,  gpa: 0.0, description: 'Ungraded' },
  ],
  IB: [
    { letter: '7', min: 85, max: 100, gpa: 4.0, description: 'Excellent' },
    { letter: '6', min: 75, max: 84,  gpa: 3.7, description: 'Very Good' },
    { letter: '5', min: 65, max: 74,  gpa: 3.3, description: 'Good' },
    { letter: '4', min: 55, max: 64,  gpa: 3.0, description: 'Satisfactory' },
    { letter: '3', min: 45, max: 54,  gpa: 2.0, description: 'Mediocre' },
    { letter: '2', min: 35, max: 44,  gpa: 1.0, description: 'Poor' },
    { letter: '1', min: 0,  max: 34,  gpa: 0.0, description: 'Very Poor' },
  ],
  American: [
    { letter: 'A', min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
    { letter: 'B', min: 80, max: 89,  gpa: 3.0, description: 'Good' },
    { letter: 'C', min: 70, max: 79,  gpa: 2.0, description: 'Average' },
    { letter: 'D', min: 60, max: 69,  gpa: 1.0, description: 'Below Average' },
    { letter: 'F', min: 0,  max: 59,  gpa: 0.0, description: 'Fail' },
  ],
};

// ─── Schemas ─────────────────────────────────────────────────────────────────

const gradeRowSchema = z.object({
  letter: z.string().min(1),
  min: z.coerce.number().min(0).max(100),
  max: z.coerce.number().min(0).max(100),
  gpa: z.coerce.number().min(0).max(4),
  description: z.string(),
});

const gradingSchema = z.object({
  scale: z.array(gradeRowSchema).min(1),
  passingGrade: z.string().min(1),
  minimumPassPercentage: z.coerce.number().min(0).max(100),
});

const categorySchema = z.object({
  name: z.string().min(1),
  weight: z.coerce.number().min(0).max(100),
});

const gradeGroupSchema = z.object({
  name: z.string().min(1),
  grades: z.string(), // comma-separated
  caWeight: z.coerce.number().min(0).max(100),
  categories: z.array(categorySchema).min(1),
});

const assessmentSchema = z.object({
  gradeGroups: z.array(gradeGroupSchema).min(1),
});

type GradingFormValues = z.infer<typeof gradingSchema>;
type AssessmentFormValues = z.infer<typeof assessmentSchema>;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function AcademicSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

// ─── Grading Scale Form ───────────────────────────────────────────────────────

function GradingScaleForm() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();
  const [preset, setPreset] = useState('Custom');

  const form = useForm<GradingFormValues>({
    resolver: zodResolver(gradingSchema),
    defaultValues: {
      scale: GRADING_PRESETS.Ethiopian,
      passingGrade: 'D',
      minimumPassPercentage: 50,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'scale',
  });

  useEffect(() => {
    if (configs.grading) {
      form.reset({
        scale: configs.grading.scale ?? GRADING_PRESETS.Ethiopian,
        passingGrade: configs.grading.passingGrade ?? 'D',
        minimumPassPercentage: configs.grading.minimumPassPercentage ?? 50,
      });
    }
  }, [configs.grading, form]);

  const mutation = useMutation({
    mutationFn: (values: GradingFormValues) =>
      configApi.updateCategory('grading', values as Record<string, unknown>),
    onSuccess: () => { refetch(); toast.success(t('settings.saved')); },
    onError: () => toast.error(t('settings.save_error')),
  });

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value !== 'Custom' && GRADING_PRESETS[value]) {
      replace(GRADING_PRESETS[value]);
    }
  };

  if (isLoading) return <AcademicSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.grading.scale_title')}</CardTitle>
        <CardDescription>{t('settings.grading.scale_description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            {/* Preset selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{t('settings.grading.preset')}</span>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Ethiopian', 'IGCSE', 'IB', 'American', 'Custom'].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scale Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.grading.letter')}</TableHead>
                    <TableHead>{t('settings.grading.min_pct')}</TableHead>
                    <TableHead>{t('settings.grading.max_pct')}</TableHead>
                    <TableHead>{t('settings.grading.gpa')}</TableHead>
                    <TableHead>{t('settings.grading.description')}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`scale.${index}.letter`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input className="w-16" {...f} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`scale.${index}.min`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" className="w-20" {...f} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`scale.${index}.max`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" className="w-20" {...f} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`scale.${index}.gpa`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" step="0.1" className="w-20" {...f} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`scale.${index}.description`}
                          render={({ field: f }) => (
                            <FormItem>
                              <FormControl>
                                <Input className="w-32" {...f} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ letter: '', min: 0, max: 0, gpa: 0, description: '' })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('settings.grading.add_grade')}
            </Button>

            {/* Passing grade + minimum % */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="passingGrade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.grading.passing_grade')}</FormLabel>
                    <FormControl>
                      <Input placeholder="D" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minimumPassPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.grading.min_pass_pct')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.actions.loading') : t('common.actions.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ─── Assessment Weights Form ──────────────────────────────────────────────────

function AssessmentWeightsForm() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();

  const form = useForm<AssessmentFormValues>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      gradeGroups: [
        {
          name: 'All Grades',
          grades: '',
          caWeight: 40,
          categories: [
            { name: 'Quiz', weight: 20 },
            { name: 'Homework', weight: 20 },
            { name: 'Mid-Term', weight: 60 },
          ],
        },
      ],
    },
  });

  const { fields: groupFields, append: appendGroup, remove: removeGroup } = useFieldArray({
    control: form.control,
    name: 'gradeGroups',
  });

  useEffect(() => {
    if (configs.assessment?.gradeGroups) {
      form.reset({
        gradeGroups: configs.assessment.gradeGroups.map((g) => ({
          name: g.name,
          grades: g.grades.join(', '),
          caWeight: g.caWeight,
          categories: g.categories,
        })),
      });
    }
  }, [configs.assessment, form]);

  const mutation = useMutation({
    mutationFn: (values: AssessmentFormValues) => {
      const payload = {
        gradeGroups: values.gradeGroups.map((g) => ({
          name: g.name,
          grades: g.grades.split(',').map((s) => s.trim()).filter(Boolean),
          caWeight: g.caWeight,
          examWeight: 100 - g.caWeight,
          categories: g.categories,
        })),
      };
      return configApi.updateCategory('assessment', payload as Record<string, unknown>);
    },
    onSuccess: () => { refetch(); toast.success(t('settings.saved')); },
    onError: () => toast.error(t('settings.save_error')),
  });

  if (isLoading) return <AcademicSkeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.assessment.title')}</CardTitle>
        <CardDescription>{t('settings.assessment.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            {groupFields.map((group, gi) => (
              <GroupEditor
                key={group.id}
                groupIndex={gi}
                form={form}
                onRemove={() => removeGroup(gi)}
              />
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendGroup({
                  name: '',
                  grades: '',
                  caWeight: 40,
                  categories: [{ name: '', weight: 100 }],
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('settings.assessment.add_group')}
            </Button>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.actions.loading') : t('common.actions.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ─── Group Editor ─────────────────────────────────────────────────────────────

function GroupEditor({
  groupIndex,
  form,
  onRemove,
}: {
  groupIndex: number;
  form: ReturnType<typeof useForm<AssessmentFormValues>>;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const caWeight = form.watch(`gradeGroups.${groupIndex}.caWeight`);
  const examWeight = 100 - (Number(caWeight) || 0);

  const { fields: catFields, append: appendCat, remove: removeCat } = useFieldArray({
    control: form.control,
    name: `gradeGroups.${groupIndex}.categories`,
  });

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t('settings.assessment.group')} {groupIndex + 1}</span>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`gradeGroups.${groupIndex}.name`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settings.assessment.group_name')}</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`gradeGroups.${groupIndex}.grades`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settings.assessment.grades')}</FormLabel>
              <FormControl><Input placeholder="Grade 1, Grade 2, ..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={`gradeGroups.${groupIndex}.caWeight`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settings.assessment.ca_weight')} ({field.value}%)</FormLabel>
              <FormControl>
                <Slider
                  value={[Number(field.value)]}
                  onValueChange={(vals) => field.onChange(vals[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('settings.assessment.exam_weight')}</label>
          <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
            {examWeight}%
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <span className="text-sm font-medium">{t('settings.assessment.ca_categories')}</span>
        {catFields.map((cat, ci) => (
          <div key={cat.id} className="flex items-center gap-2">
            <FormField
              control={form.control}
              name={`gradeGroups.${groupIndex}.categories.${ci}.name`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl><Input placeholder={t('settings.assessment.cat_name')} {...field} /></FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`gradeGroups.${groupIndex}.categories.${ci}.weight`}
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormControl><Input type="number" min={0} max={100} placeholder="%" {...field} /></FormControl>
                </FormItem>
              )}
            />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => removeCat(ci)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendCat({ name: '', weight: 0 })}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('settings.assessment.add_category')}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function AcademicSettings() {
  return (
    <div className="space-y-6">
      <GradingScaleForm />
      <AssessmentWeightsForm />
    </div>
  );
}
