// src/lib/calculations/yearlyProjection.ts - PHASE B: Add HSA Support

import type { UserInputs } from '@/types';
import { determinePhase, calculateYearlyExpenses } from '@/lib/calculations/expenses';
import { calculateYearlyIncome } from '@/lib/calculations/income';
import { calculateTotalTaxes, calculateTaxOnFixedIncome } from '@/lib/calculations/taxes';
import {
    executeWithdrawals,
    handleSurplus,
    calculateTotalPortfolio,
    isPortfolioDepleted,
    type AccountBalances,
} from '@/lib/calculations/withdrawals';
import { generateAccountReturns } from '@/lib/calculations/random';

export interface YearlyProjection {
    age: number;
    year: number;
    phase: 'working' | 'go_go' | 'slow_go' | 'no_go';

    income: {
        socialSecurity: number;
        socialSecurityFull: number;
        socialSecurityReduction: number;
        pensions: number;
        partTimeWork: number;
        rentalIncome: number;
        totalBeforeWithdrawals: number;
    };

    expenses: {
        living: number;
        healthcarePremiums: number;
        healthcareOutOfPocket: number;
        oneTimeExpenses: number;
        total: number;
    };

    taxes: {
        onFixedIncome: number;
        onWithdrawals: number;
        payrollTax: number;
        total: number;
    };

    portfolio: {
        contributions: number;
        withdrawals: {
            taxDeferred: number;
            roth: number;
            taxable: number;
            hsa: number;  // ✅ NEW
            total: number;
        };
        rmdAmount: number;
        rmdExcess: number;
        hsaForHealthcare: number;  // ✅ NEW: Tax-free healthcare coverage
        investmentReturns: {
            taxDeferred: number;
            roth: number;
            taxable: number;
            hsa: number;  // ✅ NEW
            total: number;
        };
        balances: AccountBalances & { total: number };
    };

    netCashFlow: number;
    shortfall: number;
    portfolioDepleted: boolean;
}

