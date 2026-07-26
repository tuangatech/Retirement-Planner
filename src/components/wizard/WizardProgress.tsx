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
    // "Alternative label" stepper: circles sit at their column centers (evenly spread
    // full-width), labels centered beneath each. The connector is one continuous track
    // behind the circles, spanning the first→last circle centers, with a blue fill up to
    // the current step. Insetting circles at column centers keeps centered labels from
    // clipping at the edges.
    const inset = `${50 / totalSteps}%`;
    const fillWidth = `${(currentStep / totalSteps) * 100}%`;

    return (
        <div className="mb-8">
            <div className="relative flex">
                {/* Connector track + progress fill (behind the circles) */}
                <div className="absolute top-5 h-1 bg-gray-300 z-0" style={{ left: inset, right: inset }} />
                <div className="absolute top-5 h-1 bg-blue-600 z-0 transition-all" style={{ left: inset, width: fillWidth }} />

                {stepTitles.map((title, index) => {
                    const isVisited = index <= currentStep;
                    const isPast = index < currentStep;

                    return (
                        <div key={index} className="relative z-10 flex flex-1 flex-col items-center">
                            <button
                                onClick={() => onStepClick(index)}
                                disabled={!isPast}
                                title={isPast ? `Go to ${title}` : undefined}
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
                            <button
                                onClick={() => onStepClick(index)}
                                disabled={!isPast}
                                className={cn(
                                    'mt-2 max-w-full px-1 text-sm leading-tight text-center transition-colors',
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
