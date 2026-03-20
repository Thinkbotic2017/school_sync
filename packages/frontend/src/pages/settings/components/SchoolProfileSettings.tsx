import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

import { useTenantConfig } from '@/hooks/useTenantConfig';
import { configApi } from '@/services/config.service';
import type { GeneralConfig } from '@/types/config';

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

// ─── Country presets ─────────────────────────────────────────────────────────

const countryPresets: Record<
  string,
  { calendarType: GeneralConfig['calendarType']; timezone: string; locale: string }
> = {
  Ethiopia: { calendarType: 'ETHIOPIAN', timezone: 'Africa/Addis_Ababa', locale: 'am' },
  Kenya: { calendarType: 'GREGORIAN', timezone: 'Africa/Nairobi', locale: 'en' },
  Nigeria: { calendarType: 'GREGORIAN', timezone: 'Africa/Lagos', locale: 'en' },
  India: { calendarType: 'GREGORIAN', timezone: 'Asia/Kolkata', locale: 'en' },
  'United States': { calendarType: 'GREGORIAN', timezone: 'America/New_York', locale: 'en' },
  'United Kingdom': { calendarType: 'GREGORIAN', timezone: 'Europe/London', locale: 'en' },
  Generic: { calendarType: 'GREGORIAN', timezone: 'UTC', locale: 'en' },
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  country: z.string().min(1),
  calendarType: z.enum(['GREGORIAN', 'ETHIOPIAN']),
  timezone: z.string().min(1),
  locale: z.string().min(1),
  secondaryLocale: z.string(),
  currency: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SchoolProfileSettings() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      country: 'Ethiopia',
      calendarType: 'GREGORIAN',
      timezone: 'UTC',
      locale: 'en',
      secondaryLocale: '',
      currency: 'USD',
    },
  });

  // Initialize from config when loaded
  useEffect(() => {
    if (configs.general) {
      form.reset({
        country: configs.general.country ?? 'Ethiopia',
        calendarType: configs.general.calendarType ?? 'GREGORIAN',
        timezone: configs.general.timezone ?? 'UTC',
        locale: configs.general.locale ?? 'en',
        secondaryLocale: configs.general.secondaryLocale ?? '',
        currency: configs.general.currency ?? 'USD',
      });
    }
  }, [configs.general, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      configApi.updateCategory('general', values as Record<string, unknown>),
    onSuccess: () => {
      refetch();
      toast.success(t('settings.saved'));
    },
    onError: () => toast.error(t('settings.save_error')),
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  const handleCountryChange = (country: string, onChange: (v: string) => void) => {
    onChange(country);
    const preset = countryPresets[country];
    if (preset) {
      form.setValue('calendarType', preset.calendarType);
      form.setValue('timezone', preset.timezone);
      form.setValue('locale', preset.locale);
    }
  };

  if (isLoading) return <ProfileSkeleton />;

  const languages = [
    { value: 'en', label: t('settings.profile.lang_english') },
    { value: 'am', label: t('settings.profile.lang_amharic') },
    { value: 'sw', label: t('settings.profile.lang_swahili') },
    { value: 'hi', label: t('settings.profile.lang_hindi') },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tabs.profile')}</CardTitle>
        <CardDescription>{t('settings.profile.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Country */}
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.profile.country')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => handleCountryChange(v, field.onChange)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('settings.profile.country_placeholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.keys(countryPresets).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Calendar Type */}
            <FormField
              control={form.control}
              name="calendarType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.profile.calendar_type')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="GREGORIAN">{t('settings.profile.cal_gregorian')}</SelectItem>
                      <SelectItem value="ETHIOPIAN">{t('settings.profile.cal_ethiopian')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Timezone */}
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.profile.timezone')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Africa/Addis_Ababa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Currency */}
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.profile.currency')}</FormLabel>
                  <FormControl>
                    <Input placeholder="ETB" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Primary Language */}
            <FormField
              control={form.control}
              name="locale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.profile.primary_language')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {languages.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Secondary Language */}
            <FormField
              control={form.control}
              name="secondaryLocale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.profile.secondary_language')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('settings.profile.lang_none')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">{t('settings.profile.lang_none')}</SelectItem>
                      {languages.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.actions.loading') : t('common.actions.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
