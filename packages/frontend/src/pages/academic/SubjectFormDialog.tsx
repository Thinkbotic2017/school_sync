import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  subjectApi,
  academicYearApi,
  type Subject,
} from '@/services/academic.service';
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
  academicYearId: z.string().min(1, { message: 'Academic year is required' }),
  name: z.string().min(1, { message: 'Subject name is required' }),
  nameAmharic: z.string().optional(),
  code: z.string().min(1, { message: 'Subject code is required' }),
  type: z.enum(['CORE', 'ELECTIVE', 'EXTRACURRICULAR']),
});

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Subject;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubjectFormDialog({
  open,
  onOpenChange,
  existing,
}: SubjectFormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: yearsData } = useQuery({
    queryKey: ['academic-years', 'all'],
    queryFn: () => academicYearApi.list({ limit: 100 }),
  });
  const academicYears = yearsData?.data?.data?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      academicYearId: '',
      name: '',
      nameAmharic: '',
      code: '',
      type: 'CORE',
    },
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        academicYearId: existing.academicYearId ?? '',
        name: existing.name,
        nameAmharic: existing.nameAmharic ?? '',
        code: existing.code,
        type: existing.type,
      });
    } else {
      form.reset({
        academicYearId: '',
        name: '',
        nameAmharic: '',
        code: '',
        type: 'CORE',
      });
    }
  }, [existing, open, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        nameAmharic: values.nameAmharic || undefined,
      };
      return existing
        ? subjectApi.update(existing.id, payload)
        : subjectApi.create(payload);
    },
    onSuccess: () => {
      toast.success(
        existing
          ? t('academic.subject.edit') + ' saved'
          : t('academic.subject.add') + ' successful',
      );
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      onOpenChange(false);
    },
    onError: () => toast.error(t('common.errors.server_error')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existing ? t('academic.subject.edit') : t('academic.subject.add')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="space-y-4"
          >
            {/* Academic Year */}
            <FormField
              control={form.control}
              name="academicYearId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.class.academic_year')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select academic year" />
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

            {/* Subject Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.subject.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder="Mathematics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amharic Name */}
            <FormField
              control={form.control}
              name="nameAmharic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('academic.subject.name_amharic')}{' '}
                    <span className="text-muted-foreground text-xs">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="ሒሳብ"
                      lang="am"
                      className="font-[var(--font-ethiopic)]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subject Code */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.subject.code')}</FormLabel>
                  <FormControl>
                    <Input placeholder="MATH-01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('academic.subject.type')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CORE">
                        {t('academic.subject.type_core')}
                      </SelectItem>
                      <SelectItem value="ELECTIVE">
                        {t('academic.subject.type_elective')}
                      </SelectItem>
                      <SelectItem value="EXTRACURRICULAR">
                        {t('academic.subject.type_extracurricular')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
