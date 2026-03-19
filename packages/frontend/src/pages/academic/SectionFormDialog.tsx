import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { sectionApi, classApi, type Section } from '@/services/academic.service';
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
  classId: z.string().min(1, { message: 'Class is required' }),
  name: z.string().min(1, { message: 'Section name is required' }),
  capacity: z.coerce.number().int().min(1, { message: 'Capacity must be at least 1' }),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Section;
  defaultClassId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SectionFormDialog({
  open,
  onOpenChange,
  existing,
  defaultClassId,
}: SectionFormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: classesData } = useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => classApi.list({ limit: 200 }),
  });
  const classes = classesData?.data?.data?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      classId: defaultClassId ?? '',
      name: '',
      capacity: 40,
    },
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        classId: existing.classId,
        name: existing.name,
        capacity: existing.capacity,
      });
    } else {
      form.reset({
        classId: defaultClassId ?? '',
        name: '',
        capacity: 40,
      });
    }
  }, [existing, open, defaultClassId, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      existing
        ? sectionApi.update(existing.id, values)
        : sectionApi.create(values),
    onSuccess: () => {
      toast.success(
        existing
          ? t('academic.section.edit') + ' saved'
          : t('academic.section.add') + ' successful',
      );
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      onOpenChange(false);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {existing ? t('academic.section.edit') : t('academic.section.add')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            {/* Class */}
            <FormField
              control={form.control}
              name="classId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.section.class')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Section Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.section.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Capacity */}
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.section.capacity')}</FormLabel>
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
