// src/components/wizard/Screen4Assumptions.tsx
// Screen 4 of 4 — "Assumptions & Strategy": marginal tax rate, inflation, simulation
// settings, and the withdrawal strategy. Merges the former Tax & Simulation and
// Withdrawal Strategy steps — everything about *how the engine runs*.

import { useInputs } from '@/contexts/InputsContext';
import { DEFAULT_VALUES } from '@/lib/constants';
import { Info, MapPin, Check, Lock } from 'lucide-react';
import { RetirementTimeline } from './RetirementTimeline';
import { RMD_START_AGE } from '@/lib/calculations/rmd';

const NO_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];

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

const STRATEGIES: StrategyCard[] = [
    {
        key: 'standard',
        tier: 'Simple',
        name: 'Standard order',
        does: 'Spend the taxable account first, then tax-deferred, then Roth — the conventional rule of thumb.',
        real: 'Nothing extra to do — spend from your everyday brokerage first and leave the retirement accounts to grow until you need them.',
        bestFor: '“Keep it simple,” or a baseline to compare against.',
    },
    {
        key: 'tax_smart',
        tier: 'Recommended',
        name: 'Tax-smart sequencing',
        does: 'Each gap year, draw tax-deferred up to the standard-deduction floor (≈ tax-free), then taxable, then Roth. Uses the free room yearly and shrinks future RMDs.',
        real: 'In your lower-income years — after retiring, before Social Security and RMDs — draw tax-deferred first up to the top of your standard deduction, then taxable and Roth. Confirm the exact amount with your custodian or CPA near year-end.',
        bestFor: 'Most people. Automatic in the tool.',
    },
    {
        key: 'roth_conversion',
        tier: 'Advanced',
        name: 'Gap-year Roth conversions',
        does: 'Tax-smart sequencing plus converting extra tax-deferred → Roth up to a ceiling you set, during low-income gap years.',
        real: 'Actively convert Traditional → Roth each gap year to fill a low bracket, paying tax from taxable. Mind the ACA subsidy cliff before 65 and the 2-year-lagged IRMAA surcharge.',
        bestFor: 'Larger tax-deferred balances; users comfortable with IRMAA/ACA trade-offs.',
        disabled: true,
        disabledNote: 'Coming soon',
    },
];

