import { useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

// ─── Schema ──────────────────────────────────────────────────────────────────

const CURRENCIES = ['ETB', 'USD', 'EUR', 'GBP', 'KES', 'NGN', 'INR', 'ZAR', 'Custom'];

const CLEARANCE_GATES = [
  'Report Card',
  'Transfer Certificate',
  'Next Year Enrollment',
  'Exams',
];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Mobile Money', 'Cheque', 'Online'];

const schema = z.object({
  currency: z.string().min(1),
  customCurrency: z.string().optional(),
  latePenaltyGraceDays: z.coerce.number().min(0),
  latePenaltyPercent: z.coerce.number().min(0).max(100),
  maxPenaltyPercent: z.coerce.number().min(0).max(100),
  clearanceRequired: z.array(z.string()),
  paymentMethods: z.array(z.string()).min(1),
  siblingDiscount2nd: z.coerce.number().min(0).max(100),
  siblingDiscount3rd: z.coerce.number().min(0).max(100),
  siblingDiscount4th: z.coerce.number().min(0).max(100),
  fullPaymentAnnualDiscount: z.coerce.number().min(0).max(100),
});

type FormValues = z.infer<typeof schema>;

// ─── Skeleton ────────────────────────────────────────────────────────────────

function FeeSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 7 }).map((_, i) => (
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

export function FeeSettings() {
  const { t } = useTranslation();
  const { configs, isLoading, refetch } = useTenantConfig();
  const [showCustomCurrency, setShowCustomCurrency] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currency: 'ETB',
      customCurrency: '',
      latePenaltyGraceDays: 7,
      latePenaltyPercent: 2,
      maxPenaltyPercent: 10,
      clearanceRequired: ['Report Card'],
      paymentMethods: ['Cash'],
      siblingDiscount2nd: 10,
      siblingDiscount3rd: 15,
      siblingDiscount4th: 20,
      fullPaymentAnnualDiscount: 5,
    },
  });

  useEffect(() => {
    if (configs.fees) {
      const fees = configs.fees;
      const isCustom = !CURRENCIES.includes(fees.currency) || fees.currency === 'Custom';
      setShowCustomCurrency(isCustom);
      form.reset({
        currency: isCustom ? 'Custom' : fees.currency,
        customCurrency: isCustom ? fees.currency : '',
        latePenaltyGraceDays: fees.latePenalty?.graceDays ?? 7,
        latePenaltyPercent: fees.latePenalty?.penaltyPercent ?? 2,
        maxPenaltyPercent: fees.latePenalty?.maxPenaltyPercent ?? 10,
        clearanceRequired: fees.clearanceRequired ?? [],
        paymentMethods: fees.paymentMethods ?? ['Cash'],
        siblingDiscount2nd: fees.discounts?.sibling?.['2nd'] ?? 10,
        siblingDiscount3rd: fees.discounts?.sibling?.['3rd'] ?? 15,
        siblingDiscount4th: fees.discounts?.sibling?.['4th'] ?? 20,
        fullPaymentAnnualDiscount: fees.discounts?.fullPaymentAnnual ?? 5,
      });
    }
  }, [configs.fees, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const resolvedCurrency = values.currency === 'Custom' ? (values.customCurrency ?? 'USD') : values.currency;
      const payload = {
        currency: resolvedCurrency,
        latePenalty: {
          graceDays: values.latePenaltyGraceDays,
          penaltyPercent: values.latePenaltyPercent,
          maxPenaltyPercent: values.maxPenaltyPercent,
        },
        clearanceRequired: values.clearanceRequired,
        paymentMethods: values.paymentMethods,
        discounts: {
          sibling: {
            '2nd': values.siblingDiscount2nd,
            '3rd': values.siblingDiscount3rd,
            '4th': values.siblingDiscount4th,
          },
          fullPaymentAnnual: values.fullPaymentAnnualDiscount,
        },
      };
      return configApi.updateCategory('fees', payload as Record<string, unknown>);
    },
    onSuccess: () => { refetch(); toast.success(t('settings.saved')); },
    onError: () => toast.error(t('settings.save_error')),
  });

  if (isLoading) return <FeeSkeleton />;

  const clearanceRequired = form.watch('clearanceRequired');
  const paymentMethods = form.watch('paymentMethods');

  const toggleArray = (
    fieldName: 'clearanceRequired' | 'paymentMethods',
    current: string[],
    value: string,
    checked: boolean,
  ) => {
    form.setValue(
      fieldName,
      checked ? [...current, value] : current.filter((v) => v !== value),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.tabs.fees')}</CardTitle>
        <CardDescription>{t('settings.fees.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
            {/* Currency */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('settings.fees.currency')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setShowCustomCurrency(v === 'Custom');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showCustomCurrency && (
                <FormField
                  control={form.control}
                  name="customCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.fees.custom_currency_code')}</FormLabel>
                      <FormControl>
                        <Input placeholder="XYZ" maxLength={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Separator />

            {/* Late Penalty */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t('settings.fees.late_penalty')}</p>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="latePenaltyGraceDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.fees.grace_days')}</FormLabel>
                      <FormControl><Input type="number" min={0} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="latePenaltyPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.fees.penalty_pct')}</FormLabel>
                      <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxPenaltyPercent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.fees.max_penalty_pct')}</FormLabel>
                      <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Clearance Gates */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t('settings.fees.clearance_gates')}</p>
              <div className="grid grid-cols-2 gap-2">
                {CLEARANCE_GATES.map((gate) => (
                  <label key={gate} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={clearanceRequired.includes(gate)}
                      onCheckedChange={(checked) =>
                        toggleArray('clearanceRequired', clearanceRequired, gate, !!checked)
                      }
                    />
                    <span className="text-sm">{t(`settings.fees.gate_${gate.toLowerCase().replace(/\s+/g, '_')}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Payment Methods */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t('settings.fees.payment_methods')}</p>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={paymentMethods.includes(method)}
                      onCheckedChange={(checked) =>
                        toggleArray('paymentMethods', paymentMethods, method, !!checked)
                      }
                    />
                    <span className="text-sm">{t(`settings.fees.method_${method.toLowerCase().replace(/\s+/g, '_')}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Sibling Discounts */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">{t('settings.fees.sibling_discounts')}</p>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="siblingDiscount2nd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.fees.sibling_2nd')}</FormLabel>
                      <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="siblingDiscount3rd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.fees.sibling_3rd')}</FormLabel>
                      <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="siblingDiscount4th"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.fees.sibling_4th')}</FormLabel>
                      <FormControl><Input type="number" min={0} max={100} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Full Payment Discount */}
            <FormField
              control={form.control}
              name="fullPaymentAnnualDiscount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.fees.full_payment_discount')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} className="w-32" {...field} />
                  </FormControl>
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
