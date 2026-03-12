// src/components/wizard/Step6TaxSettings.tsx

import { useInputs } from '@/contexts/InputsContext';
import { Info, MapPin } from 'lucide-react';

// States with no income tax
const NO_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];

export function Step6TaxSettings() {
    const { inputs, updateTax, updateSimulation } = useInputs();
    const { tax, simulation, mode, personal } = inputs;

    // Calculate retirement duration
    const retirementDuration = personal.lifeExpectancy - personal.retirementAge;

    // Check if user is in a no-tax state
    const isNoTaxState = NO_TAX_STATES.includes(personal.state);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Tax & Simulation Settings</h2>
                <p className="text-gray-600">Configure tax rates and Monte Carlo simulation parameters</p>
            </div>

            {/* Tax Settings */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-blue-50 to-white">
                <h3 className="font-semibold text-lg mb-3">Tax Settings</h3>
                <div className="max-w-md">
                    <label className="block text-sm font-medium mb-1">
                        Combined Effective Tax Rate
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={(tax.combinedEffectiveRate * 100).toFixed(1)}
                            onChange={(e) =>
                                updateTax({ combinedEffectiveRate: parseFloat(e.target.value) / 100 || 0 })
                            }
                            className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                            step="1"
                            min="0"
                            max="50"
                        />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                    </div>
                </div>

                {/* Guidance by Filing Status */}
                {/* Guidance boxes side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    {/* Filing Status Guidance */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                        <p className="text-sm font-medium text-blue-900 mb-1">Guidance for Single Filers:</p>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>• 10-15% for $30-50k annual income</li>
                            <li>• 15-20% for $50-100k annual income</li>
                            <li>• 20-25% for $100k+ annual income</li>
                        </ul>
                        <p className="text-xs text-blue-700 mt-2 italic">
                            Note: This tool currently supports single filers only.
                        </p>
                    </div>

                    {/* State Tax Guidance */}
                    {isNoTaxState ? (
                        <div className="bg-green-50 border border-green-200 rounded-md p-3">
                            <div className="flex gap-2">
                                <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-green-800">
                                    <p className="font-semibold mb-1"> {personal.state} has no state income tax!</p>
                                    <p>You only pay federal taxes. Consider using a <strong>lower rate (12-15%)</strong> since the default 18% includes state taxes you won't owe.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                            <div className="flex gap-2">
                                <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="font-semibold mb-1"> {personal.state} has state income tax</p>
                                    <p>Add <strong>3-7%</strong> to federal rates for state taxes. Typical total range: <strong>15-22%</strong> depending on your income level.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* General Note */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
                    <div className="flex gap-2">
                        <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                            <strong>Note:</strong> This is a simplified effective tax rate applied to all taxable income.
                            The tool does not calculate actual tax brackets, deductions, or credits.
                        </div>
                    </div>
                </div>
            </div>

            {/* Simulation Settings */}
            <div className="border rounded-lg p-5 bg-gradient-to-r from-green-50 to-white">
                <h3 className="font-semibold text-lg mb-3">Monte Carlo Simulation Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Number of Simulation Runs</label>
                        <select
                            value={simulation.numberOfRuns}
                            onChange={(e) =>
                                updateSimulation({
                                    numberOfRuns: parseInt(e.target.value) as 1000 | 5000 | 10000,
                                })
                            }
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="1000">1,000 runs</option>
                            <option value="5000">5,000 runs</option>
                            <option value="10000">10,000 runs</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">More runs = more accurate results</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">General Inflation Rate</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={(simulation.generalInflationRate * 100).toFixed(1)}
                                onChange={(e) =>
                                    updateSimulation({
                                        generalInflationRate: parseFloat(e.target.value) / 100 || 0,
                                    })
                                }
                                className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                step="0.1"
                                min="0"
                                max="10"
                            />
                            <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Default: 3.0% per year</p>
                    </div>

                    {mode === 'advanced' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Healthcare Inflation Rate
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={(simulation.healthcareInflationRate * 100).toFixed(1)}
                                        onChange={(e) =>
                                            updateSimulation({
                                                healthcareInflationRate: parseFloat(e.target.value) / 100 || 0,
                                            })
                                        }
                                        className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                        step="0.1"
                                        min="0"
                                        max="15"
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Typically higher than general inflation (default: 5%)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Investment Return Standard Deviation
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={(simulation.returnStdDeviation * 100).toFixed(0)}
                                        onChange={(e) =>
                                            updateSimulation({
                                                returnStdDeviation: parseFloat(e.target.value) / 100 || 0,
                                            })
                                        }
                                        className="w-full pr-8 pl-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                        step="1"
                                        min="5"
                                        max="30"
                                    />
                                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Market volatility (default: 18% for stocks)
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-4">
                    <div className="flex gap-2">
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <strong>What is Monte Carlo simulation?</strong> We'll run thousands of simulations
                            with randomized investment returns to show the range of possible outcomes. This helps
                            you understand the probability of your plan succeeding.
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Your Simulation Summary:</h4>
                <div className="text-sm text-gray-700 space-y-1">
                    <p>• Planning for <strong>{retirementDuration} years</strong> of retirement</p>
                    <p>
                        • Running <strong>{simulation.numberOfRuns.toLocaleString()} simulations</strong> 
                    </p>
                    <p>• Applying <strong>{(tax.combinedEffectiveRate * 100).toFixed(1)}% effective tax rate</strong></p>
                    <p>• General inflation: <strong>{(simulation.generalInflationRate * 100).toFixed(1)}%</strong></p>
                    {mode === 'advanced' && (
                        <>
                            <p>
                                • Healthcare inflation: <strong>{(simulation.healthcareInflationRate * 100).toFixed(1)}%</strong>
                            </p>
                            <p>
                                • Return volatility: <strong>{(simulation.returnStdDeviation * 100).toFixed(0)}%</strong>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}