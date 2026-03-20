import { useForm, useFieldArray } from 'react-hook-form';
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
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

// ─── Schema ───────────────────────────────────────────────────────────────────

const feeSchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().min(0),
  frequency: z.string().min(1),
  applicableGrades: z.array(z.string()),
});

const schema = z.object({
  fees: z.array(feeSchema).min(1),
  paymentMethods: z.array(z.string()).min(1),
  graceDays: z.coerce.number().min(0),
  penaltyPercent: z.coerce.number().min(0).max(100),
});

type FormValues = z.infer<typeof schema>;

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'ONLINE'];

const FREQUENCY_OPTIONS = [
  'ONE_TIME',
  'MONTHLY',
  'QUARTERLY',
  'SEMESTER',
  'ANNUAL',
];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step7FeeStructure({ onNext }: Props) {
  const { t } = useTranslation();
  const { feeStructures, setFeeStructures } = useWizardStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fees: feeStructures.length > 0
        ? feeStructures
        : [{ name: 'Tuition Fee', amount: 0, frequency: 'MONTHLY', applicableGrades: ['All Grades'] }],
      paymentMethods: ['CASH', 'BANK_TRANSFER'],
      graceDays: 5,
      penaltyPercent: 5,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'fees' });

  const onSubmit = (values: FormValues) => {
    setFeeStructures(values.fees);
    onNext();
  };

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Fee rows */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('wizard.fees.name')}</TableHead>
                <TableHead className="w-32">{t('wizard.fees.amount')}</TableHead>
                <TableHead className="w-36">{t('wizard.fees.frequency')}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f, idx) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`fees.${idx}.name`}
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
                      name={`fees.${idx}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input type="number" min={0} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TableCell>
                  <TableCell>
                    <FormField
                      control={form.control}
                      name={`fees.${idx}.frequency`}
                      render={({ field }) => (
                        <FormItem>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {FREQUENCY_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {t(`wizard.fees.freq_${opt.toLowerCase()}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
            append({ name: '', amount: 0, frequency: 'MONTHLY', applicableGrades: ['All Grades'] })
          }
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('wizard.fees.add_fee')}
        </Button>

        {/* Payment methods */}
        <div className="space-y-3">
          <FormLabel>{t('wizard.fees.payment_methods')}</FormLabel>
          <div className="flex flex-wrap gap-4">
            {PAYMENT_METHODS.map((method) => {
              const methods = form.watch('paymentMethods');
              const checked = methods.includes(method);
              return (
                <label key={method} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const current = form.getValues('paymentMethods');
                      if (v) {
                        form.setValue('paymentMethods', [...current, method]);
                      } else {
                        form.setValue(
                          'paymentMethods',
                          current.filter((m) => m !== method),
                        );
                      }
                    }}
                  />
                  <span className="text-sm">
                    {t(`wizard.fees.method_${method.toLowerCase()}`)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Late penalty */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="graceDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wizard.fees.grace_days')}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="penaltyPercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('wizard.fees.penalty_pct')}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} max={100} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
