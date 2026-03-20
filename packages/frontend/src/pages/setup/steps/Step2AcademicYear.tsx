import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { format, addDays, differenceInDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoGenerateTerms(startDate: string, endDate: string, termCount: number) {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = differenceInDays(end, start);
  const daysPerTerm = Math.floor(totalDays / termCount);

  return Array.from({ length: termCount }, (_, i) => {
    const termStart = addDays(start, i * daysPerTerm);
    const termEnd = i === termCount - 1 ? end : addDays(start, (i + 1) * daysPerTerm - 1);
    return {
      name: `Term ${i + 1}`,
      startDate: format(termStart, 'yyyy-MM-dd'),
      endDate: format(termEnd, 'yyyy-MM-dd'),
    };
  });
}

function autoYearName(startDate: string, calendarType: string): string {
  if (!startDate) return '';
  const year = new Date(startDate).getFullYear();
  if (calendarType === 'ETHIOPIAN') {
    // Ethiopian year is roughly Gregorian - 7 or 8
    const ethYear = year - 7;
    return `${ethYear} E.C.`;
  }
  return `${year}-${year + 1}`;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const termSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  termCount: z.string(),
  terms: z.array(termSchema),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step2AcademicYear({ onNext }: Props) {
  const { t } = useTranslation();
  const { academicYear, schoolProfile, setAcademicYear } = useWizardStore();

  const calendarType = schoolProfile?.calendarType ?? 'GREGORIAN';

  const defaultStart = '2025-09-01';
  const defaultEnd = '2026-07-31';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: academicYear?.name ?? autoYearName(defaultStart, calendarType),
      startDate: academicYear?.startDate ?? defaultStart,
      endDate: academicYear?.endDate ?? defaultEnd,
      termCount: String(academicYear?.terms.length ?? 3),
      terms: academicYear?.terms ?? autoGenerateTerms(defaultStart, defaultEnd, 3),
    },
  });

  const { fields, replace } = useFieldArray({ control: form.control, name: 'terms' });

  const watchStart = form.watch('startDate');
  const watchEnd = form.watch('endDate');
  const watchTermCount = form.watch('termCount');

  // Recalculate terms when dates or term count change
  useEffect(() => {
    const count = parseInt(watchTermCount, 10) || 3;
    if (watchStart && watchEnd) {
      const generated = autoGenerateTerms(watchStart, watchEnd, count);
      replace(generated);
      form.setValue('name', autoYearName(watchStart, calendarType));
    }
  }, [watchStart, watchEnd, watchTermCount]);

  const onSubmit = (values: FormValues) => {
    setAcademicYear({
      name: values.name,
      startDate: values.startDate,
      endDate: values.endDate,
      terms: values.terms,
    });
    onNext();
  };

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Year Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('wizard.academic_year.name')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Start Date */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wizard.academic_year.start_date')}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value || t('wizard.academic_year.pick_date')}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(d) => d && field.onChange(format(d, 'yyyy-MM-dd'))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* End Date */}
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wizard.academic_year.end_date')}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value || t('wizard.academic_year.pick_date')}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(d) => d && field.onChange(format(d, 'yyyy-MM-dd'))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Term Count */}
        <FormField
          control={form.control}
          name="termCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('wizard.academic_year.term_count')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="2">2 {t('wizard.academic_year.terms')}</SelectItem>
                  <SelectItem value="3">3 {t('wizard.academic_year.terms')}</SelectItem>
                  <SelectItem value="4">4 {t('wizard.academic_year.terms')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Terms table */}
        {fields.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t('wizard.academic_year.terms_label')}</p>
            <div className="rounded-md border divide-y">
              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-3 gap-3 p-3">
                  <FormField
                    control={form.control}
                    name={`terms.${idx}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('wizard.academic_year.term_name')}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`terms.${idx}.startDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('wizard.academic_year.start_date')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`terms.${idx}.endDate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{t('wizard.academic_year.end_date')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Form>
  );
}
