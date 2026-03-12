// src/components/wizard/Step3Accounts.tsx

import { useInputs } from '@/contexts/InputsContext';
import { HelpCircle } from 'lucide-react';
import { HelpPopover } from '@/components/common/HelpPopover';

export function Step3Accounts() {
    const { inputs, updateAccount, updateHSA } = useInputs();
    const { accounts, mode } = inputs;

    const accountTypes = [
        {
            key: 'taxDeferred' as const,
            label: 'Tax-Deferred Accounts',
            subtitle: 'Traditional 401(k), 403(b), Traditional IRA',
            color: 'from-blue-50 to-white',
            helpTitle: 'Tax-Deferred Accounts',
            helpContent: (
                <>
                    <p className="mb-2">Contributions reduce taxable income now; all withdrawals are taxed as ordinary income in retirement.</p>
                    <p className="font-medium mb-1">Key rules:</p>
                    <ul className="list-disc ml-4 space-y-1 text-sm">
                        <li>All withdrawals taxed at your effective rate</li>
                        <li>RMDs required starting at age 73</li>
                        <li>10% penalty for withdrawals before age 59½</li>
                    </ul>
                    <p className="mt-2 text-xs text-gray-600">💡 The largest account type for most retirees</p>
                </>
            ),
        },
        {
            key: 'roth' as const,
            label: 'Roth Accounts',
            subtitle: 'Roth 401(k), Roth IRA',
            color: 'from-green-50 to-white',
            helpTitle: 'Roth Accounts',
            helpContent: (
                <>
                    <p className="mb-2">Contributions made with after-tax dollars; qualified withdrawals are completely tax-free.</p>
                    <p className="font-medium mb-1">Key rules:</p>
                    <ul className="list-disc ml-4 space-y-1 text-sm">
                        <li>Withdrawals are tax-free in retirement</li>
                        <li>No RMDs required during your lifetime</li>
                        <li>Contributions (not gains) can be withdrawn anytime</li>
                    </ul>
                    <p className="mt-2 text-xs text-gray-600">💡 Valuable for tax diversification — withdraw tax-free when rates are high</p>
                </>
            ),
        },
        {
            key: 'taxable' as const,
            label: 'Taxable Brokerage Accounts',
            subtitle: 'Regular investment accounts',
            color: 'from-purple-50 to-white',
            helpTitle: 'Taxable Brokerage Accounts',
            helpContent: (
                <>
                    <p className="mb-2">Regular investment accounts with no special tax treatment, but maximum flexibility.</p>
                    <p className="font-medium mb-1">Key rules:</p>
                    <ul className="list-disc ml-4 space-y-1 text-sm">
                        <li>Only the gain portion is taxed on withdrawal (not cost basis)</li>
                        <li>No contribution limits or withdrawal restrictions</li>
                        <li>No age penalties — accessible anytime</li>
                    </ul>
                    <p className="mt-2 text-xs text-gray-600">💡 Most flexible account type, especially useful for early retirees before 59½</p>
                </>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Investment Accounts at Retirement</h2>
                <p className="text-gray-600">
                    Enter the projected balance in each account <strong>when you retire</strong>
                </p>
            </div>

            {/* Explanation Panel */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">💡 Important: "At Retirement" Balances</h3>
                <div className="text-sm text-blue-800 space-y-2">
                    <p>
                        Enter what you expect to have <strong>saved by retirement age</strong>, not what you have today.
                    </p>
                    <p className="text-xs">
                        <strong>Example:</strong> If you're 40 with $100K in your 401(k) and retire at 60,
                        estimate what that $100K will grow to over 20 years of contributions and returns.
                    </p>
                </div>
            </div>

            {/* Traditional 3 Accounts */}
            {accountTypes.map(({ key, label, subtitle, color, helpTitle, helpContent }) => (
                <div key={key} className={`border rounded-lg p-5 bg-gradient-to-r ${color}`}>
                    <div className="mb-4">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            {label}
                            <HelpPopover title={helpTitle}>
                                {helpContent}
                            </HelpPopover>
                        </h3>
                        <p className="text-sm text-gray-600">{subtitle}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Balance at Retirement
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-gray-500">$</span>
                                <input
                                    type="number"
                                    value={accounts[key].balanceAtRetirement}
                                    onChange={(e) =>
                                        updateAccount(key, { balanceAtRetirement: parseFloat(e.target.value) || 0 })
                                    }
                                    className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                    step="1000"
                                    min="0"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Projected balance when you retire
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Expected Annual Return Rate
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={(accounts[key].expectedReturnRate * 100).toFixed(1)}
                                    onChange={(e) =>
                                        updateAccount(key, { expectedReturnRate: parseFloat(e.target.value) / 100 || 0 })
                                    }
                                    className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                    step="0.1"
                                    min="-5"
                                    max="20"
                                />
                                <span className="absolute right-3 top-2 text-gray-500">%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Expected return during retirement (stocks ~8%, bonds ~4%)
                            </p>
                        </div>

                        {/* Cost basis for taxable accounts (Advanced mode) */}
                        {key === 'taxable' && mode === 'advanced' && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium mb-1">
                                    Cost Basis Percentage
                                </label>
                                <div className="relative max-w-xs">
                                    <input
                                        type="number"
                                        value={((accounts[key].costBasisPercentage || 0.7) * 100).toFixed(0)}
                                        onChange={(e) =>
                                            updateAccount(key, {
                                                costBasisPercentage: parseFloat(e.target.value) / 100 || 0.7,
                                            })
                                        }
                                        className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                        step="5"
                                        min="0"
                                        max="100"
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Portion that is original investment (not gains). Default: 70%
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* HSA Account */}
            <div className="border-2 border-teal-300 rounded-lg p-5 bg-gradient-to-r from-teal-50 to-white">
                <div className="mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        Health Savings Account (HSA)
                        <span className="text-xs font-normal bg-teal-100 text-teal-800 px-2 py-0.5 rounded">Special</span>
                        <HelpPopover title="Health Savings Account (HSA)">
                            <p className="mb-2">Triple tax-advantaged account — the most tax-efficient way to pay for healthcare.</p>
                            <ul className="list-disc ml-4 space-y-1 text-sm">
                                <li>Money goes in pre-tax, reducing your taxable income</li>
                                <li>Money grows tax-free over time</li>
                                <li>Money can be withdrawn tax-free for qualified healthcare expenses</li>
                            </ul>
                            <p className="mt-2 text-xs text-gray-600">💡 Simulator uses HSA just for healthcare (tax-free)</p>
                        </HelpPopover>
                    </h3>
                    <p className="text-sm text-gray-600">Tax-advantaged account for healthcare expenses</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Balance at Retirement
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                                type="number"
                                value={accounts.hsa.balanceAtRetirement}
                                onChange={(e) =>
                                    updateHSA({ balanceAtRetirement: parseFloat(e.target.value) || 0 })
                                }
                                className="w-full pl-7 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-teal-500"
                                step="1000"
                                min="0"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Projected HSA balance when you retire
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Expected Annual Return Rate
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={(accounts.hsa.expectedReturnRate * 100).toFixed(1)}
                                onChange={(e) =>
                                    updateHSA({ expectedReturnRate: parseFloat(e.target.value) / 100 || 0 })
                                }
                                className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-teal-500"
                                step="0.1"
                                min="-5"
                                max="20"
                            />
                            <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Conservative growth (typically 5-7%)
                        </p>
                    </div>

                    {mode === 'advanced' && (
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={accounts.hsa.allowNonMedicalAfter65}
                                    onChange={(e) =>
                                        updateHSA({ allowNonMedicalAfter65: e.target.checked })
                                    }
                                    className="w-4 h-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                />
                                <span className="text-sm font-medium">
                                    Allow general withdrawals after age 65 (taxed as ordinary income)
                                </span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1 ml-6">
                                Unchecking means HSA will only be used for healthcare expenses, even after 65.
                                Most people leave this checked (default behavior).
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-4 bg-teal-50 border border-teal-200 rounded-lg p-3">
                    <p className="text-sm text-teal-900 font-semibold mb-2">
                        🏥 How HSA Works in This Simulator:
                    </p>
                    <div className="text-xs text-teal-800 space-y-2">
                        <p>
                            <strong>Tax-Free Healthcare:</strong> Your HSA automatically pays for all healthcare expenses tax-free (premiums + out-of-pocket costs). This protects your other retirement accounts from being depleted by medical expenses.
                        </p>
                        <p>
                            <strong>Why This Matters:</strong> A $70K HSA can cover ~$10K/year healthcare × 7 years = no withdrawals needed from your taxed accounts for healthcare during your Go-Go years.
                        </p>
                        <p className="pt-1 border-t border-teal-300">
                            💡 Every $1 in HSA = $1 of healthcare coverage. Every $1 withdrawn from Tax-Deferred = only $0.82 after taxes (at 18% rate). HSA is 22% more efficient for healthcare.
                        </p>
                    </div>
                </div>
            </div>

            {/* Blended rate help */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    Help: Blended Return Rates
                </h4>
                <p className="text-sm text-gray-700">
                    If you hold both stocks and bonds in an account, calculate a blended rate.
                    <br />
                    <strong>Example:</strong> 60% stocks (8% return) + 40% bonds (4% return) = 6.4% blended rate
                </p>
            </div>

            {/* Total portfolio summary */}
            <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-green-900">Total Starting Portfolio</p>
                        <p className="text-xs text-green-700">Combined balance at retirement (all accounts)</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-green-900">
                            ${((accounts.taxDeferred.balanceAtRetirement +
                                accounts.roth.balanceAtRetirement +
                                accounts.taxable.balanceAtRetirement +
                                accounts.hsa.balanceAtRetirement) / 1000).toFixed(0)}K
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                            Including ${(accounts.hsa.balanceAtRetirement / 1000).toFixed(0)}K in HSA
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}