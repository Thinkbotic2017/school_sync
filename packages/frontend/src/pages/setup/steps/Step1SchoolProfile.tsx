import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';

import { useWizardStore, type WizardGrade } from '@/store/wizard.store';
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

// ─── Country presets ──────────────────────────────────────────────────────────

const COUNTRY_PRESETS: Record<
  string,
  { flag: string; calendarType: string; timezone: string; locale: string }
> = {
  Ethiopia: { flag: '🇪🇹', calendarType: 'ETHIOPIAN', timezone: 'Africa/Addis_Ababa', locale: 'am' },
  Kenya: { flag: '🇰🇪', calendarType: 'GREGORIAN', timezone: 'Africa/Nairobi', locale: 'en' },
  Nigeria: { flag: '🇳🇬', calendarType: 'GREGORIAN', timezone: 'Africa/Lagos', locale: 'en' },
  India: { flag: '🇮🇳', calendarType: 'GREGORIAN', timezone: 'Asia/Kolkata', locale: 'en' },
  'United States': { flag: '🇺🇸', calendarType: 'GREGORIAN', timezone: 'America/New_York', locale: 'en' },
  Generic: { flag: '🌍', calendarType: 'GREGORIAN', timezone: 'UTC', locale: 'en' },
};

// ─── Grade generation ─────────────────────────────────────────────────────────

function generateGrades(schoolType: string): WizardGrade[] {
  const mkGrade = (name: string, order: number): WizardGrade => ({
    name,
    displayOrder: order,
    sections: [{ name: 'A', capacity: 40 }],
  });

  if (schoolType === 'KG Only') {
    return ['KG1', 'KG2', 'KG3'].map((n, i) => mkGrade(n, i + 1));
  }
  if (schoolType === 'Primary K1-6') {
    return Array.from({ length: 6 }, (_, i) => mkGrade(`Grade ${i + 1}`, i + 1));
  }
  if (schoolType === 'Secondary 7-12') {
    return Array.from({ length: 6 }, (_, i) => mkGrade(`Grade ${i + 7}`, i + 1));
  }
  // K-12 Complete or Custom
  return [
    mkGrade('KG1', 1),
    mkGrade('KG2', 2),
    ...Array.from({ length: 12 }, (_, i) => mkGrade(`Grade ${i + 1}`, i + 3)),
  ];
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2),
  country: z.string().min(1),
  schoolType: z.string().min(1),
  calendarType: z.string().min(1),
  timezone: z.string().min(1),
  locale: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step1SchoolProfile({ onNext }: Props) {
  const { t } = useTranslation();
  const { schoolProfile, setSchoolProfile, setGrades } = useWizardStore();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: schoolProfile?.name ?? '',
      country: schoolProfile?.country ?? 'Ethiopia',
      schoolType: schoolProfile?.schoolType ?? 'K-12 Complete',
      calendarType: schoolProfile?.calendarType ?? 'ETHIOPIAN',
      timezone: schoolProfile?.timezone ?? 'Africa/Addis_Ababa',
      locale: schoolProfile?.locale ?? 'am',
    },
  });

  const handleCountryChange = (country: string) => {
    form.setValue('country', country);
    const preset = COUNTRY_PRESETS[country];
    if (preset) {
      form.setValue('calendarType', preset.calendarType);
      form.setValue('timezone', preset.timezone);
      form.setValue('locale', preset.locale);
    }
  };

  const handleSchoolTypeChange = (schoolType: string) => {
    form.setValue('schoolType', schoolType);
  };

  const onSubmit = (values: FormValues) => {
    setSchoolProfile(values);
    setGrades(generateGrades(values.schoolType));
    onNext();
  };

  const schoolTypes = [
    { value: 'K-12 Complete', label: t('wizard.school_profile.type_k12') },
    { value: 'Primary K1-6', label: t('wizard.school_profile.type_primary') },
    { value: 'Secondary 7-12', label: t('wizard.school_profile.type_secondary') },
    { value: 'KG Only', label: t('wizard.school_profile.type_kg') },
    { value: 'Custom', label: t('wizard.school_profile.type_custom') },
  ];

  return (
    <Form {...form}>
      <form id="wizard-step-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* School Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('wizard.school_profile.name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('wizard.school_profile.name_placeholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Country */}
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('wizard.school_profile.country')}</FormLabel>
              <Select value={field.value} onValueChange={handleCountryChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(COUNTRY_PRESETS).map(([name, p]) => (
                    <SelectItem key={name} value={name}>
                      {p.flag} {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* School Type */}
        <FormField
          control={form.control}
          name="schoolType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('wizard.school_profile.school_type')}</FormLabel>
              <Select value={field.value} onValueChange={handleSchoolTypeChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {schoolTypes.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
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
              <FormLabel>{t('wizard.school_profile.calendar_type')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="GREGORIAN">{t('wizard.school_profile.cal_gregorian')}</SelectItem>
                  <SelectItem value="ETHIOPIAN">{t('wizard.school_profile.cal_ethiopian')}</SelectItem>
                  <SelectItem value="HIJRI">{t('wizard.school_profile.cal_hijri')}</SelectItem>
                  <SelectItem value="CUSTOM">{t('wizard.school_profile.cal_custom')}</SelectItem>
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
              <FormLabel>{t('wizard.school_profile.timezone')}</FormLabel>
              <FormControl>
                <Input placeholder="Africa/Addis_Ababa" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
