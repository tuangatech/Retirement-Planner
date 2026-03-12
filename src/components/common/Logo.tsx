// src/components/common/Logo.tsx
interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    variant?: 'full' | 'icon' | 'text';
    className?: string;
}

export function Logo({ size = 'md', variant = 'full', className = '' }: LogoProps) {
    const sizes = {
        sm: { icon: 'w-6 h-6', text: 'text-base', container: 'gap-1.5' },
        md: { icon: 'w-8 h-8', text: 'text-xl', container: 'gap-2' },
        lg: { icon: 'w-12 h-12', text: 'text-3xl', container: 'gap-3' },
    };

    const sizeClasses = sizes[size];

    if (variant === 'icon') {
        return (
            <div className={`${sizeClasses.icon} ${className}`}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Shield background - trust/security */}
                    <path
                        d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z"
                        fill="#2563eb"
                        opacity="0.1"
                    />
                    <path
                        d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeLinejoin="round"
                    />

                    {/* Rising graph line - growth */}
                    <path
                        d="M30 65L40 55L50 45L60 40L70 30"
                        stroke="#14b8a6"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Data points on the line */}
                    <circle cx="30" cy="65" r="3" fill="#14b8a6" />
                    <circle cx="40" cy="55" r="3" fill="#14b8a6" />
                    <circle cx="50" cy="45" r="3" fill="#14b8a6" />
                    <circle cx="60" cy="40" r="3" fill="#14b8a6" />
                    <circle cx="70" cy="30" r="3" fill="#14b8a6" />

                    {/* Checkmark for "honest/verified" */}
                    <path
                        d="M42 70L47 75L58 64"
                        stroke="#059669"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
        );
    }

    if (variant === 'text') {
        return (
            <div className={className}>
                <span className={`font-bold text-slate-900 ${sizeClasses.text}`}>
                    Honest Retirement
                </span>
            </div>
        );
    }

    // Full logo (icon + text)
    return (
        <div className={`flex items-center ${sizeClasses.container} ${className}`}>
            <div className={sizeClasses.icon}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z"
                        fill="#2563eb"
                        opacity="0.1"
                    />
                    <path
                        d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z"
                        stroke="#2563eb"
                        strokeWidth="3"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M30 65L40 55L50 45L60 40L70 30"
                        stroke="#14b8a6"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle cx="30" cy="65" r="3" fill="#14b8a6" />
                    <circle cx="40" cy="55" r="3" fill="#14b8a6" />
                    <circle cx="50" cy="45" r="3" fill="#14b8a6" />
                    <circle cx="60" cy="40" r="3" fill="#14b8a6" />
                    <circle cx="70" cy="30" r="3" fill="#14b8a6" />
                    <path
                        d="M42 70L47 75L58 64"
                        stroke="#059669"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <div className="flex flex-col leading-tight">
                <span className={`font-bold text-slate-900 ${sizeClasses.text}`}>
                    Honest Retirement
                </span>
                {size !== 'sm' && (
                    <span className="text-xs text-slate-500 font-medium">
                        Calculator
                    </span>
                )}
            </div>
        </div>
    );
}

// Demo component showing all variants
export default function LogoShowcase() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
            <div className="max-w-4xl mx-auto space-y-12">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-8">Logo Variants</h1>

                    {/* Full Logos */}
                    <div className="bg-white rounded-xl border-2 border-slate-200 p-8 mb-6">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Full Logo (All Sizes)</h2>
                        <div className="space-y-6">
                            <div className="flex items-center gap-8">
                                <span className="text-sm text-slate-500 w-20">Small:</span>
                                <Logo size="sm" variant="full" />
                            </div>
                            <div className="flex items-center gap-8">
                                <span className="text-sm text-slate-500 w-20">Medium:</span>
                                <Logo size="md" variant="full" />
                            </div>
                            <div className="flex items-center gap-8">
                                <span className="text-sm text-slate-500 w-20">Large:</span>
                                <Logo size="lg" variant="full" />
                            </div>
                        </div>
                    </div>

                    {/* Icon Only */}
                    <div className="bg-white rounded-xl border-2 border-slate-200 p-8 mb-6">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Icon Only</h2>
                        <div className="flex items-center gap-8">
                            <Logo size="sm" variant="icon" />
                            <Logo size="md" variant="icon" />
                            <Logo size="lg" variant="icon" />
                        </div>
                    </div>

                    {/* Text Only */}
                    <div className="bg-white rounded-xl border-2 border-slate-200 p-8 mb-6">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Text Only</h2>
                        <div className="space-y-4">
                            <Logo size="sm" variant="text" />
                            <Logo size="md" variant="text" />
                            <Logo size="lg" variant="text" />
                        </div>
                    </div>

                    {/* On Different Backgrounds */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">On Different Backgrounds</h2>

                        <div className="bg-slate-900 rounded-xl p-6 flex items-center justify-center">
                            <Logo size="md" variant="full" className="brightness-0 invert" />
                        </div>

                        <div className="bg-blue-600 rounded-xl p-6 flex items-center justify-center">
                            <Logo size="md" variant="full" className="brightness-0 invert" />
                        </div>

                        <div className="bg-gradient-to-r from-blue-600 to-teal-500 rounded-xl p-6 flex items-center justify-center">
                            <Logo size="lg" variant="full" className="brightness-0 invert" />
                        </div>
                    </div>

                    {/* Design Explanation */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mt-8">
                        <h3 className="text-lg font-semibold text-blue-900 mb-3">Logo Design Symbolism</h3>
                        <ul className="space-y-2 text-sm text-blue-800">
                            <li className="flex items-start gap-2">
                                <span className="font-semibold">🛡️ Shield:</span>
                                <span>Represents security, protection, and trust - your financial future is safe with honest planning</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-semibold">📈 Rising Line:</span>
                                <span>Portfolio growth trajectory with clear data points (transparency in projections)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-semibold">✓ Checkmark:</span>
                                <span>Verification, honesty, and accuracy - we show you what's validated</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-semibold">🎨 Colors:</span>
                                <span>Blue (trust) + Teal (growth) + Green (success/validation)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}