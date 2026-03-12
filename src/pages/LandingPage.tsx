import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, TrendingUp, Heart, AlertCircle, ArrowRight, Lock, Eye, BookOpen } from 'lucide-react';

// Logo Component (inline for artifact demo - will be separate file in actual project)
function Logo({ size = 'md', variant = 'full' }: { size?: 'sm' | 'md' | 'lg', variant?: 'full' | 'icon' | 'text' }) {
    const sizes = {
        sm: { icon: 'w-6 h-6', text: 'text-base', container: 'gap-1.5' },
        md: { icon: 'w-8 h-8', text: 'text-xl', container: 'gap-2' },
        lg: { icon: 'w-12 h-12', text: 'text-3xl', container: 'gap-3' },
    };
    const sizeClasses = sizes[size];

    if (variant === 'icon') {
        return (
            <div className={sizeClasses.icon}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z" fill="#2563eb" opacity="0.1" />
                    <path d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" />
                    <path d="M30 65L40 55L50 45L60 40L70 30" stroke="#14b8a6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="30" cy="65" r="3" fill="#14b8a6" />
                    <circle cx="40" cy="55" r="3" fill="#14b8a6" />
                    <circle cx="50" cy="45" r="3" fill="#14b8a6" />
                    <circle cx="60" cy="40" r="3" fill="#14b8a6" />
                    <circle cx="70" cy="30" r="3" fill="#14b8a6" />
                    <path d="M42 70L47 75L58 64" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        );
    }

    return (
        <div className={`flex items-center ${sizeClasses.container}`}>
            <div className={sizeClasses.icon}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z" fill="#2563eb" opacity="0.1" />
                    <path d="M50 5L15 20V45C15 65 25 80 50 95C75 80 85 65 85 45V20L50 5Z" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" />
                    <path d="M30 65L40 55L50 45L60 40L70 30" stroke="#14b8a6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="30" cy="65" r="3" fill="#14b8a6" />
                    <circle cx="40" cy="55" r="3" fill="#14b8a6" />
                    <circle cx="50" cy="45" r="3" fill="#14b8a6" />
                    <circle cx="60" cy="40" r="3" fill="#14b8a6" />
                    <circle cx="70" cy="30" r="3" fill="#14b8a6" />
                    <path d="M42 70L47 75L58 64" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <div className="flex flex-col leading-tight">
                <span className={`font-bold text-slate-900 ${sizeClasses.text}`}>Honest Retirement</span>
                {size !== 'sm' && <span className="text-xs text-slate-500 font-medium">Calculator</span>}
            </div>
        </div>
    );
}

