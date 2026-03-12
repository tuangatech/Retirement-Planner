// src/components/common/InlineGuidance.tsx

interface InlineGuidanceProps {
    children: React.ReactNode;
    variant?: 'default' | 'example' | 'formula';
    className?: string;
}

/**
 * InlineGuidance Component
 * 
 * Subtle inline hints that provide context without overwhelming the user.
 * Perfect for examples, formulas, or quick tips.
 * 
 * @example
 * <InlineGuidance variant="formula">
 *   Age 62: ~70% | Age 67: 100% | Age 70: ~124%
 * </InlineGuidance>
 */
export function InlineGuidance({
    children,
    variant = 'default',
    className = ''
}: InlineGuidanceProps) {
    const variantStyles = {
        default: 'bg-gray-50 border-gray-200 text-gray-700',
        example: 'bg-blue-50 border-blue-200 text-blue-800',
        formula: 'bg-purple-50 border-purple-200 text-purple-800',
    };

    return (
        <div className={`
      text-xs border rounded px-3 py-2 mt-2
      ${variantStyles[variant]}
      ${className}
    `}>
            {children}
        </div>
    );
}