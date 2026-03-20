import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

import { useTenantConfig } from '@/hooks/useTenantConfig';
import { configApi } from '@/services/config.service';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  minimumOverallAverage: z.coerce.number().min(0).max(100),
  maximumFailedSubjects: z.coerce.number().min(0).max(20),
  autoPromoteGrades: z.string(), // comma-separated
  reExamAllowed: z.boolean(),
  reExamMaxAttempts: z.coerce.number().min(1),
  rankingEnabledFromGrade: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function PromoSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
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

export function PromotionSettings() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      minimumOverallAverage: 50,
      maximumFailedSubjects: 2,
      autoPromoteGrades: '',
      reExamAllowed: true,
      reExamMaxAttempts: 1,
      rankingEnabledFromGrade: 'Grade 7',
    },
  });

  useEffect(() => {
    if (configs.promotion) {
      const promo = configs.promotion;
      form.reset({
        minimumOverallAverage: promo.minimumOverallAverage ?? 50,
        maximumFailedSubjects: promo.maximumFailedSubjects ?? 2,
        autoPromoteGrades: (promo.autoPromoteGrades ?? []).join(', '),
        reExamAllowed: promo.reExamAllowed ?? true,
        reExamMaxAttempts: promo.reExamMaxAttempts ?? 1,
        rankingEnabledFromGrade: promo.rankingEnabledFromGrade ?? '',
      });
    }
  }, [configs.promotion, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        minimumOverallAverage: values.minimumOverallAverage,
        maximumFailedSubjects: values.maximumFailedSubjects,
        autoPromoteGrades: values.autoPromoteGrades
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        reExamAllowed: values.reExamAllowed,
        reExamMaxAttempts: values.reExamMaxAttempts,
        rankingEnabledFromGrade: values.rankingEnabledFromGrade,
      };
      return configApi.updateCategory('promotion', payload as Record<string, unknown>);
    },
    onSuccess: () => { refetch(); toast.success(t('settings.saved')); },
    onError: () => toast.error(t('settings.save_error')),
  });

  if (isLoading) return <PromoSkeleton />;

  const reExamAllowed = form.watch('reExamAllowed');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tabs.promotion')}</CardTitle>
        <CardDescription>{t('settings.promotion.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minimumOverallAverage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.promotion.min_average')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maximumFailedSubjects"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.promotion.max_failed_subjects')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={20} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="autoPromoteGrades"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.promotion.auto_promote_grades')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Grade 1, Grade 2, Grade 3, ..." {...field} />
                  </FormControl>
                  <FormDescription>{t('settings.promotion.auto_promote_hint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rankingEnabledFromGrade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.promotion.ranking_from_grade')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Grade 7" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Re-exam Toggle */}
            <FormField
              control={form.control}
              name="reExamAllowed"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0 cursor-pointer">
                      {t('settings.promotion.re_exam_allowed')}
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {reExamAllowed && (
              <FormField
                control={form.control}
                name="reExamMaxAttempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.promotion.re_exam_attempts')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} className="w-32" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.actions.loading') : t('common.actions.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
