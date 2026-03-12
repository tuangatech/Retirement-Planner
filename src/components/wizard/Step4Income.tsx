// src/components/wizard/Step4Income.tsx

import { useInputs } from '@/contexts/InputsContext';
import { Trash2, AlertCircle } from 'lucide-react';
import type { Pension } from '@/types';
import { CollapsibleHelpPanel } from '@/components/common/CollapsibleHelpPanel';
import { HelpPopover } from '@/components/common/HelpPopover';
import { InlineGuidance } from '@/components/common/InlineGuidance';

export function Step4Income() {
    const {
        inputs,
        updateSocialSecurity,
        addPension,
        removePension,
        updatePension,
        updatePartTimeWork,
        updateRentalIncome,
    } = useInputs();
    const { income } = inputs;

    const handlePensionChange = (id: string, field: keyof Pension, value: any) => {
        updatePension(id, { [field]: value });
    };

    const hasEarningsTestIssue =
        income.socialSecurity.claimingAge < 67 &&
        income.partTimeWork.enabled &&
        income.partTimeWork.startAge < 67;

    const claimingFactors: Record<number, number> = {
        62: 0.70, 63: 0.75, 64: 0.80, 65: 0.867, 66: 0.933,
        67: 1.0, 68: 1.08, 69: 1.16, 70: 1.24
    };
    const claimingFactor = claimingFactors[income.socialSecurity.claimingAge] || 1.0;
    const estimatedMonthlyBenefit = income.socialSecurity.monthlyBenefitAtFRA * claimingFactor;

    const taxPct = income.socialSecurity.taxablePercentage * 100;
    const taxableLabel =
        taxPct === 0 ? 'None taxable — combined income below $25,000' :
            taxPct <= 50 ? 'Up to 50% taxable — combined income $25,000–$34,000' :
                '85% taxable — combined income above $34,000';

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Income Sources</h2>
                <p className="text-gray-600">Configure Social Security, pensions, and other income</p>
            </div>

            {/* Social Security */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-blue-50 to-white">
                <div className="mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        Social Security
                        <HelpPopover title="Getting Your Benefit Estimate">
                            <p className="mb-2">
                                Your actual benefit is based on your highest 35 years of earnings.
                            </p>
                            <p className="font-medium mb-1">To get your personalized estimate:</p>
                            <ol className="list-decimal ml-4 space-y-1 text-sm">
                                <li>Visit <span className="text-blue-600 underline">ssa.gov/myaccount</span></li>
                                <li>Create or log into your account</li>
                                <li>View your Statement</li>
                                <li>Find your "Full Retirement Age" benefit amount</li>
                            </ol>
                            <p className="mt-3 text-xs text-gray-600">
                                💡 The statement shows benefits at ages 62, 67 (FRA), and 70
                            </p>
                        </HelpPopover>
                    </h3>
                    <p className="text-sm text-gray-600">Most Americans' primary retirement income source</p>
                </div>

                <CollapsibleHelpPanel
                    title="Understanding Social Security Claiming Strategies"
                    variant="info"
                    className="mb-4"
                >
                    <div className="space-y-3">
                        <p>
                            When you claim Social Security significantly impacts your lifetime benefits.
                            Each year you delay increases your monthly benefit.
                        </p>
                        <div className="bg-white border border-blue-200 rounded-lg p-3">
                            <h5 className="font-semibold text-blue-900 mb-2">Claiming Age Impact</h5>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-blue-200">
                                        <th className="text-left py-2">Age</th>
                                        <th className="text-left py-2">% of FRA</th>
                                        <th className="text-left py-2">Strategy</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700">
                                    <tr className="border-b border-blue-100">
                                        <td className="py-2">62</td>
                                        <td className="py-2 font-medium">70%</td>
                                        <td className="py-2">Need income now, poor health</td>
                                    </tr>
                                    <tr className="border-b border-blue-100">
                                        <td className="py-2">67 (FRA)</td>
                                        <td className="py-2 font-medium">100%</td>
                                        <td className="py-2">Balanced approach</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2">70</td>
                                        <td className="py-2 font-medium">124%</td>
                                        <td className="py-2">Maximize benefits, good health</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-600 italic">
                            💡 Delaying from 62 to 70 increases benefits by 77% — but you receive 8 fewer years of payments.
                            Break-even is typically around age 78–80.
                        </p>
                    </div>
                </CollapsibleHelpPanel>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-1">
                            Monthly Benefit at Full Retirement Age (FRA)
                            <HelpPopover>
                                <p className="mb-2">FRA is age 67 for most people (born 1960 or later).</p>
                                <p>This is the baseline amount before any early or delayed claiming adjustments.</p>
                            </HelpPopover>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                                type="number"
                                value={income.socialSecurity.monthlyBenefitAtFRA}
                                onChange={(e) =>
                                    updateSocialSecurity({ monthlyBenefitAtFRA: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Get estimate from ssa.gov/myaccount</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-1">
                            Annual COLA Rate
                            <HelpPopover>
                                <p className="mb-2">Cost of Living Adjustment — how benefits increase each year to keep pace with inflation.</p>
                                <p className="font-medium mb-1">Historical COLA rates:</p>
                                <ul className="list-disc ml-4 mt-1 space-y-1 text-sm">
                                    <li>2025: 2.8%</li>
                                    <li>2024: 2.5%</li>
                                    <li>2023: 3.2%</li>
                                    <li>2022: 8.7% (unusually high)</li>
                                    <li>10-year average: ~3.0%</li>
                                </ul>
                            </HelpPopover>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={(income.socialSecurity.colaRate * 100).toFixed(1)}
                                onChange={(e) =>
                                    updateSocialSecurity({ colaRate: parseFloat(e.target.value) / 100 || 0 })
                                }
                                className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                step="0.1"
                            />
                            <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Default: 2.5% (10-year average)</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-1">
                            Claiming Age
                            <HelpPopover title="Claiming Age Decision">
                                <p className="mb-2">Key considerations when choosing your claiming age:</p>
                                <ul className="list-disc ml-4 space-y-1 text-sm">
                                    <li>Health: poor health → claim early</li>
                                    <li>Longevity: family lives long → delay</li>
                                    <li>Financial need: need income → claim early</li>
                                    <li>Other income: have assets → delay</li>
                                    <li>Working: earnings test applies before FRA</li>
                                </ul>
                                <p className="mt-2 text-xs text-gray-600">
                                    💡 Each year you delay adds ~8% to your benefit (up to age 70)
                                </p>
                            </HelpPopover>
                        </label>
                        <input
                            type="number"
                            value={income.socialSecurity.claimingAge}
                            onChange={(e) =>
                                updateSocialSecurity({ claimingAge: parseInt(e.target.value) || 67 })
                            }
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            min="62"
                            max="70"
                        />
                        <p className="text-xs text-gray-500 mt-1">Age 62–70 (FRA is typically 67)</p>
                        <InlineGuidance variant="example" className="mt-2">
                            <strong>Your estimated benefit at age {income.socialSecurity.claimingAge}:</strong>{' '}
                            ${estimatedMonthlyBenefit.toFixed(0)}/month (${(estimatedMonthlyBenefit * 12).toLocaleString()}/year)
                        </InlineGuidance>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-1">
                            SS Taxable Percentage
                            <HelpPopover title="How Much of SS is Taxable?">
                                <p className="mb-2">
                                    The IRS taxes Social Security based on your "combined income"
                                    (AGI + tax-free interest + ½ of SS benefits).
                                </p>
                                <p className="font-medium mb-1">Single filer thresholds:</p>
                                <table className="w-full text-sm mb-2">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-1">Combined Income</th>
                                            <th className="text-left py-1">% Taxable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td className="py-1">Below $25,000</td><td className="py-1 font-medium">0%</td></tr>
                                        <tr><td className="py-1">$25,000–$34,000</td><td className="py-1 font-medium">up to 50%</td></tr>
                                        <tr><td className="py-1">Above $34,000</td><td className="py-1 font-medium">up to 85%</td></tr>
                                    </tbody>
                                </table>
                                <p className="text-xs text-gray-600">
                                    💡 85% is the IRS maximum — SS benefits are never fully taxable.
                                    Most retirees with investment accounts exceed the $34,000 threshold,
                                    so 85% is the right default for most users of this tool.
                                </p>
                            </HelpPopover>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={(income.socialSecurity.taxablePercentage * 100).toFixed(0)}
                                onChange={(e) =>
                                    updateSocialSecurity({
                                        taxablePercentage: parseFloat(e.target.value) / 100 || 0,
                                    })
                                }
                                className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                step="5"
                                min="0"
                                max="85"
                            />
                            <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{taxableLabel}</p>
                        {taxPct === 85 && (
                            <InlineGuidance variant="example" className="mt-2">
                                <strong>85% is correct for most users.</strong> Anyone with portfolio withdrawals
                                + SS will typically exceed the $34,000 combined income threshold.
                            </InlineGuidance>
                        )}
                    </div>
                </div>

                {hasEarningsTestIssue && (
                    <div className="mt-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h4 className="font-semibold text-yellow-900 mb-2">
                                    ⚠️ Social Security Earnings Test Applies
                                </h4>
                                <p className="text-sm text-yellow-800 mb-2">
                                    You're planning to claim Social Security before Full Retirement Age (67)
                                    while working. Your benefits may be temporarily reduced:
                                </p>
                                <ul className="text-sm text-yellow-800 space-y-1 ml-4 list-disc">
                                    <li>Before FRA: $1 withheld for every $2 earned above $23,400/year (2025)</li>
                                    <li>In FRA year: $1 withheld for every $3 earned above $62,160/year (2025)</li>
                                    <li>After FRA: No earnings limit</li>
                                </ul>
                                <p className="text-xs text-yellow-700 mt-3 italic">
                                    Note: Withheld benefits aren't lost forever — your benefit increases
                                    when you reach FRA to account for months withheld. The simulator
                                    applies the earnings test reduction.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Pensions */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-green-50 to-white">
                <div className="mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        Pensions
                        <HelpPopover title="Understanding Pensions">
                            <p className="mb-2">
                                Defined benefit plans that pay a fixed amount monthly for life.
                            </p>
                            <p className="font-medium mb-1">Common types:</p>
                            <ul className="list-disc ml-4 space-y-1 text-sm">
                                <li>Private pensions: usually no COLA (0%)</li>
                                <li>Government pensions: often 2–3% COLA</li>
                                <li>Military pensions: typically match SS COLA</li>
                            </ul>
                            <p className="mt-2 text-xs text-gray-600">
                                💡 Unlike 401(k)s, pensions continue for life regardless of market performance
                            </p>
                        </HelpPopover>
                    </h3>
                    <p className="text-sm text-gray-600">Add any pension income you expect</p>
                </div>

                {income.pensions.length > 0 ? (
                    <div className="space-y-3 mb-4">
                        {income.pensions.map((pension) => (
                            <div key={pension.id} className="bg-white p-4 rounded-md border">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium mb-1">Pension Name</label>
                                        <input
                                            type="text"
                                            value={pension.name}
                                            onChange={(e) => handlePensionChange(pension.id, 'name', e.target.value)}
                                            placeholder="e.g., State Pension, IBM Pension"
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                            maxLength={50}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Monthly Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                                            <input
                                                type="number"
                                                value={pension.monthlyAmount}
                                                onChange={(e) =>
                                                    handlePensionChange(pension.id, 'monthlyAmount', parseFloat(e.target.value) || 0)
                                                }
                                                className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                                step="100"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Start Age</label>
                                        <input
                                            type="number"
                                            value={pension.startAge}
                                            onChange={(e) =>
                                                handlePensionChange(pension.id, 'startAge', parseInt(e.target.value) || inputs.personal.retirementAge)
                                            }
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                            min={inputs.personal.retirementAge}
                                            max={inputs.personal.lifeExpectancy}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <label className="flex items-center gap-2 text-xs font-medium mb-1">
                                            Annual COLA
                                            <HelpPopover placement="top">
                                                <p className="font-medium mb-1">Typical COLA rates:</p>
                                                <ul className="list-disc ml-4 mt-1 space-y-1 text-sm">
                                                    <li>Private sector: 0% (fixed)</li>
                                                    <li>State/local government: 1–3%</li>
                                                    <li>Federal government: matches SS (~2.5%)</li>
                                                    <li>Military: matches SS</li>
                                                </ul>
                                            </HelpPopover>
                                        </label>
                                        <div className="relative w-32">
                                            <input
                                                type="number"
                                                value={(pension.colaRate * 100).toFixed(1)}
                                                onChange={(e) =>
                                                    handlePensionChange(pension.id, 'colaRate', parseFloat(e.target.value) / 100 || 0)
                                                }
                                                className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                                step="0.1"
                                                min="0"
                                                max="10"
                                            />
                                            <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">0% private, ~2% government</p>
                                    </div>
                                    <button
                                        onClick={() => removePension(pension.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors self-end mb-6"
                                        title="Remove pension"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 mb-4 italic">No pensions added yet</p>
                )}

                <button
                    onClick={() =>
                        addPension({
                            id: Date.now().toString(),
                            name: 'New Pension',
                            monthlyAmount: 1000,
                            startAge: inputs.personal.retirementAge,
                            colaRate: 0,
                        })
                    }
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    + Add Pension
                </button>
            </div>

            {/* Part-Time Work */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-purple-50 to-white">
                <div className="flex items-center mb-3">
                    <input
                        type="checkbox"
                        id="partTimeWork"
                        checked={income.partTimeWork.enabled}
                        onChange={(e) => updatePartTimeWork({ enabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="partTimeWork" className="ml-2 flex items-center gap-2">
                        <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                Part-Time Work (Optional)
                                <HelpPopover title="Part-Time Work Considerations">
                                    <p className="mb-2">
                                        Many retirees work part-time for income, health benefits, or staying active.
                                    </p>
                                    <p className="font-medium mb-1">Tax implications:</p>
                                    <ul className="list-disc ml-4 space-y-1 text-sm">
                                        <li>Subject to 7.65% payroll tax (FICA)</li>
                                        <li>Taxed at your effective income tax rate</li>
                                        <li>May trigger SS earnings test if claiming before FRA</li>
                                    </ul>
                                    <p className="mt-2 text-xs text-gray-600">
                                        💡 Common: Consulting, seasonal work, passion projects
                                    </p>
                                </HelpPopover>
                            </h3>
                            <p className="text-sm text-gray-600">Income from working during retirement</p>
                        </div>
                    </label>
                </div>

                {income.partTimeWork.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Annual Gross Income</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    value={income.partTimeWork.annualIncome}
                                    onChange={(e) =>
                                        updatePartTimeWork({ annualIncome: parseFloat(e.target.value) || 0 })
                                    }
                                    className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Before taxes</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Age</label>
                            <input
                                type="number"
                                value={income.partTimeWork.startAge}
                                onChange={(e) => updatePartTimeWork({ startAge: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">End Age</label>
                            <input
                                type="number"
                                value={income.partTimeWork.endAge}
                                onChange={(e) => updatePartTimeWork({ endAge: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Rental Income */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-orange-50 to-white">
                <div className="flex items-center mb-3">
                    <input
                        type="checkbox"
                        id="rentalIncome"
                        checked={income.rentalIncome.enabled}
                        onChange={(e) => updateRentalIncome({ enabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="rentalIncome" className="ml-2 flex items-center gap-2">
                        <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                Rental Income (Optional)
                                <HelpPopover title="Rental Income Planning">
                                    <p className="mb-2">
                                        Rental properties can provide steady passive income in retirement.
                                    </p>
                                    <p className="font-medium mb-1">Enter NET income after:</p>
                                    <ul className="list-disc ml-4 space-y-1 text-sm">
                                        <li>Mortgage payments</li>
                                        <li>Property taxes and insurance</li>
                                        <li>Maintenance and repairs</li>
                                        <li>Property management fees</li>
                                        <li>Vacancy allowance</li>
                                    </ul>
                                    <p className="mt-2 text-xs text-gray-600">
                                        💡 Typical net yield: 6–8% of property value annually
                                    </p>
                                </HelpPopover>
                            </h3>
                            <p className="text-sm text-gray-600">Net income from rental properties</p>
                        </div>
                    </label>
                </div>

                {income.rentalIncome.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Annual Net Income</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    value={income.rentalIncome.annualNetIncome}
                                    onChange={(e) =>
                                        updateRentalIncome({ annualNetIncome: parseFloat(e.target.value) || 0 })
                                    }
                                    className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">After expenses and mortgage</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Age</label>
                            <input
                                type="number"
                                value={income.rentalIncome.startAge}
                                onChange={(e) => updateRentalIncome({ startAge: parseInt(e.target.value) || 0 })}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center pt-6">
                            <input
                                type="checkbox"
                                id="inflationAdjusted"
                                checked={income.rentalIncome.inflationAdjusted}
                                onChange={(e) => updateRentalIncome({ inflationAdjusted: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <label htmlFor="inflationAdjusted" className="ml-2 text-sm flex items-center gap-1">
                                Adjust for inflation
                                <HelpPopover placement="top">
                                    <p className="mb-2">If checked, rent increases with general inflation (default 3%).</p>
                                    <p className="font-medium mb-1">Uncheck if:</p>
                                    <ul className="list-disc ml-4 mt-1 space-y-1 text-sm">
                                        <li>Fixed lease amounts</li>
                                        <li>Property in declining area</li>
                                        <li>Planning to sell soon</li>
                                    </ul>
                                </HelpPopover>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}