export default function LandingPage() {
    const navigate = useNavigate();

    const handleStart = () => {
        navigate('/wizard/1');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
            {/* Navigation */}
            <nav className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <Logo size="md" variant="full" />
                        <button
                            onClick={handleStart}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                        >
                            Start Planning
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
                <div className="text-center max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                        <Eye className="w-4 h-4" />
                        The Only Calculator That Shows Its Work
                    </div>

                    <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                        Retirement Planning That Shows Its Work
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-600 mb-4">
                        The only free calculator that tells you exactly what it <span className="font-semibold text-slate-900">can</span> predict—and what it <span className="font-semibold text-red-600">can't</span>.
                    </p>

                    <p className="text-lg text-slate-500 mb-10">
                        Built for early retirees, FIRE planners, and skeptics who've been burned by oversimplified tools.
                    </p>

                    {/* Trust Bar */}
                    <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span>No signup required</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span>No data collection</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span>100% free forever</span>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleStart}
                        className="group inline-flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 text-lg font-semibold shadow-lg hover:shadow-xl"
                    >
                        Start Your Free Retirement Analysis
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <p className="text-sm text-slate-500 mt-4">
                        Takes 5-10 minutes • See results instantly • Save scenarios locally
                    </p>
                </div>
            </section>

            {/* What Makes Us Different */}
            <section className="bg-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-4">
                        What Makes Us Different
                    </h2>
                    <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
                        Most calculators hide assumptions and oversimplify. We do the opposite.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Card 1 */}
                        <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
                            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-6">
                                <AlertCircle className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4">
                                We Show Our Limitations
                            </h3>
                            <p className="text-slate-600 mb-4">
                                Most calculators hide what they don't model. We put limitations front and center with a mandatory <span className="font-semibold">Assumptions & Limitations</span> panel on every results page.
                            </p>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                                <p className="font-semibold mb-2">Examples we disclose:</p>
                                <ul className="space-y-1 text-sm">
                                    <li>• Long-term care NOT modeled</li>
                                    <li>• Simplified tax calculations</li>
                                    <li>• Fixed life expectancy</li>
                                    <li>• No asset correlations</li>
                                </ul>
                            </div>
                        </div>

                        {/* Card 2 */}
                        <div className="bg-gradient-to-br from-teal-50 to-white border-2 border-teal-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
                            <div className="w-14 h-14 bg-teal-600 rounded-xl flex items-center justify-center mb-6">
                                <TrendingUp className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4">
                                Built for Early Retirement
                            </h3>
                            <p className="text-slate-600 mb-4">
                                Retiring at 55? 58? 62? We're built for early retirement with detailed pre-Medicare healthcare modeling, HSA integration, and Social Security earnings test.
                            </p>
                            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-900">
                                <p className="font-semibold mb-2">What we include:</p>
                                <ul className="space-y-1 text-sm">
                                    <li>• Retirement ages 50-75</li>
                                    <li>• Pre-Medicare healthcare costs</li>
                                    <li>• HSA tax-free coverage</li>
                                    <li>• Part-time work scenarios</li>
                                </ul>
                            </div>
                        </div>

                        {/* Card 3 */}
                        <div className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-200 rounded-2xl p-8 hover:shadow-xl transition-shadow">
                            <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center mb-6">
                                <Lock className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-4">
                                Privacy-First Design
                            </h3>
                            <p className="text-slate-600 mb-4">
                                Your financial data never leaves your browser. No accounts, no tracking, no cloud storage. We can't see your data because we never collect it.
                            </p>
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-900">
                                <p className="font-semibold mb-2">Technical details:</p>
                                <ul className="space-y-1 text-sm">
                                    <li>• 100% client-side JavaScript</li>
                                    <li>• Browser localStorage only</li>
                                    <li>• No server, no database</li>
                                    <li>• Open calculation methods</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Common Mistakes We Avoid */}
            <section className="bg-gradient-to-br from-slate-50 to-blue-50 py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-4">
                        Common Calculator Mistakes We Avoid
                    </h2>
                    <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
                        Here's how we're different from typical retirement calculators
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        <ComparisonCard problem="Hidden assumptions" solution="Mandatory assumptions panel with full disclosure" />
                        <ComparisonCard problem="One-size-fits-all timeline" solution="Custom retirement ages (50-75), life expectancy (70-110)" />
                        <ComparisonCard problem="Healthcare as an afterthought" solution="Detailed pre-Medicare + Medicare modeling with IRMAA" />
                        <ComparisonCard problem="Black box Monte Carlo" solution="Visual spaghetti chart + clear percentile explanations" />
                        <ComparisonCard problem="Oversimplified taxes" solution="Honest effective rate with documented limitations" />
                        <ComparisonCard problem="Account linking required" solution="No accounts, no passwords, no data collection" />
                    </div>
                </div>
            </section>

            {/* Who This Is For */}
            <section className="bg-white py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">
                        Who This Is For (And Who It's Not)
                    </h2>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Perfect For */}
                        <div className="bg-gradient-to-br from-green-50 to-white border-2 border-green-300 rounded-2xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
                                <h3 className="text-2xl font-bold text-green-900">Perfect For</h3>
                            </div>
                            <ul className="space-y-3 text-slate-700">
                                <li className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>Early retirement planners</strong> (age 50-65)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>DIY investors</strong> who want to check their math</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>FIRE community members</strong> with high savings rates</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>Skeptics</strong> burned by oversimplified calculators</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Anyone concerned about <strong>pre-Medicare healthcare costs</strong></span>
                                </li>
                            </ul>
                        </div>

                        {/* Not Ideal For */}
                        <div className="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-300 rounded-2xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <XCircle className="w-8 h-8 text-amber-600 flex-shrink-0" />
                                <h3 className="text-2xl font-bold text-amber-900">Not Ideal For</h3>
                            </div>
                            <ul className="space-y-3 text-slate-700">
                                <li className="flex items-start gap-3">
                                    <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>Couples planning</strong> (single person only)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>Complex estate planning</strong> needs</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span>Those seeking <strong>professional financial advice</strong></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span>People needing <strong>long-term care modeling</strong></span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <span>Those wanting to <strong>link bank accounts</strong></span>
                                </li>
                            </ul>
                            <div className="mt-6 p-4 bg-amber-100 border border-amber-300 rounded-lg">
                                <p className="text-sm text-amber-900">
                                    <strong>We're honest about what we can't do.</strong> If you need couples planning or estate features, we'll point you to tools that specialize in that.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="bg-gradient-to-br from-blue-50 to-slate-50 py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-4">
                        How It Works
                    </h2>
                    <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
                        A simple 6-step wizard guides you through your retirement plan
                    </p>

                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        <StepCard number="1-2" title="Basic Information" description="Enter your age, retirement timeline, and planned spending across three retirement phases" time="2 min" />
                        <StepCard number="3-4" title="Accounts & Income" description="Add your investment accounts (401k, Roth, HSA, taxable) and income sources (Social Security, pensions)" time="3 min" />
                        <StepCard number="5-6" title="Healthcare & Simulation" description="Model pre-Medicare and Medicare costs, set tax rates, then run Monte Carlo analysis" time="2 min" />
                    </div>

                    <div className="bg-white rounded-2xl p-8 border-2 border-blue-200 max-w-4xl mx-auto">
                        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                            <BookOpen className="w-6 h-6 text-blue-600" />
                            What You'll See in Results
                        </h3>
                        <ul className="grid md:grid-cols-2 gap-3 text-slate-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <span>Success probability gauge (with interpretation)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <span>Annual cash flow visualization</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <span>Monte Carlo spaghetti chart (5,000 scenarios)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <span>Year-by-year breakdown (export to CSV)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <span>Detailed assumptions & limitations disclosure</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <span>Plain-English explanations of all metrics</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="bg-gradient-to-br from-blue-600 to-blue-700 py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Ready to Plan Your Retirement Honestly?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        No signup. No data collection. Just honest, transparent retirement planning.
                    </p>
                    <button
                        onClick={handleStart}
                        className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all transform hover:scale-105 text-lg font-semibold shadow-lg hover:shadow-xl"
                    >
                        Start Your Free Analysis Now
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-sm text-blue-200 mt-6">
                        Takes 5-10 minutes • See results instantly • 100% free forever
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="brightness-0 invert">
                            <Logo size="md" variant="full" />
                        </div>
                        <p className="text-sm max-w-2xl">
                            Educational projections only. This tool is not financial, tax, legal, or investment advice.
                            Results are estimates based on simplified assumptions. Consult qualified professionals before making retirement decisions.
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                            <Heart className="w-4 h-4 text-red-400" />
                            <span>Built with transparency and honesty • 2026</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function ComparisonCard({ problem, solution }: { problem: string, solution: string }) {
    return (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                    <XCircle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                    <p className="text-slate-600 mb-2 line-through">{problem}</p>
                </div>
            </div>
            <div className="flex items-start gap-4 mt-3">
                <div className="flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div className="flex-1">
                    <p className="text-slate-900 font-semibold">{solution}</p>
                </div>
            </div>
        </div>
    );
}

function StepCard({ number, title, description, time }: { number: string, title: string, description: string, time: string }) {
    return (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                <span className="text-white font-bold text-lg">Step {number}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-600 mb-4">{description}</p>
            <div className="inline-flex items-center gap-2 text-sm text-blue-600 font-medium">
                <span>⏱️ ~{time}</span>
            </div>
        </div>
    );
}