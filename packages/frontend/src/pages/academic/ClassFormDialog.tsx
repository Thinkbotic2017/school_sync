import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { classApi, academicYearApi, type Class } from '@/services/academic.service';
import { unwrapList } from '@/lib/api-helpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, { message: 'Class name is required' }),
  numericOrder: z.coerce.number().int().min(1, { message: 'Order must be at least 1' }),
  academicYearId: z.string().min(1, { message: 'Academic year is required' }),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Class;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClassFormDialog({
  open,
  onOpenChange,
  existing,
}: ClassFormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: academicYearsData } = useQuery({
    queryKey: ['academic-years', 'all'],
    queryFn: () => academicYearApi.list({ limit: 100 }),
  });

  const { data: academicYears } = unwrapList<{ id: string; name: string }>(academicYearsData);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      numericOrder: 1,
      academicYearId: '',
    },
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        name: existing.name,
        numericOrder: existing.numericOrder,
        academicYearId: existing.academicYearId,
      });
    } else {
      form.reset({ name: '', numericOrder: 1, academicYearId: '' });
    }
  }, [existing, open, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      existing
        ? classApi.update(existing.id, values)
        : classApi.create(values),
    onSuccess: () => {
      toast.success(t('academic.class.saved'));
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      onOpenChange(false);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {existing ? t('academic.class.edit') : t('academic.class.add')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            {/* Academic Year */}
            <FormField
              control={form.control}
              name="academicYearId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.class.academic_year')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('academic.class.select_academic_year')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {academicYears.map((y) => (
                        <SelectItem key={y.id} value={y.id}>
                          {y.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Class Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.class.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Grade 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Numeric Order */}
            <FormField
              control={form.control}
              name="numericOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.class.order')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('common.actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
