// src/components/results/AnnualTable.tsx - Clean Table + Detailed CSV Export

import { useState, useMemo } from 'react';
import { Download, Info, TrendingUp, AlertCircle, Calendar, DollarSign } from 'lucide-react';
import type { SimulationResults } from '@/types'
import type { UserInputs } from '@/types';
import type { YearlyProjection } from '@/lib/calculations/yearlyProjection';
import { formatMoney } from '@/lib/format';

interface AnnualTableProps {
    results: SimulationResults;
    inputs: UserInputs;
}

interface Insight {
    type: 'positive' | 'info' | 'warning' | 'event';
    icon: React.ReactNode;
    title: string;
    description: string;
    ageRange?: string;
}

export default function AnnualTable({ results, inputs }: AnnualTableProps) {
    const [selectedPercentile, setSelectedPercentile] = useState<'p10' | 'p50' | 'p90'>('p50');

    const projections = results.selectedRuns[selectedPercentile].projections;

    // Generate smart insights
    const insights = useMemo(() => generateInsights(projections, inputs), [projections, inputs]);

    const exportToCSV = () => {
        // ✅ COMPREHENSIVE CSV: All account details for spreadsheet analysis
        const headers = [
            // Timeline
            'Age', 'Year', 'Phase',
            // Income breakdown
            'Social Security', 'Pensions', 'Part-Time Work', 'Rental Income', 'Total Income',
            // Expenses breakdown
            'Living Expenses', 'Healthcare Premiums', 'Healthcare Out-of-Pocket', 'One-Time Expenses', 'Total Expenses',
            // Taxes breakdown
            'Income Tax', 'Payroll Tax', 'Withdrawal Tax', 'Total Tax',
            // Withdrawals by account
            'Tax-Deferred Withdrawal', 'Roth Withdrawal', 'Taxable Withdrawal', 'HSA Withdrawal', 'Total Withdrawals',
            // HSA details
            'HSA Healthcare Coverage (Tax-Free)', 'HSA Balance',
            // All account balances
            'Tax-Deferred Balance', 'Roth Balance', 'Taxable Balance', 'Total Portfolio',
            // Summary
            'Net Cash Flow', 'RMD Amount', 'Shortfall'
        ];

        const rows = projections.map(p => [
            // Timeline
            p.age,
            p.year,
            p.phase,
            // Income
            p.income.socialSecurity.toFixed(0),
            p.income.pensions.toFixed(0),
            p.income.partTimeWork.toFixed(0),
            p.income.rentalIncome.toFixed(0),
            p.income.totalBeforeWithdrawals.toFixed(0),
            // Expenses
            p.expenses.living.toFixed(0),
            p.expenses.healthcarePremiums.toFixed(0),
            p.expenses.healthcareOutOfPocket.toFixed(0),
            p.expenses.oneTimeExpenses.toFixed(0),
            p.expenses.total.toFixed(0),
            // Taxes
            p.taxes.onFixedIncome.toFixed(0),
            p.taxes.payrollTax.toFixed(0),
            p.taxes.onWithdrawals.toFixed(0),
            p.taxes.total.toFixed(0),
            // Withdrawals
            p.portfolio.withdrawals.taxDeferred.toFixed(0),
            p.portfolio.withdrawals.roth.toFixed(0),
            p.portfolio.withdrawals.taxable.toFixed(0),
            p.portfolio.withdrawals.hsa.toFixed(0),
            p.portfolio.withdrawals.total.toFixed(0),
            // HSA
            p.portfolio.hsaForHealthcare.toFixed(0),
            p.portfolio.balances.hsa.toFixed(0),
            // Balances
            p.portfolio.balances.taxDeferred.toFixed(0),
            p.portfolio.balances.roth.toFixed(0),
            p.portfolio.balances.taxable.toFixed(0),
            p.portfolio.balances.total.toFixed(0),
            // Summary
            p.netCashFlow.toFixed(0),
            p.portfolio.rmdAmount.toFixed(0),
            p.shortfall.toFixed(0),
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `retirement-plan-${selectedPercentile}-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold">Annual Breakdown</h3>
                        <p className="text-sm text-gray-600">Year-by-year overview (export CSV for detailed account breakdowns)</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={selectedPercentile}
                            onChange={(e) => setSelectedPercentile(e.target.value as 'p10' | 'p50' | 'p90')}
                            className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="p10">10th Percentile (Worst Case)</option>
                            <option value="p50">Median (50th Percentile)</option>
                            <option value="p90">90th Percentile (Best Case)</option>
                        </select>

                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* ✅ CLEAN TABLE: 8 columns for easy scanning */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left font-semibold">Age</th>
                                <th className="px-4 py-3 text-left font-semibold">Phase</th>
                                <th className="px-4 py-3 text-right font-semibold">Income</th>
                                <th className="px-4 py-3 text-right font-semibold">Expenses</th>
                                <th className="px-4 py-3 text-right font-semibold">Taxes</th>
                                <th className="px-4 py-3 text-right font-semibold">Withdrawals</th>
                                <th className="px-4 py-3 text-right font-semibold">Portfolio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {projections.map((p, index) => {
                                const isRetirement = p.age === inputs.personal.retirementAge;
                                const isMedicare = p.age === 65;
                                const isSSStart = p.age === inputs.income.socialSecurity.claimingAge;
                                const isRMD = p.age === 73;
                                const hasEvent = isRetirement || isMedicare || isSSStart || isRMD;

                                return (
                                    <tr
                                        key={index}
                                        className={`hover:bg-gray-50 ${hasEvent ? 'bg-blue-50' : ''}`}
                                    >
                                        {/* Age with event markers */}
                                        <td className="sticky left-0 bg-white px-4 py-3 font-medium">
                                            {p.age}
                                            {hasEvent && (
                                                <div className="text-xs text-blue-600 font-normal">
                                                    {isRetirement && '🎂'}
                                                    {isMedicare && '🏥'}
                                                    {isSSStart && '💰'}
                                                    {isRMD && '📊'}
                                                </div>
                                            )}
                                        </td>

                                        {/* Phase */}
                                        <td className="px-4 py-3 capitalize text-gray-700">
                                            {p.phase.replace('_', '-')}
                                        </td>

                                        {/* Income */}
                                        <td className="px-4 py-3 text-right text-green-700 font-medium">
                                            {formatMoney(p.income.totalBeforeWithdrawals)}
                                        </td>

                                        {/* Expenses */}
                                        <td className="px-4 py-3 text-right text-red-700 font-medium">
                                            {formatMoney(p.expenses.total)}
                                        </td>

                                        {/* Taxes */}
                                        <td className="px-4 py-3 text-right text-orange-700 font-medium">
                                            {formatMoney(p.taxes.total)}
                                        </td>

                                        {/* Withdrawals */}
                                        <td className="px-4 py-3 text-right text-purple-700 font-medium">
                                            {formatMoney(p.portfolio.withdrawals.total)}
                                        </td>

                                        {/* Portfolio Balance */}
                                        <td className={`px-4 py-3 text-right font-semibold ${p.portfolio.balances.total < 100000 ? 'text-red-600' :
                                                p.portfolio.balances.total > 1000000 ? 'text-green-600' :
                                                    'text-gray-900'
                                            }`}>
                                            {formatMoney(p.portfolio.balances.total)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Column Explanations Panel */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
                <div className="flex items-start gap-3 mb-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <h4 className="font-semibold text-blue-900">📊 Understanding This Table</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-blue-800">
                    <div>
                        <span className="font-semibold">Income:</span> Total income before portfolio withdrawals (Social Security, pensions, work, rental)
                    </div>
                    <div>
                        <span className="font-semibold">Expenses:</span> Total spending (living costs, healthcare, one-time expenses)
                    </div>
                    <div>
                        <span className="font-semibold">Taxes:</span> All taxes paid (income tax, payroll tax, withdrawal tax)
                    </div>
                    <div>
                        <span className="font-semibold">Withdrawals:</span> Total from all accounts (tax-deferred, Roth, taxable, HSA)
                    </div>
                    <div>
                        <span className="font-semibold">Portfolio:</span> Combined balance of all investment accounts
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-blue-300 text-xs text-blue-700">
                    <strong>💡 Tip:</strong> Export to CSV for detailed account-by-account breakdowns including HSA balance,
                    individual account withdrawals, healthcare coverage, RMDs, and more.
                </div>
            </div>

            {/* Smart Insights Panel */}
            {insights.length > 0 && (
                <div className="bg-white border-2 border-gray-200 rounded-lg p-5">
                    <div className="flex items-start gap-3 mb-4">
                        <TrendingUp className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" />
                        <h4 className="font-semibold text-gray-900">💡 Key Insights from Your Plan</h4>
                    </div>

                    <div className="space-y-3">
                        {insights.map((insight, index) => (
                            <InsightCard key={index} insight={insight} />
                        ))}
                    </div>
                </div>
            )}

            {/* Event Legend */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2 text-sm">Event Markers in Table:</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm text-gray-700">
                    <div>🎂 = Retirement Begins</div>
                    <div>🏥 = Medicare Starts (Age 65)</div>
                    <div>💰 = Social Security Starts</div>
                    <div>📊 = RMDs Begin (Age 73)</div>
                    {inputs.accounts.hsa.balanceAtRetirement > 0 && (
                        <div>💊 = HSA Depleted (see CSV for details)</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Insight Card Component
function InsightCard({ insight }: { insight: Insight }) {
    const colorClasses = {
        positive: 'bg-green-50 border-green-300 text-green-800',
        info: 'bg-blue-50 border-blue-300 text-blue-800',
        warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
        event: 'bg-purple-50 border-purple-300 text-purple-800',
    };

    const iconColorClasses = {
        positive: 'text-green-600',
        info: 'text-blue-600',
        warning: 'text-yellow-600',
        event: 'text-purple-600',
    };

    return (
        <div className={`border-l-4 ${colorClasses[insight.type]} rounded-r-lg p-4`}>
            <div className="flex items-start gap-3">
                <div className={iconColorClasses[insight.type]}>
                    {insight.icon}
                </div>
                <div className="flex-1">
                    <div className="font-semibold mb-1">
                        {insight.title}
                        {insight.ageRange && (
                            <span className="ml-2 text-xs font-normal opacity-75">
                                {insight.ageRange}
                            </span>
                        )}
                    </div>
                    <div className="text-sm opacity-90">
                        {insight.description}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Smart Insights Generation Function
function generateInsights(projections: YearlyProjection[], inputs: UserInputs): Insight[] {
    const insights: Insight[] = [];

    // 1. Zero Withdrawal Period Detection
    const firstWithdrawalIndex = projections.findIndex(p => p.portfolio.withdrawals.total > 100);
    if (firstWithdrawalIndex > 0) {
        const firstWithdrawalAge = projections[firstWithdrawalIndex].age;
        const zeroWithdrawalYears = firstWithdrawalAge - inputs.personal.retirementAge;

        insights.push({
            type: 'positive',
            icon: <AlertCircle className="w-5 h-5" />,
            title: 'No withdrawals needed in early retirement!',
            ageRange: `Ages ${inputs.personal.retirementAge}-${firstWithdrawalAge - 1}`,
            description: `Your income plus portfolio returns cover all expenses for the first ${zeroWithdrawalYears} years. Your portfolio actually grows during this period, providing a strong foundation for later years.`
        });
    }

    // 2. Medicare Start (Age 65)
    const medicareIndex = projections.findIndex(p => p.age === 65);
    if (medicareIndex > 0 && medicareIndex < projections.length - 1) {
        const preMedicareHealthcare =
            projections[medicareIndex - 1].expenses.healthcarePremiums +
            projections[medicareIndex - 1].expenses.healthcareOutOfPocket;
        const medicareHealthcare =
            projections[medicareIndex].expenses.healthcarePremiums +
            projections[medicareIndex].expenses.healthcareOutOfPocket;
        const healthcareDrop = preMedicareHealthcare - medicareHealthcare;

        if (healthcareDrop > 1000) {
            insights.push({
                type: 'info',
                icon: <Calendar className="w-5 h-5" />,
                title: 'Medicare eligibility begins',
                ageRange: 'Age 65',
                description: `Healthcare costs decrease by approximately ${(healthcareDrop / 1000).toFixed(1)}K/year as you transition from private insurance to Medicare coverage. This improves your cash flow and reduces pressure on your portfolio.`
            });
        } else if (healthcareDrop < -1000) {
            insights.push({
                type: 'warning',
                icon: <AlertCircle className="w-5 h-5" />,
                title: 'Medicare begins with higher costs',
                ageRange: 'Age 65',
                description: `Healthcare costs increase by approximately ${(Math.abs(healthcareDrop) / 1000).toFixed(1)}K/year, likely due to higher out-of-pocket expenses or IRMAA surcharges. Consider reviewing your Medicare coverage options.`
            });
        }
    }

    // 3. Social Security Start
    const ssClaimingAge = inputs.income.socialSecurity.claimingAge;
    const ssStartIndex = projections.findIndex(p => p.age === ssClaimingAge);
    if (ssStartIndex >= 0) {
        const ssAmount = projections[ssStartIndex].income.socialSecurity;
        const earningsReduction = projections[ssStartIndex].income.socialSecurityReduction;

        if (earningsReduction > 100) {
            insights.push({
                type: 'warning',
                icon: <AlertCircle className="w-5 h-5" />,
                title: 'Social Security starts with earnings penalty',
                ageRange: `Age ${ssClaimingAge}`,
                description: `Your benefit of ${(ssAmount / 1000).toFixed(1)}K/year is reduced by ${(earningsReduction / 1000).toFixed(1)}K due to the earnings test (you're working while claiming before age 67). Consider delaying your claim or reducing work hours.`
            });
        } else {
            insights.push({
                type: 'info',
                icon: <Calendar className="w-5 h-5" />,
                title: 'Social Security begins',
                ageRange: `Age ${ssClaimingAge}`,
                description: `You start receiving approximately ${(ssAmount / 1000).toFixed(1)}K/year in Social Security benefits${ssClaimingAge < 67 ? ' (reduced for early claiming)' : ssClaimingAge > 67 ? ' (increased for delayed claiming)' : ' (at full retirement age)'}. This provides a reliable income floor for the rest of your life.`
            });
        }
    }

    // 4. RMD Start (Age 73)
    const rmdIndex = projections.findIndex(p => p.age === 73);
    if (rmdIndex >= 0) {
        const rmdAmount = projections[rmdIndex].portfolio.rmdAmount;
        const rmdTax = projections[rmdIndex].taxes.onWithdrawals;
        const withdrawal = projections[rmdIndex].portfolio.withdrawals.total;

        if (rmdAmount > 100) {
            insights.push({
                type: 'warning',
                icon: <AlertCircle className="w-5 h-5" />,
                title: 'Required Minimum Distributions (RMDs) begin',
                ageRange: 'Age 73+',
                description: `The IRS requires you to withdraw at least ${(rmdAmount / 1000).toFixed(1)}K/year from tax-deferred accounts and pay approximately ${(rmdTax / 1000).toFixed(1)}K in taxes. ${withdrawal > rmdAmount * 1.1 ? 'You need additional withdrawals beyond the RMD to cover expenses.' : 'You don\'t need this money for expenses, so after-tax proceeds get reinvested to your taxable account.'}`
            });
        }
    }

    // 5. HSA Depletion Detection
    const hsaDepletionIndex = projections.findIndex(p => p.portfolio.balances.hsa < 100);
    if (hsaDepletionIndex > 0 && inputs.accounts.hsa.balanceAtRetirement > 0) {
        const depletionYear = projections[hsaDepletionIndex];
        const yearsOfCoverage = depletionYear.age - inputs.personal.retirementAge;

        insights.push({
            type: 'info',
            icon: <Calendar className="w-5 h-5" />,
            title: 'HSA provides tax-free healthcare coverage',
            ageRange: `Ages ${inputs.personal.retirementAge}-${depletionYear.age}`,
            description: `Your HSA covers healthcare tax-free for ${yearsOfCoverage} years. After depletion at age ${depletionYear.age}, healthcare costs shift to other accounts (taxed).`
        });
    }

    // 6. One-Time Expenses Detection
    const oneTimeExpenses = projections.filter(p => p.expenses.oneTimeExpenses > 5000);
    oneTimeExpenses.forEach(p => {
        const expense = inputs.oneTimeExpenses.find(e => e.age === p.age);
        if (expense) {
            insights.push({
                type: 'event',
                icon: <Calendar className="w-5 h-5" />,
                title: `One-time expense: ${expense.description}`,
                ageRange: `Age ${p.age}`,
                description: `Planned expense of ${(expense.amount / 1000).toFixed(1)}K (inflated to ${(p.expenses.oneTimeExpenses / 1000).toFixed(1)}K in future dollars). This creates a temporary spike in expenses and may require larger portfolio withdrawals this year.`
            });
        }
    });

    // 7. Part-Time Work Detection
    if (inputs.income.partTimeWork.enabled) {
        const workStartIndex = projections.findIndex(p => p.age === inputs.income.partTimeWork.startAge);

        if (workStartIndex >= 0) {
            const workIncome = projections[workStartIndex].income.partTimeWork;
            insights.push({
                type: 'info',
                icon: <DollarSign className="w-5 h-5" />,
                title: 'Part-time work begins',
                ageRange: `Ages ${inputs.income.partTimeWork.startAge}-${inputs.income.partTimeWork.endAge}`,
                description: `You earn approximately ${(workIncome / 1000).toFixed(1)}K/year from part-time work. This supplemental income reduces portfolio withdrawals and extends your plan's sustainability.`
            });
        }
    }

    // 8. Portfolio Growth Detection (first 5 years)
    if (projections.length >= 5) {
        const startPortfolio = projections[0].portfolio.balances.total;
        const year5Portfolio = projections[4].portfolio.balances.total;
        const portfolioGrowth = year5Portfolio - startPortfolio;

        if (portfolioGrowth > startPortfolio * 0.1) {
            insights.push({
                type: 'positive',
                icon: <TrendingUp className="w-5 h-5" />,
                title: 'Portfolio grows in early retirement',
                ageRange: 'First 5 years',
                description: `Your portfolio increases by approximately ${(portfolioGrowth / 1000).toFixed(0)}K (${((portfolioGrowth / startPortfolio) * 100).toFixed(0)}%) during early retirement. Market returns exceed withdrawals, strengthening your financial position.`
            });
        }
    }

    return insights;
}