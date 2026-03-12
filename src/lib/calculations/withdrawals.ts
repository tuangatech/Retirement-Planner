// src/lib/calculations/withdrawals.ts - PHASE B: Add HSA Support

import { calculateRMD } from './rmd';
import {
    calculateTaxOnTaxDeferredWithdrawal,
    calculateTaxOnTaxableWithdrawal,
    calculateGrossWithdrawalForNet,
    calculateEffectiveTaxRateOnTaxable,
} from './taxes';
import { calculateHSAWithdrawal } from './hsa';

export interface AccountBalances {
    taxDeferred: number;
    roth: number;
    taxable: number;
    hsa: number;
}

export interface WithdrawalAmounts {
    taxDeferred: number;
    roth: number;
    taxable: number;
    hsa: number;
}

export interface IncomeForTax {
    socialSecurity: number;
    pensions: number;
    partTimeWork: number;
    rentalIncome: number;
}

export interface WithdrawalResult {
    withdrawals: WithdrawalAmounts;
    taxOnWithdrawals: number;
    updatedBalances: AccountBalances;
    rmdAmount: number;
    rmdExcess: number;
    hsaForHealthcare: number;  // Amount of healthcare covered by HSA (tax-free)
    iterations: number;
    converged: boolean;
    shortfall: number;
}

/**
 * Executes withdrawals from all accounts including HSA.
 * 
 * WITHDRAWAL ORDER:
 * 1. HSA for healthcare (tax-free, any age)
 * 2. HSA for general expenses (age 65+, taxed)
 * 3. RMDs from tax-deferred (age 73+)
 * 4. Regular accounts by priority order
 * 
 * @param currentAge - Current age
 * @param cashFlowGap - Initial cash needed (expenses + taxes - income)
 * @param currentBalances - Current account balances (includes HSA)
 * @param healthcareCosts - Total healthcare costs for the year
 * @param allowNonMedicalHSA - Whether HSA can be used for non-medical after 65
 * @param priorityOrder - Withdrawal priority for tax-deferred/roth/taxable
 * @param _income - Income sources (for tax calculations)
 * @param effectiveTaxRate - Effective tax rate
 * @param _socialSecurityTaxablePercentage - SS taxable percentage
 * @param costBasisPercentage - Cost basis for taxable account
 */
