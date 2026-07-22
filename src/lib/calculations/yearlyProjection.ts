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

    // Tax-model context shared by the initial and final tax calculations.
    // The standard-deduction floor is scaled by the same inflation that grows
    // income (deductions are inflation-indexed in reality); the SS provisional
    // thresholds inside the tax module stay frozen (the "tax torpedo").
    const filingStatus = personal.filingStatus ?? 'single';
    const deductionInflationFactor = Math.pow(
        1 + simulation.generalInflationRate,
        Math.max(0, currentAge - personal.retirementAge)
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
        income.socialSecurity.taxablePercentage,
        currentAge,
        year,
        deductionInflationFactor,
        filingStatus
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
            accounts.taxable.costBasisPercentage || 0.70,
            // Tax-smart sequencing (fill the deduction floor from tax-deferred first).
            // Default to 'tax_smart' when the field is absent (e.g. older code paths);
            // the storage loader keeps legacy saved scenarios on 'standard'.
            inputs.withdrawalStrategy.strategy ?? 'tax_smart',
            year,
            deductionInflationFactor,
            filingStatus
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

    // HSA: only the non-medical portion (age 65+) is taxable ordinary income;
    // medical withdrawals are always tax-free. Passed to the tax model so it's
    // taxed consistently (and shielded by the deduction floor like other income).
    const hsaNonMedicalWithdrawal = Math.max(
        0,
        withdrawalResult.withdrawals.hsa - withdrawalResult.hsaForHealthcare
    );

    // Calculate final taxes (provisional-income SS + standard-deduction floor).
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
        incomeResult.partTimePayrollTax,
        currentAge,
        year,
        deductionInflationFactor,
        hsaNonMedicalWithdrawal,
        filingStatus
    );

    // Total withdrawals and net cash flow — computed here (before returns) so any
    // surplus can be reinvested and then compounded this year.
    const totalWithdrawals =
        withdrawalResult.withdrawals.taxDeferred +
        withdrawalResult.withdrawals.roth +
        withdrawalResult.withdrawals.taxable +
        withdrawalResult.withdrawals.hsa;

    const netCashFlow =
        incomeResult.totalBeforeWithdrawals +
        totalWithdrawals -
        expensesResult.total -
        finalTaxes.total;

    // Reinvest surplus from the withdrawal branch into the taxable account. This
    // covers both forced-RMD excess and the small over-withdrawal that arises
    // because the withdrawal engine's gross-up ignores the deduction floor. Without
    // this, that cash would leak out and understate the final balance. (The surplus
    // branch above already reinvests via handleSurplus, so only the withdrawal
    // branch needs it here.)
    if (cashFlowGap > 0 && netCashFlow > 0) {
        updatedBalances.taxable += netCashFlow;
    }

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

    // Success means the portfolio funded all spending through life expectancy —
    // i.e., it never hit the depletion threshold (isPortfolioDepleted, < $100).
    // NOTE: do NOT use `finalBalance > 0`. Depleted runs can strand a few dollars
    // (the withdrawal engine ignores balances under $10, and reinvested-surplus
    // pennies compound), which would otherwise miscount a failed run — one that
    // depleted mid-retirement with years of unmet spending — as a "success" and
    // pollute the percentile distribution (the "$9 median" artifact).
    const success = ageOfDepletion === null;

    // Report depleted runs as $0 so failed outcomes don't display stranded pennies.
    const finalBalance = success ? calculateTotalPortfolio(currentBalances) : 0;

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