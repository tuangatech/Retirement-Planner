// src/components/common/CollapsibleHelpPanel.tsx

import { ChevronDown, Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface CollapsibleHelpPanelProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    variant?: 'info' | 'warning' | 'tip';
    className?: string;
}

/**
 * CollapsibleHelpPanel Component
 * 
 * Expandable help section for detailed guidance that doesn't clutter the UI.
 * Perfect for explaining complex concepts or providing examples.
 * 
 * @example
 * <CollapsibleHelpPanel title="Understanding Retirement Phases" variant="info">
 *   <p>Go-Go Years: Active retirement with higher spending...</p>
 * </CollapsibleHelpPanel>
 */
export function CollapsibleHelpPanel({
    title,
    children,
    defaultOpen = false,
    variant = 'info',
    className = ''
}: CollapsibleHelpPanelProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const variantConfig = {
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-900',
            icon: Info,
            iconColor: 'text-blue-600',
        },
        warning: {
            bg: 'bg-yellow-50',
            border: 'border-yellow-200',
            text: 'text-yellow-900',
            icon: AlertTriangle,
            iconColor: 'text-yellow-600',
        },
        tip: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            text: 'text-green-900',
            icon: Lightbulb,
            iconColor: 'text-green-600',
        },
    };

    const config = variantConfig[variant];
    const Icon = config.icon;

    return (
        <div className={`border-2 rounded-lg ${config.border} ${config.bg} ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
          w-full flex items-center justify-between p-4 
          hover:bg-opacity-70 transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
          ${config.text}
        `}
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 flex-shrink-0 ${config.iconColor}`} />
                    <span className="font-semibold text-left">{title}</span>
                </div>
                <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                        }`}
                />
            </button>

            {isOpen && (
                <div className={`px-4 pb-4 border-t-2 ${config.border}`}>
                    <div className="pt-4 text-sm leading-relaxed space-y-3">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}