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
} from '@/components/ui/form';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  showRank: z.boolean(),
  showAttendance: z.boolean(),
  showConduct: z.boolean(),
  showTeacherRemarks: z.boolean(),
  showPrincipalRemarks: z.boolean(),
  showPhoto: z.boolean(),
  primaryLanguage: z.string().min(1),
  secondaryLanguage: z.string(),
});

type FormValues = z.infer<typeof schema>;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function RCSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-24 mt-4" />
    </div>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ReportCardSettings() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      showRank: true,
      showAttendance: true,
      showConduct: true,
      showTeacherRemarks: true,
      showPrincipalRemarks: true,
      showPhoto: true,
      primaryLanguage: 'en',
      secondaryLanguage: '',
    },
  });

  useEffect(() => {
    if (configs.reportCard) {
      const rc = configs.reportCard;
      form.reset({
        showRank: rc.showRank ?? true,
        showAttendance: rc.showAttendance ?? true,
        showConduct: rc.showConduct ?? true,
        showTeacherRemarks: rc.showTeacherRemarks ?? true,
        showPrincipalRemarks: rc.showPrincipalRemarks ?? true,
        showPhoto: rc.showPhoto ?? true,
        primaryLanguage: rc.primaryLanguage ?? 'en',
        secondaryLanguage: rc.languages?.find((l) => l !== rc.primaryLanguage) ?? '',
      });
    }
  }, [configs.reportCard, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const languages = [values.primaryLanguage];
      if (values.secondaryLanguage) languages.push(values.secondaryLanguage);
      const payload = {
        showRank: values.showRank,
        showAttendance: values.showAttendance,
        showConduct: values.showConduct,
        showTeacherRemarks: values.showTeacherRemarks,
        showPrincipalRemarks: values.showPrincipalRemarks,
        showPhoto: values.showPhoto,
        primaryLanguage: values.primaryLanguage,
        languages,
      };
      return configApi.updateCategory('reportCard', payload as Record<string, unknown>);
    },
    onSuccess: () => { refetch(); toast.success(t('settings.saved')); },
    onError: () => toast.error(t('settings.save_error')),
  });

  if (isLoading) return <RCSkeleton />;

  const languages = [
    { value: 'en', label: t('settings.profile.lang_english') },
    { value: 'am', label: t('settings.profile.lang_amharic') },
    { value: 'sw', label: t('settings.profile.lang_swahili') },
    { value: 'hi', label: t('settings.profile.lang_hindi') },
  ];

  const toggleFields: Array<{ name: keyof FormValues; labelKey: string }> = [
    { name: 'showRank', labelKey: 'settings.report_card.show_rank' },
    { name: 'showAttendance', labelKey: 'settings.report_card.show_attendance' },
    { name: 'showConduct', labelKey: 'settings.report_card.show_conduct' },
    { name: 'showTeacherRemarks', labelKey: 'settings.report_card.show_teacher_remarks' },
    { name: 'showPrincipalRemarks', labelKey: 'settings.report_card.show_principal_remarks' },
    { name: 'showPhoto', labelKey: 'settings.report_card.show_photo' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tabs.report_card')}</CardTitle>
        <CardDescription>{t('settings.report_card.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            {/* Toggle Switches */}
            <div className="space-y-1">
              {toggleFields.map(({ name, labelKey }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name as 'showRank'}
                  render={({ field }) => (
                    <FormItem>
                      <ToggleRow
                        label={t(labelKey)}
                        checked={field.value as boolean}
                        onChange={field.onChange}
                      />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <Separator />

            {/* Languages */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primaryLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.report_card.primary_language')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {languages.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondaryLanguage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.report_card.secondary_language')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('settings.profile.lang_none')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">{t('settings.profile.lang_none')}</SelectItem>
                        {languages.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