export function Screen4Assumptions() {
    const { inputs, updateTax, updateSimulation, updateWithdrawalStrategy } = useInputs();
    const { tax, simulation, mode, personal, income } = inputs;
    const isAdvanced = mode === 'advanced';
    const isNoTaxState = NO_TAX_STATES.includes(personal.state);
    const selected: StrategyKey = inputs.withdrawalStrategy.strategy ?? 'tax_smart';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Assumptions &amp; Strategy</h2>
                <p className="text-gray-600">Tax rate, inflation, and how the simulator draws from your accounts</p>
            </div>

            {/* Tax + inflation */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-blue-50 to-white">
                <h3 className="font-semibold text-lg mb-3">Tax &amp; Inflation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Marginal Tax Rate</label>
                        <div className="relative">
                            <input type="number" value={(tax.combinedEffectiveRate * 100).toFixed(1)}
                                onChange={(e) => updateTax({ combinedEffectiveRate: parseFloat(e.target.value) / 100 || 0 })}
                                className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500" step="1" min="0" max="50" />
                            <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Applied <em>above</em> the standard deduction. Use a bracket rate, not a blended one — the tool models the deduction and SS formula for you.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">General Inflation Rate</label>
                        <div className="relative">
                            <input type="number" value={(simulation.generalInflationRate * 100).toFixed(1)}
                                onChange={(e) => updateSimulation({ generalInflationRate: parseFloat(e.target.value) / 100 || 0 })}
                                className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500" step="0.1" min="0" max="10" />
                            <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Default {(DEFAULT_VALUES.simulation.generalInflationRate * 100).toFixed(1)}% per year</p>
                    </div>

                    {isAdvanced && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Healthcare Inflation Rate</label>
                                <div className="relative">
                                    <input type="number" value={(simulation.healthcareInflationRate * 100).toFixed(1)}
                                        onChange={(e) => updateSimulation({ healthcareInflationRate: parseFloat(e.target.value) / 100 || 0 })}
                                        className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500" step="0.1" min="0" max="15" />
                                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Usually higher than general; default {(DEFAULT_VALUES.simulation.healthcareInflationRate * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Investment Return Std. Deviation</label>
                                <div className="relative">
                                    <input type="number" value={(simulation.returnStdDeviation * 100).toFixed(0)}
                                        onChange={(e) => updateSimulation({ returnStdDeviation: parseFloat(e.target.value) / 100 || 0 })}
                                        className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500" step="1" min="5" max="30" />
                                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Market volatility; default {(DEFAULT_VALUES.simulation.returnStdDeviation * 100).toFixed(0)}%</p>
                            </div>
                        </>
                    )}
                </div>

                {/* State-tax guidance */}
                <div className="mt-3">
                    {isNoTaxState ? (
                        <div className="bg-green-50 border border-green-200 rounded-md p-3 flex gap-2">
                            <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-green-800"><strong>{personal.state}</strong> has no state income tax — use your federal marginal rate only (e.g., 10–12%).</p>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex gap-2">
                            <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">
                                <strong>{personal.state}:</strong> many states exempt Social Security and part of retirement income. Add only your state’s rate on income it truly taxes — often <strong>0–5%</strong>.
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3 flex gap-2">
                    <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                        The tool models the standard deduction (incl. age-65 and 2025–2028 senior bonus) and the IRS SS provisional-income formula, then applies this marginal rate. It does <strong>not</strong> model full brackets, itemized deductions, the 0% LTCG bracket, or state-specific rules.
                    </p>
                </div>
            </div>

            {/* Withdrawal strategy */}
            <div className="border-t pt-6">
                <h3 className="text-xl font-bold mb-1">Withdrawal Strategy</h3>
                <p className="text-gray-600 mb-4">How the simulator draws money each year — this materially changes lifetime tax and how long the money lasts.</p>

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
                                    s.disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-blue-400',
                                    isSelected ? 'border-blue-600 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-300',
                                ].join(' ')}
                            >
                                <div className="flex items-center justify-between mb-2 min-h-[1.5rem]">
                                    <span className={['text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded',
                                        s.key === 'tax_smart' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'].join(' ')}>
                                        {s.tier}
                                    </span>
                                    {s.disabled ? (
                                        <span className="flex items-center gap-1 text-xs text-gray-500"><Lock className="w-3.5 h-3.5" />{s.disabledNote}</span>
                                    ) : isSelected ? (
                                        <span className="flex items-center gap-1 text-sm font-medium text-blue-700"><Check className="w-4 h-4" />Selected</span>
                                    ) : null}
                                </div>
                                <h4 className="font-semibold text-base mb-3">{s.name}</h4>
                                <dl className="space-y-3 text-sm">
                                    <div><dt className="font-medium text-gray-700">What the simulator does</dt><dd className="text-gray-600">{s.does}</dd></div>
                                    <div><dt className="font-medium text-gray-700">In real life</dt><dd className="text-gray-600">{s.real}</dd></div>
                                    <div><dt className="font-medium text-gray-700">Best for</dt><dd className="text-gray-600">{s.bestFor}</dd></div>
                                </dl>
                            </button>
                        );
                    })}
                </div>

                <div className="border rounded-lg p-5 bg-gradient-to-r from-blue-50 to-white mt-4">
                    <h4 className="font-semibold text-lg mb-1">Your retirement timeline</h4>
                    <p className="text-sm text-gray-600 mb-3">
                        The “gap years” between retirement and age {RMD_START_AGE} — before Social Security and RMDs fill up your taxable income — are when a smart withdrawal order saves the most tax.
                    </p>
                    <RetirementTimeline
                        retirementAge={personal.retirementAge}
                        lifeExpectancy={personal.lifeExpectancy}
                        ssClaimingAge={income.socialSecurity.claimingAge}
                        rmdAge={RMD_START_AGE}
                    />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4 flex gap-2">
                    <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                        The projection <strong>assumes you follow the chosen order</strong> each year. It does not model ACA subsidies, IRMAA surcharges, or state rules — check those with a CPA.
                    </p>
                </div>
            </div>
        </div>
    );
}