export function calculateYearlyProjection(
    currentAge: number,
    year: number,
    currentBalances: AccountBalances,
    inputs: UserInputs,
    rng: () => number
): YearlyProjection {
    const { personal, phases, accounts, income, healthcare, tax, simulation } = inputs;

    // STEP 1: Determine phase
    const phase = determinePhase(currentAge, phases);

    // STEP 2: Calculate income
    const incomeResult = calculateYearlyIncome(
        currentAge,
        income.socialSecurity,
        income.pensions,
        income.partTimeWork,
        income.rentalIncome,
        simulation.generalInflationRate
    );

    // STEP 3: Calculate expenses
    const expensesResult = calculateYearlyExpenses(
        currentAge,
        personal.retirementAge,
        phases,
        inputs.oneTimeExpenses,
        healthcare.preMedicare,
        healthcare.medicare,
        simulation.generalInflationRate,
        simulation.healthcareInflationRate
    );

    // STEP 4: Calculate initial taxes on fixed income
    const initialTaxOnIncome = calculateTaxOnFixedIncome(
        {
            socialSecurity: incomeResult.socialSecurity,
            pensions: incomeResult.pensions,
            partTimeWork: incomeResult.partTimeWork,
            rentalIncome: incomeResult.rentalIncome,
        },
        tax.combinedEffectiveRate,
        income.socialSecurity.taxablePercentage
    );

    // STEP 5: Determine cash flow gap
    const totalFixedIncome = incomeResult.totalBeforeWithdrawals;
    const totalExpenses = expensesResult.total;
    const initialTotalTax = initialTaxOnIncome + incomeResult.partTimePayrollTax;
    const cashFlowGap = totalExpenses + initialTotalTax - totalFixedIncome;

    // Initialize withdrawal and portfolio tracking
    let withdrawalResult;
    let updatedBalances = { ...currentBalances };
    let portfolioIsDepleted = false;

    // ✅ UPDATED: STEP 6 - Execute withdrawals (HSA-aware)
    if (cashFlowGap > 0) {
        withdrawalResult = executeWithdrawals(
            currentAge,
            cashFlowGap,
            currentBalances,
            expensesResult.healthcarePremiums + expensesResult.healthcareOutOfPocket,  // ✅ NEW: Total healthcare
            accounts.hsa.allowNonMedicalAfter65,  // ✅ NEW: HSA policy
            inputs.withdrawalStrategy.priorityOrder,
            {
                socialSecurity: incomeResult.socialSecurity,
                pensions: incomeResult.pensions,
                partTimeWork: incomeResult.partTimeWork,
                rentalIncome: incomeResult.rentalIncome,
            },
            tax.combinedEffectiveRate,
            income.socialSecurity.taxablePercentage,
            accounts.taxable.costBasisPercentage || 0.70
        );

        // Deduct withdrawals from current balances
        updatedBalances.taxDeferred = currentBalances.taxDeferred - withdrawalResult.withdrawals.taxDeferred;
        updatedBalances.roth = currentBalances.roth - withdrawalResult.withdrawals.roth;
        updatedBalances.taxable = currentBalances.taxable - withdrawalResult.withdrawals.taxable;
        updatedBalances.hsa = currentBalances.hsa - withdrawalResult.withdrawals.hsa;  // ✅ NEW

        portfolioIsDepleted = isPortfolioDepleted(updatedBalances);
    } else {
        // Surplus case: income > expenses
        const surplus = Math.abs(cashFlowGap);
        updatedBalances = handleSurplus(surplus, currentBalances);

        withdrawalResult = {
            withdrawals: { taxDeferred: 0, roth: 0, taxable: 0, hsa: 0 },  // ✅ UPDATED
            taxOnWithdrawals: 0,
            updatedBalances,
            rmdAmount: 0,
            rmdExcess: surplus,
            hsaForHealthcare: 0,  // ✅ NEW
            iterations: 1,
            converged: true,
            shortfall: 0,
        };
    }

    // Calculate final taxes
    const finalTaxes = calculateTotalTaxes(
        {
            socialSecurity: incomeResult.socialSecurity,
            pensions: incomeResult.pensions,
            partTimeWork: incomeResult.partTimeWork,
            rentalIncome: incomeResult.rentalIncome,
        },
        withdrawalResult.withdrawals,
        tax.combinedEffectiveRate,
        income.socialSecurity.taxablePercentage,
        accounts.taxable.costBasisPercentage || 0.70,
        incomeResult.partTimePayrollTax
    );

    // ✅ UPDATED: STEP 7 - Apply investment returns (including HSA)
    const returns = generateAccountReturns(
        {
            taxDeferred: accounts.taxDeferred.expectedReturnRate,
            roth: accounts.roth.expectedReturnRate,
            taxable: accounts.taxable.expectedReturnRate,
            hsa: accounts.hsa.expectedReturnRate,  // ✅ NEW
        },
        simulation.returnStdDeviation,
        rng
    );

    // Calculate dollar returns
    const investmentReturns = {
        taxDeferred: updatedBalances.taxDeferred * returns.taxDeferred,
        roth: updatedBalances.roth * returns.roth,
        taxable: updatedBalances.taxable * returns.taxable,
        hsa: updatedBalances.hsa * returns.hsa,  // ✅ NEW
        total: 0,
    };
    investmentReturns.total =
        investmentReturns.taxDeferred +
        investmentReturns.roth +
        investmentReturns.taxable +
        investmentReturns.hsa;  // ✅ UPDATED

    // Apply returns to balances
    updatedBalances.taxDeferred += investmentReturns.taxDeferred;
    updatedBalances.roth += investmentReturns.roth;
    updatedBalances.taxable += investmentReturns.taxable;
    updatedBalances.hsa += investmentReturns.hsa;  // ✅ NEW

    const totalContributions = 0;

    // Ensure balances don't go negative
    updatedBalances.taxDeferred = Math.max(0, updatedBalances.taxDeferred);
    updatedBalances.roth = Math.max(0, updatedBalances.roth);
    updatedBalances.taxable = Math.max(0, updatedBalances.taxable);
    updatedBalances.hsa = Math.max(0, updatedBalances.hsa);  // ✅ NEW

    // Calculate net cash flow
    const totalWithdrawals =
        withdrawalResult.withdrawals.taxDeferred +
        withdrawalResult.withdrawals.roth +
        withdrawalResult.withdrawals.taxable +
        withdrawalResult.withdrawals.hsa;  // ✅ UPDATED

    const netCashFlow =
        incomeResult.totalBeforeWithdrawals +
        totalWithdrawals -
        expensesResult.total -
        finalTaxes.total;

    // STEP 8: Assemble complete projection
    return {
        age: currentAge,
        year,
        phase,

        income: {
            socialSecurity: incomeResult.socialSecurity,
            socialSecurityFull: incomeResult.socialSecurityFull,
            socialSecurityReduction: incomeResult.socialSecurityReduction,
            pensions: incomeResult.pensions,
            partTimeWork: incomeResult.partTimeWork,
            rentalIncome: incomeResult.rentalIncome,
            totalBeforeWithdrawals: incomeResult.totalBeforeWithdrawals,
        },

        expenses: {
            living: expensesResult.living,
            healthcarePremiums: expensesResult.healthcarePremiums,
            healthcareOutOfPocket: expensesResult.healthcareOutOfPocket,
            oneTimeExpenses: expensesResult.oneTimeExpenses,
            total: expensesResult.total,
        },

        taxes: {
            onFixedIncome: finalTaxes.onFixedIncome,
            onWithdrawals: finalTaxes.onWithdrawals,
            payrollTax: finalTaxes.payrollTax,
            total: finalTaxes.total,
        },

        portfolio: {
            contributions: totalContributions,
            withdrawals: {
                taxDeferred: withdrawalResult.withdrawals.taxDeferred,
                roth: withdrawalResult.withdrawals.roth,
                taxable: withdrawalResult.withdrawals.taxable,
                hsa: withdrawalResult.withdrawals.hsa,  // ✅ NEW
                total: totalWithdrawals,
            },
            rmdAmount: withdrawalResult.rmdAmount,
            rmdExcess: withdrawalResult.rmdExcess,
            hsaForHealthcare: withdrawalResult.hsaForHealthcare,  // ✅ NEW
            investmentReturns,
            balances: {
                taxDeferred: updatedBalances.taxDeferred,
                roth: updatedBalances.roth,
                taxable: updatedBalances.taxable,
                hsa: updatedBalances.hsa,  // ✅ NEW
                total: calculateTotalPortfolio(updatedBalances),
            },
        },

        netCashFlow,
        shortfall: withdrawalResult.shortfall,
        portfolioDepleted: portfolioIsDepleted,
    };
}

