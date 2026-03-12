// src/components/wizard/WizardProgress.tsx

import { cn } from '@/lib/utils';

interface WizardProgressProps {
    currentStep: number;
    totalSteps: number;
    stepTitles: string[];
    onStepClick: (step: number) => void;
}

export function WizardProgress({
    currentStep,
    totalSteps,
    stepTitles,
    onStepClick = () => {},
}: WizardProgressProps) {
    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
                {Array.from({ length: totalSteps }).map((_, index) => {
                    const isVisited = index <= currentStep;
                    const isPast = index < currentStep;

                    return (
                        <div key={index} className="flex items-center flex-1">
                            <button
                                onClick={() => onStepClick(index)}
                                disabled={!isPast}
                                title={isPast ? `Go to ${stepTitles[index]}` : undefined}
                                className={cn(
                                    'w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors',
                                    isVisited
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-300 text-gray-600',
                                    isPast
                                        ? 'hover:bg-blue-700 cursor-pointer'
                                        : 'cursor-default'
                                )}
                            >
                                {index + 1}
                            </button>
                            {index < totalSteps - 1 && (
                                <div
                                    className={cn(
                                        'flex-1 h-1 transition-colors',
                                        index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between">
                {stepTitles.map((title, index) => {
                    const isVisited = index <= currentStep;
                    const isPast = index < currentStep;

                    return (
                        <button
                            key={index}
                            onClick={() => onStepClick(index)}
                            disabled={!isPast}
                            className={cn(
                                'text-sm transition-colors flex-1 text-center',
                                isVisited
                                    ? 'text-blue-600 font-medium'
                                    : 'text-gray-500',
                                isPast
                                    ? 'hover:underline cursor-pointer'
                                    : 'cursor-default'
                            )}
                        >
                            {title}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}