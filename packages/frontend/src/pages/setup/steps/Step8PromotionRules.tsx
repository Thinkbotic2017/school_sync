import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { useWizardStore } from '@/store/wizard.store';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// ─── Schema ───────────────────────────────────────────────────────────────────

const WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const schema = z.object({
  // Promotion rules — field names match backend API contract
  minAverage: z.coerce.number().min(0).max(100),
  maxFailed: z.coerce.number().int().min(0).max(20),
  autoPromoteGrades: z.array(z.string()),
  reExamAllowed: z.boolean(),
  reExamMaxAttempts: z.coerce.number().min(1).max(5),
  // Operations — field names match backend API contract
  workingDays: z.array(z.enum(WORKING_DAYS)).min(1, 'At least one working day is required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:MM format'),
  graceMinutes: z.coerce.number().int().min(0),
  periodsPerDay: z.coerce.number().int().min(1).max(20),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step8PromotionRules({ onNext }: Props) {
  const { t } = useTranslation();
  const { grades, promotionRules, operations, setPromotionRules, setOperations } = useWizardStore();

  const lowerGrades = grades
    .filter((g) => {
      const m = g.name.match(/\d+/);
      return m ? parseInt(m[0], 10) <= 4 : g.name.startsWith('KG');
    })
    .map((g) => g.name);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      minAverage: promotionRules?.minAverage ?? 50,
      maxFailed: promotionRules?.maxFailed ?? 2,
      autoPromoteGrades: promotionRules?.autoPromoteGrades ?? lowerGrades,
      reExamAllowed: promotionRules?.reExamAllowed ?? true,
      reExamMaxAttempts: promotionRules?.reExamMaxAttempts ?? 1,
      workingDays: (operations?.workingDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI']) as Array<typeof WORKING_DAYS[number]>,
      startTime: operations?.startTime ?? '08:00',
      endTime: operations?.endTime ?? '16:00',
      graceMinutes: operations?.graceMinutes ?? 15,
      periodsPerDay: operations?.periodsPerDay ?? 8,
    },
  });

  const reExamAllowed = form.watch('reExamAllowed');

  const onSubmit = (values: FormValues) => {
    setPromotionRules({
      minAverage: values.minAverage,
      maxFailed: values.maxFailed,
      autoPromoteGrades: values.autoPromoteGrades,
      reExamAllowed: values.reExamAllowed,
      reExamMaxAttempts: values.reExamMaxAttempts,
    });
    setOperations({
      workingDays: values.workingDays,
      startTime: values.startTime,
      endTime: values.endTime,
      graceMinutes: values.graceMinutes,
      periodsPerDay: values.periodsPerDay,
    });
    onNext();
  };

  const toggleGrade = (gradeName: string, checked: boolean) => {
    const current = form.getValues('autoPromoteGrades');
    if (checked) {
      form.setValue('autoPromoteGrades', [...current, gradeName]);
    } else {
      form.setValue('autoPromoteGrades', current.filter((g) => g !== gradeName));
    }
  };

  const toggleWorkingDay = (day: typeof WORKING_DAYS[number], checked: boolean) => {
    const current = form.getValues('workingDays');
    if (checked) {
      form.setValue('workingDays', [...current, day]);
    } else {
      form.setValue('workingDays', current.filter((d) => d !== day));
    }
  };

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Promotion Rules ──────────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold mb-4">{t('wizard.promotion.section_title')}</h3>

          {/* Min Average + Max Failed */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="minAverage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wizard.promotion.min_average')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxFailed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wizard.promotion.max_failed_subjects')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={20} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Auto-promote grades */}
          {grades.length > 0 && (
            <div className="space-y-3 mt-4">
              <FormLabel>{t('wizard.promotion.auto_promote_grades')}</FormLabel>
              <p className="text-xs text-muted-foreground">{t('wizard.promotion.auto_promote_hint')}</p>
              <div className="grid grid-cols-3 gap-2">
                {grades.map((g) => {
                  const autoPromote = form.watch('autoPromoteGrades');
                  const checked = autoPromote.includes(g.name);
                  return (
                    <label key={g.name} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleGrade(g.name, Boolean(v))}
                      />
                      <span className="text-sm">{g.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Re-exam */}
          <div className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="reExamAllowed"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">{t('wizard.promotion.re_exam_allowed')}</FormLabel>
                </FormItem>
              )}
            />

            {reExamAllowed && (
              <FormField
                control={form.control}
                name="reExamMaxAttempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('wizard.promotion.re_exam_attempts')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={5} className="w-32" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        <Separator />

        {/* ── School Operations ────────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold mb-4">{t('wizard.operations.section_title')}</h3>

          {/* Working days */}
          <div className="space-y-3">
            <FormLabel>{t('wizard.operations.working_days')}</FormLabel>
            <div className="flex flex-wrap gap-3">
              {WORKING_DAYS.map((day) => {
                const workingDays = form.watch('workingDays');
                const checked = workingDays.includes(day);
                return (
                  <label key={day} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleWorkingDay(day, Boolean(v))}
                    />
                    <span className="text-sm">{t(`wizard.operations.day_${day.toLowerCase()}`)}</span>
                  </label>
                );
              })}
            </div>
            {form.formState.errors.workingDays && (
              <p className="text-sm text-destructive">{form.formState.errors.workingDays.message}</p>
            )}
          </div>

          {/* Start/End time + grace */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wizard.operations.start_time')}</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wizard.operations.end_time')}</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
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
                  <FormLabel>{t('wizard.operations.grace_minutes')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Periods per day */}
          <div className="mt-4 max-w-xs">
            <FormField
              control={form.control}
              name="periodsPerDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wizard.operations.periods_per_day')}</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </form>
    </Form>
  );
}
