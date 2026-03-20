import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Trash2, PlusCircle } from 'lucide-react';

import { useWizardStore, type WizardSubject } from '@/store/wizard.store';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Presets ──────────────────────────────────────────────────────────────────

type SubjectPreset = Pick<WizardSubject, 'name' | 'code' | 'type' | 'periodsPerWeek'>;

const ETHIOPIAN_MOE: SubjectPreset[] = [
  { name: 'Mathematics', code: 'MATH', type: 'CORE', periodsPerWeek: 5 },
  { name: 'English', code: 'ENG', type: 'CORE', periodsPerWeek: 5 },
  { name: 'Amharic', code: 'AMH', type: 'CORE', periodsPerWeek: 5 },
  { name: 'Science', code: 'SCI', type: 'CORE', periodsPerWeek: 4 },
  { name: 'Social Studies', code: 'SOC', type: 'CORE', periodsPerWeek: 3 },
  { name: 'ICT', code: 'ICT', type: 'CORE', periodsPerWeek: 2 },
  { name: 'Art', code: 'ART', type: 'ELECTIVE', periodsPerWeek: 2 },
  { name: 'Physical Education', code: 'PE', type: 'ELECTIVE', periodsPerWeek: 2 },
];

const BRITISH: SubjectPreset[] = [
  { name: 'Mathematics', code: 'MATH', type: 'CORE', periodsPerWeek: 5 },
  { name: 'English', code: 'ENG', type: 'CORE', periodsPerWeek: 5 },
  { name: 'Science', code: 'SCI', type: 'CORE', periodsPerWeek: 4 },
  { name: 'History', code: 'HIST', type: 'CORE', periodsPerWeek: 3 },
  { name: 'Geography', code: 'GEO', type: 'CORE', periodsPerWeek: 3 },
  { name: 'Physical Education', code: 'PE', type: 'ELECTIVE', periodsPerWeek: 2 },
  { name: 'Music', code: 'MUS', type: 'ELECTIVE', periodsPerWeek: 2 },
  { name: 'Art', code: 'ART', type: 'ELECTIVE', periodsPerWeek: 2 },
];

const PRESETS: Record<string, SubjectPreset[]> = {
  ethiopian: ETHIOPIAN_MOE,
  british: BRITISH,
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const subjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(['CORE', 'ELECTIVE']),
  periodsPerWeek: z.coerce.number().min(1).max(20),
});

const schema = z.object({
  subjects: z.array(subjectSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step4Subjects({ onNext }: Props) {
  const { t } = useTranslation();
  const { subjects, grades, setSubjects } = useWizardStore();
  const allGradeNames = grades.map((g) => g.name);

  const toFormSubject = (s: WizardSubject | SubjectPreset) => ({
    name: s.name,
    code: s.code,
    type: s.type as 'CORE' | 'ELECTIVE',
    periodsPerWeek: s.periodsPerWeek,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjects:
        subjects.length > 0
          ? subjects.map(toFormSubject)
          : ETHIOPIAN_MOE.map(toFormSubject),
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'subjects',
  });

  const applyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (preset) replace(preset.map(toFormSubject));
  };

  const onSubmit = (values: FormValues) => {
    setSubjects(
      values.subjects.map((s) => ({
        ...s,
        gradesApplicable: allGradeNames,
      })),
    );
    onNext();
  };

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Preset selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{t('wizard.subjects.load_preset')}</span>
          <Select onValueChange={applyPreset}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('wizard.subjects.select_preset')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ethiopian">{t('wizard.subjects.preset_ethiopian')}</SelectItem>
              <SelectItem value="british">{t('wizard.subjects.preset_british')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subjects table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wizard.subjects.name')}</TableHead>
                <TableHead className="w-28">{t('wizard.subjects.code')}</TableHead>
                <TableHead className="w-32">{t('wizard.subjects.type')}</TableHead>
                <TableHead className="w-32">{t('wizard.subjects.periods_per_week')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, idx) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`subjects.${idx}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`subjects.${idx}.code`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} className="uppercase" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`subjects.${idx}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CORE">{t('wizard.subjects.type_core')}</SelectItem>
                              <SelectItem value="ELECTIVE">{t('wizard.subjects.type_elective')}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`subjects.${idx}.periodsPerWeek`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" min={1} max={20} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(idx)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
            append({ name: '', code: '', type: 'CORE', periodsPerWeek: 3 })
          }
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('wizard.subjects.add_subject')}
        </Button>

        {/* Hidden label for grades context */}
        {allGradeNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('wizard.subjects.applies_to_all_grades', { count: allGradeNames.length })}
          </p>
        )}
      </form>
    </Form>
  );
}
