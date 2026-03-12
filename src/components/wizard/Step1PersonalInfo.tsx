// src/components/wizard/Step1PersonalInfo.tsx

import { useInputs } from '@/contexts/InputsContext';
import { US_STATES } from '@/lib/constants';
import type { USState } from '@/types';

export function Step1PersonalInfo() {
    const { inputs, updatePersonal } = useInputs();
    const { personal } = inputs;

    // Calculate retirement duration for display
    const retirementDuration = personal.lifeExpectancy - personal.retirementAge;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Personal Information</h2>
                <p className="text-gray-600">
                    Tell us about your retirement timeline and location
                </p>
            </div>

            {/* Callout explaining "At Retirement" paradigm */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">How This Tool Works</h3>
                <p className="text-sm text-blue-800">
                    This simulator starts <strong>at your retirement age</strong> and projects forward to your life expectancy.
                    You'll enter what you expect to have saved <strong>when you retire</strong>, not what you have today.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Retirement Age</label>
                    <input
                        type="number"
                        value={personal.retirementAge}
                        onChange={(e) => updatePersonal({ retirementAge: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="50"
                        max="75"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Age when you plan to stop working (50-75)
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Life Expectancy</label>
                    <input
                        type="number"
                        value={personal.lifeExpectancy}
                        onChange={(e) => updatePersonal({ lifeExpectancy: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="70"
                        max="110"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        How long your money needs to last (default: 95)
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">State</label>
                    <select
                        value={personal.state}
                        onChange={(e) => updatePersonal({ state: e.target.value as USState })}
                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {US_STATES.map(state => (
                            <option key={state.value} value={state.value}>
                                {state.label}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        Stored for reference (state taxes not modeled)
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Tax Filing Status</label>
                    <div className="px-3 py-2 bg-gray-50 border rounded-md text-gray-700">
                        Single
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        Single filers only at this time. Joint filing requires modeling combined tax
                        brackets, Social Security survivor benefits, and coordinated account withdrawals.
                    </p>
                </div>
            </div>

            {/* Retirement duration summary */}
            <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-green-900">Retirement Duration</p>
                        <p className="text-xs text-green-700">How long your portfolio needs to last</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-green-900">{retirementDuration}</p>
                        <p className="text-xs text-green-700">years</p>
                    </div>
                </div>
            </div>

            {/* Validation warnings */}
            {personal.lifeExpectancy <= personal.retirementAge && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-sm text-yellow-800">
                        ⚠️ Life expectancy must be greater than retirement age
                    </p>
                </div>
            )}

            {retirementDuration < 10 && personal.lifeExpectancy > personal.retirementAge && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <p className="text-sm text-blue-800">
                        ℹ️ Short retirement duration ({retirementDuration} years). Consider increasing life expectancy for safety margin.
                    </p>
                </div>
            )}
        </div>
    );
}