/**
 * ✅ UPDATED: Runs ONLY from retirement age to life expectancy (with HSA)
 */
export function runCompleteSimulation(
    inputs: UserInputs,
    rng: () => number
): {
    success: boolean;
    ageOfDepletion: number | null;
    finalBalance: number;
    projections: YearlyProjection[];
} {
    const { personal, accounts } = inputs;
    const projections: YearlyProjection[] = [];

    // ✅ UPDATED: Initialize balances including HSA
    let currentBalances: AccountBalances = {
        taxDeferred: accounts.taxDeferred.balanceAtRetirement,
        roth: accounts.roth.balanceAtRetirement,
        taxable: accounts.taxable.balanceAtRetirement,
        hsa: accounts.hsa.balanceAtRetirement,  // ✅ NEW
    };

    let ageOfDepletion: number | null = null;

    // Simulate ONLY retirement years
    for (let age = personal.retirementAge; age <= personal.lifeExpectancy; age++) {
        const year = 2026 + (age - personal.retirementAge);

        const projection = calculateYearlyProjection(
            age,
            year,
            currentBalances,
            inputs,
            rng
        );

        projections.push(projection);

        // Update balances for next year
        currentBalances = {
            taxDeferred: projection.portfolio.balances.taxDeferred,
            roth: projection.portfolio.balances.roth,
            taxable: projection.portfolio.balances.taxable,
            hsa: projection.portfolio.balances.hsa,  // ✅ NEW
        };

        // Check for portfolio depletion
        if (projection.portfolioDepleted && ageOfDepletion === null) {
            ageOfDepletion = age;
        }
    }

    const finalBalance = calculateTotalPortfolio(currentBalances);
    const success = finalBalance > 0;

    return {
        success,
        ageOfDepletion,
        finalBalance,
        projections,
    };
}

export function validateProjectionInputs(
    currentAge: number,
    currentBalances: AccountBalances,
    inputs: UserInputs
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Number.isFinite(currentAge) || currentAge < 0) {
        errors.push('Invalid current age');
    }

    if (currentAge < inputs.personal.retirementAge) {
        errors.push('Current age cannot be less than retirement age');
    }

    if (currentAge > inputs.personal.lifeExpectancy) {
        errors.push('Current age cannot exceed life expectancy');
    }

    if (currentBalances.taxDeferred < 0 || currentBalances.roth < 0 ||
        currentBalances.taxable < 0 || currentBalances.hsa < 0) {  // ✅ UPDATED
        errors.push('Account balances cannot be negative');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

export function calculateProjectionSummary(projections: YearlyProjection[]): {
    totalIncome: number;
    totalExpenses: number;
    totalTaxes: number;
    totalWithdrawals: number;
    totalContributions: number;
    peakBalance: number;
    finalBalance: number;
} {
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalTaxes = 0;
    let totalWithdrawals = 0;
    let totalContributions = 0;
    let peakBalance = 0;

    for (const projection of projections) {
        totalIncome += projection.income.totalBeforeWithdrawals;
        totalExpenses += projection.expenses.total;
        totalTaxes += projection.taxes.total;
        totalWithdrawals += projection.portfolio.withdrawals.total;
        totalContributions += projection.portfolio.contributions;

        if (projection.portfolio.balances.total > peakBalance) {
            peakBalance = projection.portfolio.balances.total;
        }
    }

    const finalBalance = projections[projections.length - 1]?.portfolio.balances.total || 0;

    return {
        totalIncome,
        totalExpenses,
        totalTaxes,
        totalWithdrawals,
        totalContributions,
        peakBalance,
        finalBalance,
    };
}