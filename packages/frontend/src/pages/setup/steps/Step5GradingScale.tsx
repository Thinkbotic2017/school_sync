import { useForm, useFieldArray } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Preset data ──────────────────────────────────────────────────────────────

interface ScaleRow {
  letter: string;
  min: number;
  max: number;
  gpa: number;
  description: string;
}

const SCALE_PRESETS: Record<string, ScaleRow[]> = {
  Ethiopian: [
    { letter: 'A', min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
    { letter: 'B', min: 80, max: 89, gpa: 3.0, description: 'Very Good' },
    { letter: 'C', min: 60, max: 79, gpa: 2.0, description: 'Good' },
    { letter: 'D', min: 50, max: 59, gpa: 1.0, description: 'Satisfactory' },
    { letter: 'F', min: 0, max: 49, gpa: 0.0, description: 'Fail' },
  ],
  American: [
    { letter: 'A', min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
    { letter: 'B', min: 80, max: 89, gpa: 3.0, description: 'Good' },
    { letter: 'C', min: 70, max: 79, gpa: 2.0, description: 'Average' },
    { letter: 'D', min: 60, max: 69, gpa: 1.0, description: 'Below Average' },
    { letter: 'F', min: 0, max: 59, gpa: 0.0, description: 'Fail' },
  ],
  IGCSE: [
    { letter: 'A*', min: 90, max: 100, gpa: 4.0, description: 'Outstanding' },
    { letter: 'A', min: 80, max: 89, gpa: 4.0, description: 'Excellent' },
    { letter: 'B', min: 70, max: 79, gpa: 3.5, description: 'Very Good' },
    { letter: 'C', min: 60, max: 69, gpa: 3.0, description: 'Good' },
    { letter: 'D', min: 50, max: 59, gpa: 2.5, description: 'Satisfactory' },
    { letter: 'E', min: 40, max: 49, gpa: 2.0, description: 'Acceptable' },
    { letter: 'F', min: 30, max: 39, gpa: 1.0, description: 'Weak' },
    { letter: 'G', min: 20, max: 29, gpa: 0.5, description: 'Very Weak' },
    { letter: 'U', min: 0, max: 19, gpa: 0.0, description: 'Ungraded' },
  ],
  IB: [
    { letter: '7', min: 85, max: 100, gpa: 4.0, description: 'Excellent' },
    { letter: '6', min: 70, max: 84, gpa: 3.5, description: 'Very Good' },
    { letter: '5', min: 55, max: 69, gpa: 3.0, description: 'Good' },
    { letter: '4', min: 45, max: 54, gpa: 2.5, description: 'Satisfactory' },
    { letter: '3', min: 35, max: 44, gpa: 2.0, description: 'Mediocre' },
    { letter: '2', min: 25, max: 34, gpa: 1.0, description: 'Poor' },
    { letter: '1', min: 0, max: 24, gpa: 0.0, description: 'Very Poor' },
  ],
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const rowSchema = z.object({
  letter: z.string().min(1),
  min: z.coerce.number().min(0).max(100),
  max: z.coerce.number().min(0).max(100),
  gpa: z.coerce.number().min(0).max(4),
  description: z.string(),
});

const schema = z.object({
  preset: z.string(),
  scale: z.array(rowSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step5GradingScale({ onNext }: Props) {
  const { t } = useTranslation();
  const { gradingPreset, setGradingPreset, setCustomGrading } = useWizardStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      preset: gradingPreset || 'Ethiopian',
      scale: SCALE_PRESETS[gradingPreset || 'Ethiopian'] ?? SCALE_PRESETS['Ethiopian'],
    },
  });

  const { fields } = useFieldArray({ control: form.control, name: 'scale' });
  const currentPreset = form.watch('preset');
  const isCustom = currentPreset === 'Custom';

  const handlePresetChange = (p: string) => {
    form.setValue('preset', p);
    if (p !== 'Custom') {
      form.setValue('scale', SCALE_PRESETS[p] ?? SCALE_PRESETS['Ethiopian']);
    }
  };

  const onSubmit = (values: FormValues) => {
    setGradingPreset(values.preset);
    if (values.preset === 'Custom') {
      setCustomGrading({ scale: values.scale });
    }
    onNext();
  };

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Preset selector */}
        <FormField
          control={form.control}
          name="preset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('wizard.grading.preset')}</FormLabel>
              <Select value={field.value} onValueChange={handlePresetChange}>
                <FormControl>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {['Ethiopian', 'American', 'IGCSE', 'IB', 'Custom'].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Scale table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wizard.grading.letter')}</TableHead>
                <TableHead>{t('wizard.grading.min_pct')}</TableHead>
                <TableHead>{t('wizard.grading.max_pct')}</TableHead>
                <TableHead>{t('wizard.grading.gpa')}</TableHead>
                <TableHead>{t('wizard.grading.description')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, idx) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`scale.${idx}.letter`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} disabled={!isCustom} className="w-16" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`scale.${idx}.min`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" {...field} disabled={!isCustom} className="w-20" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`scale.${idx}.max`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" {...field} disabled={!isCustom} className="w-20" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`scale.${idx}.gpa`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" step="0.1" {...field} disabled={!isCustom} className="w-20" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`scale.${idx}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} disabled={!isCustom} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {isCustom && (
          <p className="text-sm text-muted-foreground">{t('wizard.grading.custom_hint')}</p>
        )}
      </form>
    </Form>
  );
}
