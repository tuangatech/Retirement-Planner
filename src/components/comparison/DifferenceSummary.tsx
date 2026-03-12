import type { SavedScenario } from '@/lib/storage/scenarioStorage';

interface DifferenceSummaryProps {
    scenarioA: SavedScenario;
    scenarioB: SavedScenario;
}

// const SIGNIFICANT_BALANCE_DIFFERENCE = 50000;

export function DifferenceSummary({ scenarioA, scenarioB }: DifferenceSummaryProps) {
    // Calculate deltas
    const totalPortfolioA =
        scenarioA.inputs.accounts.taxDeferred.balanceAtRetirement +
        scenarioA.inputs.accounts.roth.balanceAtRetirement +
        scenarioA.inputs.accounts.taxable.balanceAtRetirement +
        scenarioA.inputs.accounts.hsa.balanceAtRetirement;

    const totalPortfolioB =
        scenarioB.inputs.accounts.taxDeferred.balanceAtRetirement +
        scenarioB.inputs.accounts.roth.balanceAtRetirement +
        scenarioB.inputs.accounts.taxable.balanceAtRetirement +
        scenarioB.inputs.accounts.hsa.balanceAtRetirement;

    const balanceDelta = totalPortfolioB - totalPortfolioA;
    const retirementAgeDelta = scenarioB.inputs.personal.retirementAge - scenarioA.inputs.personal.retirementAge;
    const spendingDelta = scenarioB.inputs.phases[0].annualSpending - scenarioA.inputs.phases[0].annualSpending;

    const formatCurrency = (amount: number) => {
        return amount.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        });
    };

    // let betterScenario: 'A' | 'B' | 'tie' = 'tie';
    // if (retirementAgeDelta < 0) betterScenario = 'B'; // B retires earlier
    // else if (retirementAgeDelta > 0) betterScenario = 'A'; // A retires earlier
    // else if (balanceDelta > SIGNIFICANT_BALANCE_DIFFERENCE) betterScenario = 'B'; // B has more money
    // else if (balanceDelta < -SIGNIFICANT_BALANCE_DIFFERENCE) betterScenario = 'A'; // A has more money

    return (
        <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 rounded-lg p-6 border-2 border-gray-200 shadow-md">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Key Differences
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Retirement Age Delta */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Retirement Age Difference</div>
                    <div className={`text-3xl font-bold mb-1 ${retirementAgeDelta === 0 ? 'text-gray-900' :
                            retirementAgeDelta < 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {retirementAgeDelta > 0 ? '+' : ''}{retirementAgeDelta} years
                    </div>
                    <div className="text-xs text-gray-500">
                        {retirementAgeDelta === 0 ? (
                            'Same retirement age'
                        ) : (
                            <>Scenario {retirementAgeDelta < 0 ? 'B' : 'A'} retires earlier</>
                        )}
                    </div>
                </div>

                {/* Portfolio Delta */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Starting Portfolio Difference</div>
                    <div className={`text-3xl font-bold mb-1 ${Math.abs(balanceDelta) < 50000 ? 'text-gray-900' :
                            balanceDelta > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {balanceDelta > 0 ? '+' : ''}{formatCurrency(balanceDelta)}
                    </div>
                    <div className="text-xs text-gray-500">
                        {Math.abs(balanceDelta) < 50000 ? (
                            'Similar starting amounts'
                        ) : (
                            <>Scenario {balanceDelta > 0 ? 'B' : 'A'} starts with more</>
                        )}
                    </div>
                </div>

                {/* Spending Delta */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Phase 1 Spending Difference</div>
                    <div className={`text-3xl font-bold mb-1 ${Math.abs(spendingDelta) < 5000 ? 'text-gray-900' :
                            spendingDelta > 0 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                        {spendingDelta > 0 ? '+' : ''}{formatCurrency(spendingDelta)}
                    </div>
                    <div className="text-xs text-gray-500">
                        {Math.abs(spendingDelta) < 5000 ? (
                            'Similar spending plans'
                        ) : (
                            <>Scenario {spendingDelta > 0 ? 'B' : 'A'} spends more</>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}