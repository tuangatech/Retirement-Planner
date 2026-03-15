import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, TrendingUp, Heart, AlertCircle, ArrowRight, Lock } from 'lucide-react';

function Logo({ size = 'md', variant = 'full' }: { size?: 'sm' | 'md' | 'lg', variant?: 'full' | 'icon' }) {
    const heights = { sm: 'h-7', md: 'h-9', lg: 'h-14' };
    const h = `${heights[size]} w-auto`;

    if (variant === 'icon') {
        return <img src="/logo.png" alt="Will It Last?" className={h} />;
    }

    return <img src="/logo-app.png" alt="Will It Last? Retirement Planner" className={h} />;
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
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex justify-between items-center h-16">
                        <Logo size="lg" variant="full" />
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
            <section className="max-w-6xl mx-auto px-4 pt-20 pb-16">
                <div className="text-center max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                        Retirement Planning That Shows Its Work
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-600 mb-4">
                        A free retirement calculator that's upfront about <span className="font-semibold text-slate-900">what it models</span> and <span className="font-semibold text-blue-600">how it works</span>.
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
                            <span>Every term explained as you go</span>
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
                        Takes 5 minutes • See results instantly • Save scenarios locally
                    </p>
                </div>
            </section>

            {/* What Makes Us Different */}
            <section className="bg-white py-20">
                <div className="max-w-6xl mx-auto px-4">
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
                                Full Transparency, Every Time
                            </h3>
                            <p className="text-slate-600 mb-4">
                                Every results page includes a <span className="font-semibold">Assumptions & Methodology</span> panel so you always know exactly what the model includes—and where to apply your own judgment.
                            </p>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                                <p className="font-semibold mb-2">What we document clearly:</p>
                                <ul className="space-y-1 text-sm">
                                    <li>• Long-term care (out of scope)</li>
                                    <li>• Simplified tax approach</li>
                                    <li>• Fixed life expectancy input</li>
                                    <li>• Independent account returns</li>
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

            {/* Who This Is For */}
            <section className="bg-white py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-slate-900 mb-10">
                        Who This Is For (And Who It's Not)
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">Good fit</p>
                            <ul className="space-y-2 text-slate-700">
                                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" /><span>Early retirees &amp; FIRE planners (age 50–65)</span></li>
                                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" /><span>DIY investors who want to stress-test their plan</span></li>
                                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" /><span>Anyone with pre-Medicare healthcare exposure</span></li>
                                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" /><span>Skeptics who want to see the math</span></li>
                            </ul>
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-3">Not the right tool for</p>
                            <ul className="space-y-2 text-slate-700">
                                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-1" /><span>Couples planning (single filer only)</span></li>
                                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-1" /><span>Long-term care or estate planning</span></li>
                                <li className="flex items-start gap-2"><XCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-1" /><span>Replacing a CFP or professional advice</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="bg-gradient-to-br from-blue-50 to-slate-50 py-20">
                <div className="max-w-6xl mx-auto px-4">
                    <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-4">
                        How It Works
                    </h2>
                    <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
                        A simple 6-step wizard guides you through your retirement plan
                    </p>

                    <div className="grid md:grid-cols-3 gap-8 mb-12">
                        <StepCard number="1-2" title="Basic Information" description="Enter your age, retirement timeline, and planned spending across three retirement phases" />
                        <StepCard number="3-4" title="Accounts & Income" description="Add your investment accounts (401k, Roth, HSA, taxable) and income sources (Social Security, pensions)" />
                        <StepCard number="5-6" title="Healthcare & Simulation" description="Model pre-Medicare and Medicare costs, set tax rates, then run Monte Carlo analysis" />
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
                        Takes 5 minutes • See results instantly • 100% free forever
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <p className="text-sm max-w-2xl">
                            For educational purposes only. Not financial, tax, legal, or investment advice.
                            Projections use actuarial models with documented assumptions. Consult a qualified professional before making retirement decisions.
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                            <Heart className="w-4 h-4 text-red-400" />
                            <span>Built with transparency • 2026</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}


function StepCard({ number, title, description }: { number: string, title: string, description: string }) {
    return (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-6 hover:shadow-lg transition-shadow text-center">
            <div className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-sm font-bold px-4 py-1.5 rounded-full mb-4">
                <span>Step {number}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
            <p className="text-slate-600 mb-4">{description}</p>
        </div>
    );
}