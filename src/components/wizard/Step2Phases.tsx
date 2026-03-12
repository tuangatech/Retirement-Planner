// src/components/wizard/Step2Phases.tsx

import { useInputs } from '@/contexts/InputsContext';
import type { RetirementPhase, OneTimeExpense } from '@/types';
import { Trash2, AlertCircle } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { CollapsibleHelpPanel } from '@/components/common/CollapsibleHelpPanel';
import { HelpPopover } from '@/components/common/HelpPopover';
import { InlineGuidance } from '@/components/common/InlineGuidance';

const MIN_PHASE_SPENDING = 1000;

export function Step2Phases() {
    const { inputs, updatePhases, addOneTimeExpense, removeOneTimeExpense, updateOneTimeExpense } = useInputs();
    const { phases, oneTimeExpenses } = inputs;
    const { retirementAge, lifeExpectancy } = inputs.personal;

    // Track which expense rows have been interacted with (onBlur)
    const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
    // Track the most recently added expense for auto-focus
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    // Ref map for description inputs
    const descRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // Sync phase boundaries whenever personal info changes from Step 1
    useEffect(() => {
        const newPhases = [...phases] as [RetirementPhase, RetirementPhase, RetirementPhase];
        let changed = false;

        if (newPhases[0].startAge !== retirementAge) {
            newPhases[0] = { ...newPhases[0], startAge: retirementAge };
            changed = true;
        }
        if (newPhases[2].endAge !== lifeExpectancy) {
            newPhases[2] = { ...newPhases[2], endAge: lifeExpectancy };
            changed = true;
        }
        if (changed) updatePhases(newPhases);
    }, [retirementAge, lifeExpectancy]);

    // Auto-focus description input when a new expense is added.
    // Depends on both lastAddedId AND oneTimeExpenses so it re-runs after
    // React renders the new row and assigns the ref.
    useEffect(() => {
        if (lastAddedId && descRefs.current[lastAddedId]) {
            descRefs.current[lastAddedId]?.focus();
            setLastAddedId(null);
        }
    }, [lastAddedId, oneTimeExpenses]);

    const handlePhaseChange = (index: number, field: keyof RetirementPhase, value: any) => {
        const newPhases = [...phases] as [RetirementPhase, RetirementPhase, RetirementPhase];
        newPhases[index] = { ...newPhases[index], [field]: value };

        // Cascade derived start ages when an end age changes
        if (field === 'endAge') {
            if (index === 0) newPhases[1] = { ...newPhases[1], startAge: value + 1 };
            if (index === 1) newPhases[2] = { ...newPhases[2], startAge: value + 1 };
        }

        updatePhases(newPhases);
    };

    const handleSpendingChange = (index: number, raw: string) => {
        const parsed = parseInt(raw) || 0;
        handlePhaseChange(index, 'annualSpending', Math.max(MIN_PHASE_SPENDING, parsed));
    };

    const handleExpenseChange = (id: string, field: keyof OneTimeExpense, value: any) => {
        updateOneTimeExpense(id, { [field]: value });
    };

    const handleDescriptionBlur = (id: string) => {
        setDirtyIds(prev => new Set(prev).add(id));
    };

    const handleAddExpense = () => {
        const id = Date.now().toString();
        addOneTimeExpense({ id, description: '', amount: 10000, age: retirementAge });
        setLastAddedId(id);
    };

    const handleRemoveExpense = (id: string) => {
        removeOneTimeExpense(id);
        setDirtyIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    };

    // Only flag rows that have been touched (onBlur fired) and are still empty
    const invalidIds = new Set(
        oneTimeExpenses
            .filter(e => dirtyIds.has(e.id) && !e.description.trim())
            .map(e => e.id)
    );

    const isEndLocked = [false, false, true];

    const phaseLabels = [
        {
            title: 'Go-Go Years',
            subtitle: 'Active Retirement',
            description: 'Travel, hobbies, high activity level',
            typicalAges: 'Typically ages 65-75',
        },
        {
            title: 'Slow-Go Years',
            subtitle: 'Moderate Retirement',
            description: 'Less travel, more home-based activities',
            typicalAges: 'Typically ages 76-85',
        },
        {
            title: 'No-Go Years',
            subtitle: 'Late Retirement',
            description: 'Limited mobility, possible assisted living',
            typicalAges: 'Typically ages 86+',
        },
    ];

    // Dynamic constraints for the two editable end-age inputs
    const endAgeMin = [retirementAge + 1, phases[0].endAge + 2, undefined];
    const endAgeMax = [phases[1].endAge - 1, lifeExpectancy - 1, undefined];

    const startAgeLabels = [
        '(set by retirement age)',
        '(= Phase 1 end + 1)',
        '(= Phase 2 end + 1)',
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold mb-2">Retirement Phases</h2>
                <p className="text-gray-600">Define your spending for each phase of retirement</p>
            </div>

            {/* Educational Panel */}
            <CollapsibleHelpPanel
                title="Understanding the Three Phases of Retirement"
                variant="info"
                defaultOpen={false}
            >
                <div className="space-y-4">
                    <p>
                        Research shows retirement spending typically follows three distinct phases.
                        Understanding these helps create realistic financial projections.
                    </p>

                    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                        <p className="text-sm font-semibold text-yellow-900 mb-1">⚠️ Healthcare costs are entered separately</p>
                        <p className="text-xs text-yellow-800">
                            The spending amounts below cover your <strong>non-healthcare</strong> living expenses
                            (housing, food, travel, hobbies, etc.). Healthcare premiums and out-of-pocket costs
                            are modeled in Step 5 and added on top of these amounts automatically.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="bg-white border border-blue-200 rounded-lg p-3">
                            <h5 className="font-semibold text-blue-900 mb-2">🏃 Go-Go Years</h5>
                            <p className="text-xs text-gray-700 mb-2">
                                Active retirement with travel, hobbies, and social activities.
                                Highest discretionary spending.
                            </p>
                            <p className="text-xs text-blue-700 font-medium">Spending: Often 100-120% of pre-retirement</p>
                        </div>
                        <div className="bg-white border border-blue-200 rounded-lg p-3">
                            <h5 className="font-semibold text-blue-900 mb-2">🚶 Slow-Go Years</h5>
                            <p className="text-xs text-gray-700 mb-2">
                                Reduced activity, less travel, more home-based lifestyle.
                                Moderate spending.
                            </p>
                            <p className="text-xs text-blue-700 font-medium">Spending: Often 80-90% of Go-Go phase</p>
                        </div>
                        <div className="bg-white border border-blue-200 rounded-lg p-3">
                            <h5 className="font-semibold text-blue-900 mb-2">🏠 No-Go Years</h5>
                            <p className="text-xs text-gray-700 mb-2">
                                Limited mobility, possible assisted living.
                            </p>
                            <p className="text-xs text-blue-700 font-medium">Non-healthcare spending: Often lower than Slow-Go</p>
                        </div>
                    </div>

                    <p className="text-xs text-gray-600 italic mt-4">
                        💡 Enter spending in today's dollars — the simulator adjusts for inflation automatically.
                    </p>
                </div>
            </CollapsibleHelpPanel>

            {phases.map((phase, index) => (
                <div key={phase.name} className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">{phaseLabels[index].title}
                                <HelpPopover title={`${phaseLabels[index].title} Guidelines`}>
                                    <p className="mb-2">{phaseLabels[index].description}</p>
                                    <p className="font-medium">Typical expenses to include here:</p>
                                    <ul className="list-disc ml-4 mt-2 space-y-1">
                                        {index === 0 && (<>
                                            <li>Travel and vacations</li>
                                            <li>Hobbies and recreation</li>
                                            <li>Entertainment and dining</li>
                                            <li>Home maintenance projects</li>
                                        </>)}
                                        {index === 1 && (<>
                                            <li>Reduced travel (local trips)</li>
                                            <li>Home-based activities</li>
                                            <li>Family gatherings</li>
                                            <li>Routine household costs</li>
                                        </>)}
                                        {index === 2 && (<>
                                            <li>Basic housing and food costs</li>
                                            <li>Possible assisted living fees (if not modeled elsewhere)</li>
                                            <li>Limited discretionary spending</li>
                                        </>)}
                                    </ul>
                                </HelpPopover>
                            </h3>
                            <p className="text-sm text-gray-600">{phaseLabels[index].subtitle}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {phaseLabels[index].description} • {phaseLabels[index].typicalAges}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Start Age — always derived */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Start Age
                                <span className="ml-2 text-xs text-gray-500 font-normal">
                                    {startAgeLabels[index]}
                                </span>
                            </label>
                            <input
                                type="number"
                                value={phase.startAge}
                                disabled
                                className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        {/* End Age — editable for phases 1-2, locked for phase 3 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                End Age
                                {isEndLocked[index] && (
                                    <span className="ml-2 text-xs text-gray-500 font-normal">(set by life expectancy)</span>
                                )}
                            </label>
                            <input
                                type="number"
                                value={phase.endAge}
                                onChange={(e) => handlePhaseChange(index, 'endAge', parseInt(e.target.value) || 0)}
                                disabled={isEndLocked[index]}
                                min={endAgeMin[index]}
                                max={endAgeMax[index]}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${isEndLocked[index] ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                                    }`}
                            />
                        </div>

                        {/* Annual Spending */}
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Annual Spending (Today's $)
                            </label>
                            <input
                                type="number"
                                value={phase.annualSpending}
                                onChange={(e) => handleSpendingChange(index, e.target.value)}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                                step="1000"
                                min={MIN_PHASE_SPENDING}
                            />
                        </div>
                    </div>

                    <InlineGuidance variant="example">
                        {index === 0 && <><strong>Example 1:</strong> $65,000/year — comfortable living, travel, and hobbies (excludes healthcare)</>}
                        {index === 1 && <><strong>Example 2:</strong> $50,000/year — reduced travel, home-based activities (excludes healthcare)</>}
                        {index === 2 && <><strong>Example 3:</strong> $40,000/year — basic living costs. Healthcare costs (which typically rise in this phase) are added separately from Step 5.</>}
                    </InlineGuidance>
                </div>
            ))}

            {/* One-Time Expenses */}
            <div className="border-t pt-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            One-Time Major Expenses
                            <HelpPopover title="When to Use One-Time Expenses">
                                <p className="mb-2">Use this for large, planned expenses that occur once:</p>
                                <ul className="list-disc ml-4 space-y-1">
                                    <li><strong>Vehicle purchases</strong> (every 5-10 years)</li>
                                    <li><strong>Major trips</strong> (anniversary cruise, family reunion)</li>
                                    <li><strong>Home improvements</strong> (new roof, HVAC replacement)</li>
                                    <li><strong>Medical procedures</strong> (elective surgery)</li>
                                </ul>
                                <p className="mt-3 text-xs text-gray-600">
                                    💡 Don't include: Regular expenses already in phase spending (groceries, utilities, routine healthcare)
                                </p>
                            </HelpPopover>
                        </h3>
                        <p className="text-sm text-gray-600">
                            Add large planned expenses (e.g., new car, travel, home repairs)
                        </p>
                    </div>
                </div>

                {/* Warning banner — only for dirty+empty rows */}
                {invalidIds.size > 0 && (
                    <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg p-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                            <strong>{invalidIds.size} expense{invalidIds.size > 1 ? 's are' : ' is'} missing a description</strong> and will be ignored in the simulation.
                            Please add a description or remove the row.
                        </p>
                    </div>
                )}

                {oneTimeExpenses.length > 0 ? (
                    <div className="space-y-2 mb-4">
                        {oneTimeExpenses.map((expense) => (
                            <div key={expense.id} className={`flex gap-2 items-center p-3 rounded-md ${invalidIds.has(expense.id) ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                                }`}>
                                <input
                                    ref={el => { descRefs.current[expense.id] = el; }}
                                    type="text"
                                    value={expense.description}
                                    onChange={(e) => handleExpenseChange(expense.id, 'description', e.target.value)}
                                    onBlur={() => handleDescriptionBlur(expense.id)}
                                    placeholder="Description (e.g., 3 weeks in Europe, New car)"
                                    className={`flex-1 px-3 py-2 border rounded-md bg-white focus:ring-2 focus:ring-blue-500 ${invalidIds.has(expense.id) ? 'border-amber-400 bg-amber-50' : ''
                                        }`}
                                    maxLength={100}
                                />
                                <div className="relative w-32">
                                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        value={expense.amount}
                                        onChange={(e) => handleExpenseChange(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                                        className="w-full pl-7 pr-3 py-2 border rounded-md bg-white text-right focus:ring-2 focus:ring-blue-500"
                                        step="1000"
                                        min="0"
                                    />
                                </div>
                                <div className="w-24">
                                    <input
                                        type="number"
                                        value={expense.age}
                                        onChange={(e) => handleExpenseChange(expense.id, 'age', parseInt(e.target.value) || retirementAge)}
                                        className="w-full px-3 py-2 border rounded-md bg-white text-center focus:ring-2 focus:ring-blue-500"
                                        min={retirementAge}
                                        max={lifeExpectancy}
                                        placeholder="Age"
                                    />
                                </div>
                                <button
                                    onClick={() => handleRemoveExpense(expense.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="Remove expense"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 mb-4 italic">No one-time expenses added yet</p>
                )}

                <button
                    onClick={handleAddExpense}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                    + Add Expense
                </button>
            </div>
        </div>
    );
}