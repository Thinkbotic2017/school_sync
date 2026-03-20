import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { PlusCircle, Trash2 } from 'lucide-react';

import { useWizardStore, type WizardGradeGroup } from '@/store/wizard.store';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaultGroups(grades: string[]): WizardGradeGroup[] {
  const lower = grades.filter((g) => {
    const m = g.match(/\d+/);
    return m ? parseInt(m[0], 10) <= 4 : g.startsWith('KG');
  });
  const upper = grades.filter((g) => {
    const m = g.match(/\d+/);
    return m ? parseInt(m[0], 10) >= 5 && parseInt(m[0], 10) <= 8 : false;
  });
  const secondary = grades.filter((g) => {
    const m = g.match(/\d+/);
    return m ? parseInt(m[0], 10) >= 9 : false;
  });

  const groups: WizardGradeGroup[] = [];

  if (lower.length > 0) {
    groups.push({
      gradeGroup: 'Lower Grades',
      grades: lower,
      caWeight: 100,
      examWeight: 0,
      categories: [
        { name: 'Tests', weight: 40 },
        { name: 'Homework', weight: 30 },
        { name: 'Participation', weight: 30 },
      ],
    });
  }
  if (upper.length > 0) {
    groups.push({
      gradeGroup: 'Upper Grades',
      grades: upper,
      caWeight: 60,
      examWeight: 40,
      categories: [
        { name: 'Tests', weight: 50 },
        { name: 'Assignments', weight: 30 },
        { name: 'Participation', weight: 20 },
      ],
    });
  }
  if (secondary.length > 0) {
    groups.push({
      gradeGroup: 'Secondary',
      grades: secondary,
      caWeight: 50,
      examWeight: 50,
      categories: [
        { name: 'Tests', weight: 60 },
        { name: 'Assignments', weight: 40 },
      ],
    });
  }

  if (groups.length === 0 && grades.length > 0) {
    groups.push({
      gradeGroup: 'All Grades',
      grades,
      caWeight: 60,
      examWeight: 40,
      categories: [{ name: 'Tests', weight: 60 }, { name: 'Assignments', weight: 40 }],
    });
  }

  return groups;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1),
  weight: z.coerce.number().min(1).max(100),
});

const groupSchema = z.object({
  gradeGroup: z.string().min(1),
  grades: z.array(z.string()),
  caWeight: z.coerce.number().min(0).max(100),
  examWeight: z.coerce.number().min(0).max(100),
  categories: z.array(categorySchema).min(1),
});

const schema = z.object({
  groups: z.array(groupSchema).min(1),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step6AssessmentWeights({ onNext }: Props) {
  const { t } = useTranslation();
  const { grades, assessmentWeights, setAssessmentWeights } = useWizardStore();
  const gradeNames = grades.map((g) => g.name);

  const defaultGroups = buildDefaultGroups(gradeNames);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      groups: assessmentWeights.length > 0 ? assessmentWeights : defaultGroups,
    },
  });

  useEffect(() => {
    if (assessmentWeights.length === 0 && gradeNames.length > 0) {
      form.reset({ groups: defaultGroups });
    }
  }, [gradeNames.join(',')]);

  const { fields: groupFields } = useFieldArray({ control: form.control, name: 'groups' });

  const onSubmit = (values: FormValues) => {
    setAssessmentWeights(
      values.groups.map((g) => ({
        ...g,
        examWeight: 100 - g.caWeight,
      })),
    );
    onNext();
  };

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {groupFields.map((gf, gIdx) => (
          <GroupCard key={gf.id} form={form} groupIndex={gIdx} t={t} />
        ))}
      </form>
    </Form>
  );
}

// ─── GroupCard sub-component ──────────────────────────────────────────────────

function GroupCard({
  form,
  groupIndex,
  t,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
  groupIndex: number;
  t: (key: string) => string;
}) {
  const { fields: catFields, append: appendCat, remove: removeCat } = useFieldArray({
    control: form.control,
    name: `groups.${groupIndex}.categories`,
  });

  const caWeight = form.watch(`groups.${groupIndex}.caWeight`);
  const examWeight = 100 - (Number(caWeight) || 0);
  const groupGrades: string[] = form.watch(`groups.${groupIndex}.grades`) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <FormField
            control={form.control}
            name={`groups.${groupIndex}.gradeGroup`}
            render={({ field }) => (
              <FormItem className="flex-1 mr-4">
                <FormControl>
                  <Input className="font-semibold" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-wrap gap-1">
            {groupGrades.slice(0, 4).map((g) => (
              <Badge key={g} variant="secondary" className="text-xs">
                {g}
              </Badge>
            ))}
            {groupGrades.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{groupGrades.length - 4}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CA / Exam weights */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name={`groups.${groupIndex}.caWeight`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wizard.assessment.ca_weight')}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={100} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <FormLabel>{t('wizard.assessment.exam_weight')}</FormLabel>
            <Input
              type="number"
              value={examWeight < 0 ? 0 : examWeight}
              disabled
              className="mt-2"
            />
          </div>
        </div>

        {/* CA categories */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('wizard.assessment.ca_categories')}</p>
          {catFields.map((cf, cIdx) => (
            <div key={cf.id} className="flex items-center gap-2">
              <FormField
                control={form.control}
                name={`groups.${groupIndex}.categories.${cIdx}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input placeholder={t('wizard.assessment.cat_name')} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`groups.${groupIndex}.categories.${cIdx}.weight`}
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormControl>
                      <Input type="number" min={1} max={100} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCat(cIdx)}
                disabled={catFields.length === 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendCat({ name: '', weight: 0 })}
          >
            <PlusCircle className="mr-2 h-3 w-3" />
            {t('wizard.assessment.add_category')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
