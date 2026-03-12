// src/pages/WizardPage.tsx
// ✅ UPDATED: Now uses unified Header component with variant="wizard"

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '@/components/common/Header';
import { Footer } from '@/components/common/Footer';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { WizardNavigation } from '@/components/wizard/WizardNavigation';
import { Step1PersonalInfo } from '@/components/wizard/Step1PersonalInfo';
import { Step2Phases } from '@/components/wizard/Step2Phases';
import { Step3Accounts } from '@/components/wizard/Step3Accounts';
import { Step4Income } from '@/components/wizard/Step4Income';
import { Step5Healthcare } from '@/components/wizard/Step5Healthcare';
import { Step6TaxSettings } from '@/components/wizard/Step6TaxSettings';
import { useResults } from '@/contexts/ResultsContext';
import { useInputs } from '@/contexts/InputsContext';
import { trackPageView, trackWizardStep, trackCalculationStart } from '@/lib/analytics';


const STEPS = [
    { component: Step1PersonalInfo, title: 'Personal Info' },
    { component: Step2Phases, title: 'Retirement Phases' },
    { component: Step3Accounts, title: 'Investment Accounts' },
    { component: Step4Income, title: 'Income Sources' },
    { component: Step5Healthcare, title: 'Healthcare' },
    { component: Step6TaxSettings, title: 'Tax & Simulation' },
];

export default function WizardPage() {
    const navigate = useNavigate();
    const params = useParams<{ step: string }>();

    // Parse step from URL, default to 1
    const urlStep = parseInt(params.step || '1', 10);
    const [currentStep, setCurrentStep] = useState(
        Math.max(1, Math.min(urlStep, STEPS.length)) - 1 // 0-indexed
    );

    const { calculate, isCalculating, calculationProgress } = useResults();
    const { inputs } = useInputs();

    // Track step changes for analytics
    const [stepStartTime, setStepStartTime] = useState<number>(Date.now());

    // Sync currentStep when URL is changed externally (e.g., reset from Header)
    useEffect(() => {
        const newStep = Math.max(1, Math.min(urlStep, STEPS.length)) - 1;
        setCurrentStep(newStep);
    }, [urlStep]);

    // Sync URL with current step
    useEffect(() => {
        const displayStep = currentStep + 1;  // 1-indexed for display/URL
        trackPageView(`wizard_step_${displayStep}`);
        setStepStartTime(Date.now());
    }, [currentStep]);

    const CurrentStepComponent = STEPS[currentStep].component;

    const handleNext = () => {
        const timeSpent = Date.now() - stepStartTime;
        trackWizardStep(currentStep + 1, timeSpent);
        if (currentStep < STEPS.length - 1) {
            navigate(`/wizard/${currentStep + 2}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            navigate(`/wizard/${currentStep}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleCalculate = async () => {
        // Track final step completion
        const timeSpent = Date.now() - stepStartTime;
        trackWizardStep(6, timeSpent);

        // Track calculation start
        trackCalculationStart(inputs.simulation.numberOfRuns);

        // Run calculation
        await calculate(inputs);

        // Navigate to results (trackCalculationComplete happens in ResultsContext)
        navigate('/results');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col">
            {/* ✅ UPDATED: Now passing variant="wizard" to unified Header */}
            <Header variant="wizard" />

            <main className="w-full max-w-6xl mx-auto px-4 py-8 flex-1">
                <WizardProgress
                    currentStep={currentStep}
                    totalSteps={STEPS.length}
                    stepTitles={STEPS.map((s) => s.title)}
                    onStepClick={(step) => {
                        navigate(`/wizard/${step + 1}`);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                />

                {/* Calculation Progress */}
                {isCalculating && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">
                                Running Monte Carlo simulation...
                            </span>
                            <span className="text-sm font-semibold text-blue-900">
                                {calculationProgress}%
                            </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${calculationProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Step Content */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
                    <CurrentStepComponent />
                </div>

                {/* Navigation */}
                <WizardNavigation
                    currentStep={currentStep}
                    totalSteps={STEPS.length}
                    onBack={handleBack}
                    onNext={handleNext}
                    onCalculate={handleCalculate}
                    isCalculating={isCalculating}
                />
            </main>

            {/* ✅ NEW: Footer on all pages */}
            <Footer />
        </div>
    );
}