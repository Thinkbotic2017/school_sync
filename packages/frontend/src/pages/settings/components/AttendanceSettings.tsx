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
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  mode: z.enum(['DAILY', 'PER_PERIOD', 'BOTH']),
  graceMinutes: z.coerce.number().min(0),
  notifyOnAbsence: z.boolean(),
  notificationChannels: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function AttSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
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

export function AttendanceSettings() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'DAILY',
      graceMinutes: 10,
      notifyOnAbsence: true,
      notificationChannels: ['Push Notification'],
    },
  });

  useEffect(() => {
    if (configs.attendance) {
      form.reset({
        mode: configs.attendance.mode ?? 'DAILY',
        graceMinutes: configs.attendance.graceMinutes ?? 10,
        notifyOnAbsence: configs.attendance.notifyOnAbsence ?? true,
        notificationChannels: configs.attendance.notificationChannels ?? [],
      });
    }
  }, [configs.attendance, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      configApi.updateCategory('attendance', values as Record<string, unknown>),
    onSuccess: () => { refetch(); toast.success(t('settings.saved')); },
    onError: () => toast.error(t('settings.save_error')),
  });

  if (isLoading) return <AttSkeleton />;

  const notifyOnAbsence = form.watch('notifyOnAbsence');
  const notificationChannels = form.watch('notificationChannels');

  const toggleChannel = (channel: string, checked: boolean) => {
    form.setValue(
      'notificationChannels',
      checked
        ? [...notificationChannels, channel]
        : notificationChannels.filter((c) => c !== channel),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tabs.attendance')}</CardTitle>
        <CardDescription>{t('settings.attendance.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            {/* Attendance Mode */}
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.attendance.mode')}</FormLabel>
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
                            {t(`settings.attendance.mode_${mode.toLowerCase()}`)}
                          </FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Grace Minutes */}
            <FormField
              control={form.control}
              name="graceMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.attendance.grace_minutes')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} className="w-32" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Notify on Absence */}
            <FormField
              control={form.control}
              name="notifyOnAbsence"
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
                      {t('settings.attendance.notify_on_absence')}
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Notification Channels — shown only when notify is enabled */}
            {notifyOnAbsence && (
              <div className="space-y-3">
                <FormLabel>{t('settings.attendance.notification_channels')}</FormLabel>
                <div className="flex gap-6">
                  {['SMS', 'Push Notification'].map((channel) => (
                    <label key={channel} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={notificationChannels.includes(channel)}
                        onCheckedChange={(checked) => toggleChannel(channel, !!checked)}
                      />
                      <span className="text-sm">
                        {t(`settings.attendance.channel_${channel.toLowerCase().replace(/\s+/g, '_')}`)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
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