export function executeWithdrawals(
    currentAge: number,
    cashFlowGap: number,
    currentBalances: AccountBalances,
    healthcareCosts: number,
    allowNonMedicalHSA: boolean,
    priorityOrder: Array<'taxable' | 'tax_deferred' | 'roth'>,
    _income: IncomeForTax,
    effectiveTaxRate: number,
    _socialSecurityTaxablePercentage: number,
    costBasisPercentage: number
): WithdrawalResult {
    const balances = { ...currentBalances };

    const withdrawals: WithdrawalAmounts = {
        taxDeferred: 0,
        roth: 0,
        taxable: 0,
        hsa: 0,
    };

    let taxOnWithdrawals = 0;
    let rmdAmount = 0;
    let rmdExcess = 0;
    let hsaForHealthcare = 0;

    // STEP 0 - Use HSA for healthcare first (ALWAYS, any age)
    if (balances.hsa > 0 && healthcareCosts > 0) {
        // FIX: The generalCashFlowGap passed to calculateHSAWithdrawal must be the
        // NON-HEALTHCARE portion of the cash flow gap only.
        //
        // Bug (previous code): Math.max(0, cashFlowGap) was passed, which is the
        // FULL gap (living expenses + healthcare + taxes − income). At age 65+ with
        // allowNonMedicalHSA=true, calculateHSAWithdrawal would then try to cover
        // the healthcare amount a second time via the nonMedicalWithdrawal path —
        // once via medicalWithdrawal (tax-free) and again inside nonMedicalWithdrawal
        // (taxed), causing the HSA to be over-withdrawn and its balance to drop faster
        // than correct.
        //
        // Fix: subtract healthcareCosts before passing so the non-medical path only
        // covers living expenses and taxes — the portions not already handled by
        // medicalWithdrawal.
        const nonHealthcarGap = Math.max(0, cashFlowGap - healthcareCosts);

        const hsaResult = calculateHSAWithdrawal(
            currentAge,
            balances.hsa,
            healthcareCosts,
            nonHealthcarGap,   // FIX: was Math.max(0, cashFlowGap)
            allowNonMedicalHSA,
            effectiveTaxRate
        );

        withdrawals.hsa = hsaResult.totalWithdrawal;
        hsaForHealthcare = hsaResult.medicalWithdrawal;
        taxOnWithdrawals += hsaResult.taxOnNonMedical;

        // Reduce cash flow gap by net HSA benefit
        const netHSABenefit = hsaResult.medicalWithdrawal +
            (hsaResult.nonMedicalWithdrawal - hsaResult.taxOnNonMedical);
        cashFlowGap -= netHSABenefit;

        // Update HSA balance
        balances.hsa = hsaResult.remainingBalance;
    }

    // STEP 1: Handle RMDs (age >= 73)
    if (currentAge >= 73) {
        rmdAmount = calculateRMD(currentAge, balances.taxDeferred);

        if (rmdAmount > 0) {
            const actualRMD = Math.min(rmdAmount, balances.taxDeferred);
            withdrawals.taxDeferred = actualRMD;

            const taxOnRMD = calculateTaxOnTaxDeferredWithdrawal(actualRMD, effectiveTaxRate);
            const afterTaxRMD = actualRMD - taxOnRMD;

            if (afterTaxRMD >= cashFlowGap) {
                // RMD fully covers need
                rmdExcess = afterTaxRMD - cashFlowGap;
                taxOnWithdrawals += taxOnRMD;

                return {
                    withdrawals,
                    taxOnWithdrawals,
                    updatedBalances: balances,
                    rmdAmount,
                    rmdExcess,
                    hsaForHealthcare,
                    iterations: 1,
                    converged: true,
                    shortfall: 0,
                };
            }

            taxOnWithdrawals += taxOnRMD;
            cashFlowGap -= afterTaxRMD;
        }
    }

    // STEP 2: Simple withdrawal strategy (try each account in priority order)
    let remainingNeed = cashFlowGap;

    for (const accountType of priorityOrder) {
        if (remainingNeed < 10) break;

        const balanceKey = accountType === 'tax_deferred' ? 'taxDeferred' : accountType;
        const available = balances[balanceKey] - (accountType === 'tax_deferred' ? withdrawals.taxDeferred : 0);

        if (available < 10) continue;

        // Calculate gross withdrawal needed (including tax)
        let grossNeeded = 0;

        if (accountType === 'tax_deferred') {
            grossNeeded = calculateGrossWithdrawalForNet(remainingNeed, effectiveTaxRate);
        } else if (accountType === 'taxable') {
            const taxOnGains = calculateEffectiveTaxRateOnTaxable(costBasisPercentage, effectiveTaxRate);
            grossNeeded = calculateGrossWithdrawalForNet(remainingNeed, taxOnGains);
        } else {
            // Roth - no tax
            grossNeeded = remainingNeed;
        }

        // Limit to available balance
        const actualGross = Math.min(grossNeeded, available);

        // Calculate actual tax and net
        let actualTax = 0;
        if (accountType === 'tax_deferred') {
            actualTax = calculateTaxOnTaxDeferredWithdrawal(actualGross, effectiveTaxRate);
        } else if (accountType === 'taxable') {
            actualTax = calculateTaxOnTaxableWithdrawal(actualGross, costBasisPercentage, effectiveTaxRate);
        }

        const actualNet = actualGross - actualTax;

        // Record withdrawal
        if (accountType === 'tax_deferred') {
            withdrawals.taxDeferred += actualGross;
        } else if (accountType === 'roth') {
            withdrawals.roth += actualGross;
        } else {
            withdrawals.taxable += actualGross;
        }

        taxOnWithdrawals += actualTax;
        remainingNeed -= actualNet;
    }

    const totalWithdrawn = withdrawals.taxDeferred + withdrawals.roth + withdrawals.taxable + withdrawals.hsa;
    const afterTaxWithdrawn = totalWithdrawn - taxOnWithdrawals;
    const shortfall = Math.max(0, cashFlowGap - afterTaxWithdrawn);

    return {
        withdrawals,
        taxOnWithdrawals,
        updatedBalances: balances,
        rmdAmount,
        rmdExcess,
        hsaForHealthcare,
        iterations: 1,
        converged: true,
        shortfall,
    };
}

export function handleSurplus(
    surplus: number,
    currentBalances: AccountBalances
): AccountBalances {
    return {
        ...currentBalances,
        taxable: currentBalances.taxable + surplus,
    };
}

export function validateWithdrawalInputs(
    currentAge: number,
    balances: AccountBalances,
    priorityOrder: Array<'taxable' | 'tax_deferred' | 'roth'>
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Number.isFinite(currentAge) || currentAge < 0) {
        errors.push('Invalid age');
    }

    if (balances.taxDeferred < 0 || balances.roth < 0 || balances.taxable < 0 || balances.hsa < 0) {
        errors.push('Account balances cannot be negative');
    }

    if (priorityOrder.length !== 3) {
        errors.push('Priority order must have exactly 3 accounts');
    }

    const uniqueAccounts = new Set(priorityOrder);
    if (uniqueAccounts.size !== 3) {
        errors.push('Priority order must have unique account types');
    }

    const validTypes = new Set(['taxable', 'tax_deferred', 'roth']);
    for (const type of priorityOrder) {
        if (!validTypes.has(type)) {
            errors.push(`Invalid account type: ${type}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

export function calculateTotalPortfolio(balances: AccountBalances): number {
    return balances.taxDeferred + balances.roth + balances.taxable + balances.hsa;  // ✅ UPDATED
}

export function isPortfolioDepleted(
    balances: AccountBalances,
    threshold: number = 100
): boolean {
    return calculateTotalPortfolio(balances) < threshold;
}