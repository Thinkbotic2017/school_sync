import { useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ─── Schema ──────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const breakSchema = z.object({
  name: z.string().min(1),
  afterPeriod: z.coerce.number().min(1),
  duration: z.coerce.number().min(1),
});

const schema = z.object({
  workingDays: z.array(z.string()).min(1),
  schoolStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM format required'),
  schoolEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM format required'),
  graceMinutes: z.coerce.number().min(0),
  periodsPerDay: z.coerce.number().min(1).max(15),
  periodDurationMinutes: z.coerce.number().min(1),
  attendanceMode: z.enum(['DAILY', 'PER_PERIOD', 'BOTH']),
  breaks: z.array(breakSchema),
});

type FormValues = z.infer<typeof schema>;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OpsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OperationsSettings() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      schoolStartTime: '08:00',
      schoolEndTime: '16:00',
      graceMinutes: 10,
      periodsPerDay: 8,
      periodDurationMinutes: 45,
      attendanceMode: 'DAILY',
      breaks: [{ name: 'Lunch', afterPeriod: 4, duration: 30 }],
    },
  });

  const { fields: breakFields, append: appendBreak, remove: removeBreak } = useFieldArray({
    control: form.control,
    name: 'breaks',
  });

  useEffect(() => {
    if (configs.operations) {
      const ops = configs.operations;
      form.reset({
        workingDays: ops.workingDays ?? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        schoolStartTime: ops.schoolStartTime ?? '08:00',
        schoolEndTime: ops.schoolEndTime ?? '16:00',
        graceMinutes: ops.graceMinutes ?? 10,
        periodsPerDay: ops.periodsPerDay ?? 8,
        periodDurationMinutes: ops.periodDurationMinutes ?? 45,
        attendanceMode: ops.attendanceMode ?? 'DAILY',
        breaks: ops.breaks ?? [],
      });
    }
  }, [configs.operations, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      configApi.updateCategory('operations', values as Record<string, unknown>),
    onSuccess: () => { refetch(); toast.success(t('settings.saved')); },
    onError: () => toast.error(t('settings.save_error')),
  });

  if (isLoading) return <OpsSkeleton />;

  const workingDays = form.watch('workingDays');

  const toggleDay = (day: string, checked: boolean) => {
    if (checked) {
      form.setValue('workingDays', [...workingDays, day]);
    } else {
      form.setValue('workingDays', workingDays.filter((d) => d !== day));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tabs.operations')}</CardTitle>
        <CardDescription>{t('settings.operations.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            {/* Working Days */}
            <div className="space-y-3">
              <FormLabel>{t('settings.operations.working_days')}</FormLabel>
              <div className="flex flex-wrap gap-4">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-2">
                    <Checkbox
                      id={`day-${day}`}
                      checked={workingDays.includes(day)}
                      onCheckedChange={(checked) => toggleDay(day, !!checked)}
                    />
                    <label htmlFor={`day-${day}`} className="text-sm cursor-pointer">
                      {t(`settings.operations.day_${day.toLowerCase()}`)}
                    </label>
                  </div>
                ))}
              </div>
              {form.formState.errors.workingDays && (
                <p className="text-sm text-destructive">{form.formState.errors.workingDays.message}</p>
              )}
            </div>

            <Separator />

            {/* Time & Period Settings */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="schoolStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.operations.start_time')}</FormLabel>
                    <FormControl>
                      <Input placeholder="08:00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="schoolEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.operations.end_time')}</FormLabel>
                    <FormControl>
                      <Input placeholder="16:00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodsPerDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.operations.periods_per_day')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={15} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodDurationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.operations.period_duration')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="graceMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.operations.grace_minutes')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Attendance Mode */}
            <FormField
              control={form.control}
              name="attendanceMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.operations.attendance_mode')}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex gap-6 mt-2"
                    >
                      {(['DAILY', 'PER_PERIOD', 'BOTH'] as const).map((mode) => (
                        <FormItem key={mode} className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <RadioGroupItem value={mode} />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {t(`settings.operations.mode_${mode.toLowerCase()}`)}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Breaks */}
            <div className="space-y-3">
              <FormLabel>{t('settings.operations.breaks')}</FormLabel>
              {breakFields.map((brk, bi) => (
                <div key={brk.id} className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`breaks.${bi}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel className="text-xs">{t('settings.operations.break_name')}</FormLabel>
                        <FormControl><Input placeholder="Lunch" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`breaks.${bi}.afterPeriod`}
                    render={({ field }) => (
                      <FormItem className="w-28">
                        <FormLabel className="text-xs">{t('settings.operations.after_period')}</FormLabel>
                        <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`breaks.${bi}.duration`}
                    render={({ field }) => (
                      <FormItem className="w-28">
                        <FormLabel className="text-xs">{t('settings.operations.break_duration')}</FormLabel>
                        <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeBreak(bi)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendBreak({ name: '', afterPeriod: 1, duration: 15 })}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('settings.operations.add_break')}
              </Button>
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
