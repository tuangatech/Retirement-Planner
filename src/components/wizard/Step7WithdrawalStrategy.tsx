// src/components/wizard/Step7WithdrawalStrategy.tsx

import { useInputs } from '@/contexts/InputsContext';
import { Check, Info, Lock } from 'lucide-react';
import { RetirementTimeline } from './RetirementTimeline';

type StrategyKey = 'standard' | 'tax_smart' | 'roth_conversion';

interface StrategyCard {
    key: StrategyKey;
    tier: string;
    name: string;
    does: string;
    real: string;
    bestFor: string;
    disabled?: boolean;
    disabledNote?: string;
}

// Simple → complex. Medium ('tax_smart') is the default. Roth conversions are documented
// here but not yet wired, so the card is shown disabled ("coming soon").
const STRATEGIES: StrategyCard[] = [
    {
        key: 'standard',
        tier: 'Simple',
        name: 'Standard order',
        does: 'Spend the taxable account first, then tax-deferred, then Roth — the conventional rule of thumb.',
        real: 'Nothing extra to do — this is the natural default: spend from your everyday brokerage account first and leave the retirement accounts to keep growing until you actually need them.',
        bestFor: '“Keep it simple,” or a baseline to compare the smarter strategies against.',
    },
    {
        key: 'tax_smart',
        tier: 'Recommended',
        name: 'Tax-smart sequencing',
        does: 'Each gap year, draw tax-deferred up to the standard-deduction floor (≈ tax-free), then taxable, then Roth. Uses the free room every year and shrinks future RMDs.',
        real: 'You decide which account to tap each year. In your lower-income years — after retiring but before Social Security and before RMDs at 73 — take withdrawals from your Traditional / tax-deferred accounts first, up to the top of your standard deduction, then fall back to taxable and Roth. Filling that “free” deduction room every year is the move, even when you don’t need the cash. Confirm the exact amount with your custodian or CPA near year-end.',
        bestFor: 'Most people. Automatic in the tool; in real life it just means choosing your withdrawal order deliberately.',
    },
    {
        key: 'roth_conversion',
        tier: 'Advanced',
        name: 'Gap-year Roth conversions',
        does: 'Tax-smart sequencing plus converting extra tax-deferred → Roth up to a ceiling you set, during the low-income gap years.',
        real: 'Beyond covering spending, actively convert Traditional → Roth each gap year to “fill up” a low tax bracket, paying the tax from your taxable account. Do it by Dec 31, and mind the ACA subsidy cliff before 65 and the 2-year-lagged IRMAA surcharge — a CPA usually helps size the conversions.',
        bestFor: 'Larger tax-deferred balances; users comfortable with IRMAA/ACA trade-offs.',
        disabled: true,
        disabledNote: 'Coming soon',
    },
];

export function Step7WithdrawalStrategy() {
    const { inputs, updateWithdrawalStrategy } = useInputs();
    const selected: StrategyKey = inputs.withdrawalStrategy.strategy ?? 'tax_smart';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Withdrawal Strategy</h2>
                <p className="text-gray-600">
                    Choose how the simulator draws money from your accounts each year. The order
                    it uses materially changes how much tax you pay over retirement — and how long
                    the money lasts.
                </p>
            </div>

            {/* Strategy cards — side by side */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                {STRATEGIES.map((s) => {
                    const isSelected = selected === s.key && !s.disabled;
                    return (
                        <button
                            key={s.key}
                            type="button"
                            disabled={s.disabled}
                            onClick={() => !s.disabled && updateWithdrawalStrategy({ strategy: s.key })}
                            className={[
                                'flex h-full flex-col text-left border rounded-lg p-4 transition-colors',
                                s.disabled
                                    ? 'opacity-60 cursor-not-allowed bg-gray-50'
                                    : 'cursor-pointer hover:border-blue-400',
                                isSelected ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-300',
                            ].join(' ')}
                        >
                            <div className="flex items-center justify-between mb-2 min-h-[1.5rem]">
                                <span
                                    className={[
                                        'text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded',
                                        s.key === 'tax_smart'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-gray-200 text-gray-700',
                                    ].join(' ')}
                                >
                                    {s.tier}
                                </span>
                                {s.disabled ? (
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                        <Lock className="w-3.5 h-3.5" />
                                        {s.disabledNote}
                                    </span>
                                ) : isSelected ? (
                                    <span className="flex items-center gap-1 text-sm font-medium text-blue-700">
                                        <Check className="w-4 h-4" />
                                        Selected
                                    </span>
                                ) : null}
                            </div>

                            <h3 className="font-semibold text-base mb-3">{s.name}</h3>

                            <dl className="space-y-3 text-sm">
                                <div>
                                    <dt className="font-medium text-gray-700">What the simulator does</dt>
                                    <dd className="text-gray-600">{s.does}</dd>
                                </div>
                                <div>
                                    <dt className="font-medium text-gray-700">In real life</dt>
                                    <dd className="text-gray-600">{s.real}</dd>
                                </div>
                                <div>
                                    <dt className="font-medium text-gray-700">Best for</dt>
                                    <dd className="text-gray-600">{s.bestFor}</dd>
                                </div>
                            </dl>
                        </button>
                    );
                })}
            </div>

            {/* Milestone timeline */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-blue-50 to-white">
                <h3 className="font-semibold text-lg mb-1">Your retirement timeline</h3>
                <p className="text-sm text-gray-600 mb-3">
                    The “gap years” between retirement and age 73 are when a smart withdrawal order
                    saves the most tax — before Social Security and forced RMDs fill up your taxable income.
                    This timeline reflects <strong>your</strong> retirement, Social Security, and life-expectancy
                    ages, and shows the years up to 73 wider since that’s your window to act.
                </p>
                <RetirementTimeline
                    retirementAge={inputs.personal.retirementAge}
                    lifeExpectancy={inputs.personal.lifeExpectancy}
                    ssClaimingAge={inputs.income.socialSecurity.claimingAge}
                />
                <ul className="mt-3 text-sm text-gray-600 space-y-1.5">
                    <li>
                        <strong>Before 65 (Medicare):</strong> lowest-income years — the best time to
                        draw or convert tax-deferred. Note: big withdrawals can forfeit an ACA subsidy,
                        and income at 63 sets your age-65 IRMAA surcharge (neither is modeled here).
                    </li>
                    <li>
                        <strong>Before Social Security starts:</strong> SS isn’t in the tax formula yet,
                        so tax-deferred draws are cheapest. Delaying SS widens this window.
                    </li>
                    <li>
                        <strong>Before 73 (RMDs):</strong> draw the tax-deferred balance down so forced
                        RMDs don’t spike your taxable Social Security (the “tax torpedo”).
                    </li>
                </ul>
            </div>

            {/* Honest-limitation note */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex gap-2">
                    <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                        The projection <strong>assumes you actually follow the chosen order</strong> each
                        year — the “in real life” notes are what it takes to get the same result. The tool
                        does <strong>not</strong> model ACA premium subsidies, IRMAA surcharges, or
                        state-specific rules, so check those separately with a CPA.
                    </div>
                </div>
            </div>
        </div>
    );
}
