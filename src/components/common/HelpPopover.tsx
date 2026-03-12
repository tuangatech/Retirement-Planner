// src/components/common/HelpPopover.tsx

import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface HelpPopoverProps {
    title?: string;
    children: React.ReactNode;
    placement?: 'top' | 'right' | 'bottom' | 'left';
    className?: string;
}

/**
 * HelpPopover Component
 * 
 * Displays contextual help information in a popover tooltip.
 * Triggered by hover or click on a help icon.
 * 
 * @example
 * <HelpPopover title="Life Expectancy">
 *   Average US life expectancy is 77 years, but planning to 90-95 
 *   reduces the risk of outliving your money.
 * </HelpPopover>
 */
export function HelpPopover({
    title,
    children,
    placement = 'right',
    className = ''
}: HelpPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);

    const placementStyles = {
        right: 'left-6 top-0',
        left: 'right-6 top-0',
        top: 'bottom-6 left-1/2 -translate-x-1/2',
        bottom: 'top-6 left-1/2 -translate-x-1/2',
    };

    const arrowStyles = {
        right: '-left-1.5 top-4 border-l-2 border-b-2',
        left: '-right-1.5 top-4 border-r-2 border-t-2',
        top: '-bottom-1.5 left-1/2 -translate-x-1/2 border-b-2 border-r-2',
        bottom: '-top-1.5 left-1/2 -translate-x-1/2 border-t-2 border-l-2',
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <button
                type="button"
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-400 hover:text-blue-600 transition-colors focus:outline-none focus:text-blue-600"
                aria-label={title || "Help information"}
            >
                <HelpCircle className="w-4 h-4" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop for mobile - closes popover when clicked */}
                    <div
                        className="fixed inset-0 z-40 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Popover content */}
                    <div className={`
            absolute z-50 w-80 max-w-[calc(100vw-2rem)] p-4 
            bg-white border-2 border-gray-200 rounded-lg shadow-xl
            ${placementStyles[placement]}
          `}>
                        {title && (
                            <h5 className="font-semibold text-gray-900 mb-2 text-sm">
                                {title}
                            </h5>
                        )}
                        <div className="text-sm text-gray-700 leading-relaxed space-y-2">
                            {children}
                        </div>

                        {/* Arrow indicator */}
                        <div className={`
              absolute w-3 h-3 bg-white border-gray-200 rotate-45
              ${arrowStyles[placement]}
            `} />
                    </div>
                </>
            )}
        </div>
    );
}