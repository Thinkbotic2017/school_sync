import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/custom/PageHeader';

import { SchoolProfileSettings } from './components/SchoolProfileSettings';
import { AcademicSettings } from './components/AcademicSettings';
import { OperationsSettings } from './components/OperationsSettings';
import { FeeSettings } from './components/FeeSettings';
import { AttendanceSettings } from './components/AttendanceSettings';
import { PromotionSettings } from './components/PromotionSettings';
import { ReportCardSettings } from './components/ReportCardSettings';

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="profile">{t('settings.tabs.profile')}</TabsTrigger>
          <TabsTrigger value="academic">{t('settings.tabs.academic')}</TabsTrigger>
          <TabsTrigger value="operations">{t('settings.tabs.operations')}</TabsTrigger>
          <TabsTrigger value="fees">{t('settings.tabs.fees')}</TabsTrigger>
          <TabsTrigger value="attendance">{t('settings.tabs.attendance')}</TabsTrigger>
          <TabsTrigger value="promotion">{t('settings.tabs.promotion')}</TabsTrigger>
          <TabsTrigger value="report_card">{t('settings.tabs.report_card')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <SchoolProfileSettings />
        </TabsContent>

        <TabsContent value="academic">
          <AcademicSettings />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsSettings />
        </TabsContent>

        <TabsContent value="fees">
          <FeeSettings />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceSettings />
        </TabsContent>

        <TabsContent value="promotion">
          <PromotionSettings />
        </TabsContent>

        <TabsContent value="report_card">
          <ReportCardSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
