import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Trash2, PlusCircle } from 'lucide-react';

import { useWizardStore } from '@/store/wizard.store';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Schema ───────────────────────────────────────────────────────────────────

const sectionSchema = z.object({
  name: z.string().min(1),
  capacity: z.coerce.number().min(1).max(200),
});

const gradeSchema = z.object({
  name: z.string().min(1),
  displayOrder: z.number(),
  sectionCount: z.coerce.number().min(1).max(20),
  sections: z.array(sectionSchema),
});

const schema = z.object({
  grades: z.array(gradeSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSections(count: number, capacity: number) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length: count }, (_, i) => ({
    name: letters[i] ?? `S${i + 1}`,
    capacity,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step3GradeLevels({ onNext }: Props) {
  const { t } = useTranslation();
  const { grades, setGrades } = useWizardStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      grades: grades.map((g) => ({
        name: g.name,
        displayOrder: g.displayOrder,
        sectionCount: g.sections.length,
        sections: g.sections,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'grades',
  });

  const handleSectionCountChange = (idx: number, count: number) => {
    const current = form.getValues(`grades.${idx}.sections`);
    const capacity = current[0]?.capacity ?? 40;
    form.setValue(`grades.${idx}.sections`, buildSections(count, capacity));
    form.setValue(`grades.${idx}.sectionCount`, count);
  };

  const onSubmit = (values: FormValues) => {
    setGrades(
      values.grades.map((g, i) => ({
        name: g.name,
        displayOrder: i + 1,
        sections: g.sections,
      })),
    );
    onNext();
  };

  const addGrade = () => {
    append({
      name: `Grade ${fields.length + 1}`,
      displayOrder: fields.length + 1,
      sectionCount: 1,
      sections: [{ name: 'A', capacity: 40 }],
    });
  };

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wizard.grades.grade_name')}</TableHead>
                <TableHead className="w-28">{t('wizard.grades.sections')}</TableHead>
                <TableHead className="w-36">{t('wizard.grades.capacity')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, idx) => (
                <TableRow key={f.id}>
                  {/* Grade Name */}
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`grades.${idx}.name`}
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

                  {/* Section Count */}
                  <TableCell>
                    <Controller
                      control={form.control}
                      name={`grades.${idx}.sectionCount`}
                      render={({ field }) => (
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          {...field}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10) || 1;
                            field.onChange(v);
                            handleSectionCountChange(idx, v);
                          }}
                        />
                      )}
                    />
                  </TableCell>

                  {/* Capacity per section */}
                  <TableCell>
                    <Controller
                      control={form.control}
                      name={`grades.${idx}.sections.0.capacity`}
                      render={({ field }) => (
                        <Input
                          type="number"
                          min={1}
                          max={200}
                          {...field}
                          onChange={(e) => {
                            const cap = parseInt(e.target.value, 10) || 40;
                            const count = form.getValues(`grades.${idx}.sectionCount`);
                            field.onChange(cap);
                            // Update all sections' capacity
                            const secs = buildSections(count, cap);
                            form.setValue(`grades.${idx}.sections`, secs);
                          }}
                        />
                      )}
                    />
                  </TableCell>

                  {/* Remove */}
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

        <Button type="button" variant="outline" size="sm" onClick={addGrade}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('wizard.grades.add_grade')}
        </Button>
      </form>
    </Form>
  );
}
