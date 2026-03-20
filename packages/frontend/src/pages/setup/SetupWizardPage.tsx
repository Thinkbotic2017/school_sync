import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

import { useWizardStore } from '@/store/wizard.store';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Step1SchoolProfile } from './steps/Step1SchoolProfile';
import { Step2AcademicYear } from './steps/Step2AcademicYear';
import { Step3GradeLevels } from './steps/Step3GradeLevels';
import { Step4Subjects } from './steps/Step4Subjects';
import { Step5GradingScale } from './steps/Step5GradingScale';
import { Step6AssessmentWeights } from './steps/Step6AssessmentWeights';
import { Step7FeeStructure } from './steps/Step7FeeStructure';
import { Step8PromotionRules } from './steps/Step8PromotionRules';
import { Step9ReviewActivate } from './steps/Step9ReviewActivate';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 9;

// ─── Progress bar ─────────────────────────────────────────────────────────────

function WizardProgress({ current, total }: { current: number; total: number }) {
  const pct = Math.round(((current - 1) / (total - 1)) * 100);
  return (
    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBreadcrumbs({
  current,
  stepNames,
}: {
  current: number;
  stepNames: string[];
}) {
  return (
    <div className="flex flex-wrap gap-x-1 gap-y-1 items-center">
      {stepNames.map((name, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isActive = step === current;
        return (
          <span
            key={step}
            className={cn(
              'text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
              isActive && 'bg-primary text-primary-foreground font-semibold',
              isDone && 'text-muted-foreground line-through',
              !isActive && !isDone && 'text-muted-foreground',
            )}
          >
            {step}. {name}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function SetupWizardPage() {
  const { t } = useTranslation();
  const { currentStep, setStep } = useWizardStore();

  const stepNames = [
    t('wizard.steps.school_profile'),
    t('wizard.steps.academic_year'),
    t('wizard.steps.grade_levels'),
    t('wizard.steps.subjects'),
    t('wizard.steps.grading_scale'),
    t('wizard.steps.assessment_weights'),
    t('wizard.steps.fee_structure'),
    t('wizard.steps.promotion_rules'),
    t('wizard.steps.review'),
  ];

  const goNext = () => {
    if (currentStep < TOTAL_STEPS) setStep(currentStep + 1);
  };

  const goBack = () => {
    if (currentStep > 1) setStep(currentStep - 1);
  };

  // Each step receives onNext and submits its form via the shared form id
  const stepProps = { onNext: goNext };

  const STEPS: React.ReactNode[] = [
    <Step1SchoolProfile {...stepProps} />,
    <Step2AcademicYear {...stepProps} />,
    <Step3GradeLevels {...stepProps} />,
    <Step4Subjects {...stepProps} />,
    <Step5GradingScale {...stepProps} />,
    <Step6AssessmentWeights {...stepProps} />,
    <Step7FeeStructure {...stepProps} />,
    <Step8PromotionRules {...stepProps} />,
    <Step9ReviewActivate {...stepProps} />,
  ];

  const currentStepNode = STEPS[currentStep - 1];
  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-3xl space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('wizard.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('wizard.step_of', { current: currentStep, total: TOTAL_STEPS })}
          </p>
        </div>

        {/* Progress */}
        <WizardProgress current={currentStep} total={TOTAL_STEPS} />

        {/* Breadcrumbs */}
        <StepBreadcrumbs current={currentStep} stepNames={stepNames} />

        {/* Step card */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-lg font-semibold">{stepNames[currentStep - 1]}</h2>
          </CardHeader>
          <CardContent>{currentStepNode}</CardContent>
        </Card>

        {/* Navigation */}
        {!isLastStep && (
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={currentStep === 1}
            >
              {t('wizard.back')}
            </Button>

            {/* Trigger the hidden form submit in the current step */}
            <Button type="submit" form="wizard-step-form">
              {t('wizard.next')}
            </Button>
          </div>
        )}

        {isLastStep && (
          <div className="flex justify-start">
            <Button variant="outline" onClick={goBack}>
              {t('wizard.back')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
