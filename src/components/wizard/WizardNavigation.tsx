// src/components/wizard/WizardNavigation.tsx

import { useInputs } from '@/contexts/InputsContext';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

interface WizardNavigationProps {
    currentStep: number;
    totalSteps: number;
    onBack: () => void;
    onNext: () => void;
    onCalculate: () => void;
    isCalculating: boolean;
}

export function WizardNavigation({
    currentStep,
    totalSteps,
    onBack,
    onNext,
    onCalculate,
    isCalculating,
}: WizardNavigationProps) {
    const isLastStep = currentStep === totalSteps - 1;
    const { inputs } = useInputs();

    // Validate current step before allowing next
    const canProceed = () => {
        if (currentStep === 1) { // Step 2 - Phases
            const phases = inputs.phases;
            // Only check what can't be prevented by the UI
            if (phases[0].endAge >= phases[1].startAge) return false;
            if (phases[1].endAge >= phases[2].startAge) return false;
        }
        return true;
    };

    return (
        <div className="flex justify-between items-center">
            <button
                onClick={onBack}
                disabled={currentStep === 0}
                className="flex items-center gap-2 px-6 py-3 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronLeft className="w-5 h-5" />
                Back
            </button>

            {isLastStep ? (
                <button
                    onClick={onCalculate}
                    disabled={isCalculating || !canProceed()}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <TrendingUp className="w-5 h-5" />
                    {isCalculating ? 'Calculating...' : 'Calculate Results'}
                </button>
            ) : (
                <button
                    onClick={onNext}
                    disabled={!canProceed()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    Next
                    <ChevronRight className="w-5 h-5" />
                </button>
            )}
        </div>
    );
}