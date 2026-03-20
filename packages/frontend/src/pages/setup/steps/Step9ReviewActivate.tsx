import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CheckCircle2, School, Calendar, BookOpen, GraduationCap, DollarSign, TrendingUp } from 'lucide-react';

import { useWizardStore } from '@/store/wizard.store';
import { setupApi } from '@/services/setup.service';
import type { SetupWizardInput } from '@/types/setup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// ─── Confetti animation ───────────────────────────────────────────────────────

function ConfettiOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `-${Math.random() * 20}%`,
            animationDelay: `${Math.random() * 1}s`,
            animationDuration: `${1 + Math.random() * 1.5}s`,
            fontSize: '1.5rem',
          }}
        >
          {['🎉', '✨', '🎊', '⭐', '🏫'][i % 5]}
        </div>
      ))}
    </div>
  );
}

// ─── Summary row ─────────────────────────────────────────────────────────────

function SummaryRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onNext: () => void;
}

export function Step9ReviewActivate({ onNext: _onNext }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    schoolProfile,
    academicYear,
    grades,
    subjects,
    gradingPreset,
    assessmentWeights,
    feeStructures,
    promotionRules,
    operations,
    reset,
  } = useWizardStore();

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        reset();
        navigate('/dashboard');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const totalSections = grades.reduce((sum, g) => sum + g.sections.length, 0);

  const handleActivate = async () => {
    if (!schoolProfile || !academicYear || !promotionRules || !operations) {
      toast.error(t('wizard.review.incomplete_data'));
      return;
    }

    const payload: SetupWizardInput = {
      schoolProfile,
      academicYear,
      grades,
      subjects,
      gradingPreset,
      assessmentWeights,
      feeStructures,
      promotionRules,
      operations,
    };

    setLoading(true);
    try {
      await setupApi.initialize(payload);
      setSuccess(true);
      toast.success(t('wizard.review.success'));
    } catch (err) {
      const message =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any)?.response?.data?.error?.message ?? t('common.errors.server_error');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <ConfettiOverlay />
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold">{t('wizard.review.success')}</h2>
          <p className="text-muted-foreground">{t('wizard.review.redirect_message')}</p>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('wizard.review.activate_description')}</p>

      {/* School Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('wizard.review.school_section')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow icon={School} label={t('wizard.school_profile.name')} value={schoolProfile?.name ?? '—'} />
          <SummaryRow icon={School} label={t('wizard.school_profile.country')} value={schoolProfile?.country ?? '—'} />
          <SummaryRow icon={School} label={t('wizard.school_profile.school_type')} value={schoolProfile?.schoolType ?? '—'} />
          <SummaryRow icon={School} label={t('wizard.school_profile.calendar_type')} value={schoolProfile?.calendarType ?? '—'} />
        </CardContent>
      </Card>

      <Separator />

      {/* Academic Year */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('wizard.review.academic_section')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow icon={Calendar} label={t('wizard.academic_year.name')} value={academicYear?.name ?? '—'} />
          <SummaryRow
            icon={Calendar}
            label={t('wizard.review.period')}
            value={academicYear ? `${academicYear.startDate} → ${academicYear.endDate}` : '—'}
          />
          <SummaryRow
            icon={Calendar}
            label={t('wizard.academic_year.terms')}
            value={academicYear ? `${academicYear.terms.length} terms` : '—'}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Grade Structure */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('wizard.review.grades_section')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow
            icon={GraduationCap}
            label={t('wizard.review.grades_count')}
            value={`${grades.length} grades`}
          />
          <SummaryRow
            icon={GraduationCap}
            label={t('wizard.review.sections_count')}
            value={`${totalSections} sections`}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {grades.map((g) => (
              <Badge key={g.name} variant="outline" className="text-xs">
                {g.name} ({g.sections.length})
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Subjects + Grading */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('wizard.review.subjects_section')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow
              icon={BookOpen}
              label={t('wizard.review.subjects_count')}
              value={`${subjects.length} subjects`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('wizard.review.grading_section')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SummaryRow
              icon={TrendingUp}
              label={t('wizard.grading.preset')}
              value={gradingPreset}
            />
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Fees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('wizard.review.fees_section')}</CardTitle>
        </CardHeader>
        <CardContent>
          <SummaryRow
            icon={DollarSign}
            label={t('wizard.review.fees_count')}
            value={`${feeStructures.length} fee categories`}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {feeStructures.map((f) => (
              <Badge key={f.name} variant="outline" className="text-xs">
                {f.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activate button — form submit trigger for parent */}
      <form
        id="wizard-step-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleActivate();
        }}
      />

      <div className="pt-4">
        <Button
          size="lg"
          className="w-full"
          onClick={handleActivate}
          disabled={loading}
        >
          {loading ? t('wizard.activating') : t('wizard.activate')}
        </Button>
      </div>
    </div>
  );
}
