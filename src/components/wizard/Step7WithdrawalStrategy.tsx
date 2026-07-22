// src/components/wizard/Step7WithdrawalStrategy.tsx

import { useInputs } from '@/contexts/InputsContext';
import { Check, Info, Lock } from 'lucide-react';

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
        real: 'Nothing special to do; it mirrors how most people spend down by default.',
        bestFor: '“Keep it simple,” or a baseline to compare the smarter strategies against.',
    },
    {
        key: 'tax_smart',
        tier: 'Recommended',
        name: 'Tax-smart sequencing',
        does: 'Each gap year, draw tax-deferred up to the standard-deduction floor (≈ tax-free), then taxable, then Roth. Uses the free room every year and shrinks future RMDs.',
        real: 'Nothing to do — the simulator picks the tax-efficient source order for you.',
        bestFor: 'Most people. Fully automatic, no extra inputs, and typically lasts longer.',
    },
    {
        key: 'roth_conversion',
        tier: 'Advanced',
        name: 'Gap-year Roth conversions',
        does: 'Tax-smart sequencing plus converting extra tax-deferred → Roth up to a ceiling you set, during the low-income gap years.',
        real: 'Execute conversions with your custodian by Dec 31; watch the ACA subsidy cliff (pre-65) and the 2-year-lagged IRMAA surcharge.',
        bestFor: 'Larger tax-deferred balances; users comfortable with IRMAA/ACA trade-offs.',
        disabled: true,
        disabledNote: 'Coming soon',
    },
];

// Illustrative retirement age 58. Kept in a <pre> so the alignment survives.
const MILESTONE_DIAGRAM = `        58         63          65           67            70          73
  ───────●──────────●───────────●────────────●─────────────●───────────●───────▶ life exp.
      RETIRE     IRMAA       MEDICARE      SS at FRA      SS max       RMDs
                lookback     Part B/D      (example       delay        BEGIN
                year for     begins        claim age)                  (forced,
                age-65                                                  fully taxed)

  |<─────────────── GAP YEARS — you control taxable income ────────────────>|
  |<──── pre-Medicare: ACA premium-subsidy cliff in play ────>|
  |<─────────────── prime Roth-conversion runway ──────────────────>|`;

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

            {/* Strategy cards */}
            <div className="space-y-3">
                {STRATEGIES.map((s) => {
                    const isSelected = selected === s.key && !s.disabled;
                    return (
                        <button
                            key={s.key}
                            type="button"
                            disabled={s.disabled}
                            onClick={() => !s.disabled && updateWithdrawalStrategy({ strategy: s.key })}
                            className={[
                                'w-full text-left border rounded-lg p-5 transition-colors',
                                s.disabled
                                    ? 'opacity-60 cursor-not-allowed bg-gray-50'
                                    : 'cursor-pointer hover:border-blue-400',
                                isSelected ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-300',
                            ].join(' ')}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
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
                                    <h3 className="font-semibold text-lg">{s.name}</h3>
                                </div>
                                {s.disabled ? (
                                    <span className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                                        <Lock className="w-3.5 h-3.5" />
                                        {s.disabledNote}
                                    </span>
                                ) : isSelected ? (
                                    <span className="flex items-center gap-1 text-sm font-medium text-blue-700 flex-shrink-0">
                                        <Check className="w-4 h-4" />
                                        Selected
                                    </span>
                                ) : null}
                            </div>

                            <dl className="mt-3 space-y-2 text-sm">
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
                </p>
                <pre className="text-[11px] leading-tight text-gray-700 overflow-x-auto bg-white border rounded p-3">
{MILESTONE_DIAGRAM}
                </pre>
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
                        The simulator applies your chosen strategy automatically — you don’t withdraw
                        anything yourself. It does <strong>not</strong> model ACA premium subsidies,
                        IRMAA surcharges, or state-specific rules, so treat the “in real life” notes as
                        reminders to check those separately.
                    </div>
                </div>
            </div>
        </div>
    );
}
