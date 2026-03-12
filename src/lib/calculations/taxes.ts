// src/lib/calculations/taxes.ts

/**
 * Tax Calculations Module
 * 
 * Implements simplified effective tax rate calculations for retirement planning.
 * 
 * IMPORTANT SIMPLIFICATIONS:
 * - Uses single combined effective rate (not actual tax brackets)
 * - Does not model standard deductions, itemized deductions, or credits
 * - Social Security taxation based on user-specified percentage (not provisional income formula)
 * - Does NOT calculate actual federal/state taxes separately
 * 
 * Key Concepts:
 * - Effective Tax Rate: Average tax rate on all taxable income
 * - Tax Gross-Up: Withdrawing extra to cover taxes on the withdrawal itself
 * - Iterative Convergence: Refining tax calculation until it stabilizes
 */

/**
 * Maximum iterations for tax gross-up convergence.
 * Typically converges in 2-3 iterations.
 */
const MAX_TAX_ITERATIONS = 5;

/**
 * Convergence threshold for tax calculations (in dollars).
 * Stop iterating when change is less than this amount.
 */
const TAX_CONVERGENCE_THRESHOLD = 100;

/**
 * Calculates taxes on fixed income sources.
 * 
 * Fixed income includes:
 * - Social Security (taxable percentage specified by user)
 * - Pensions (fully taxable)
 * - Part-time work (fully taxable, payroll tax already deducted)
 * - Rental income (fully taxable)
 * 
 * @param income - Object with all income sources
 * @param effectiveTaxRate - Combined effective tax rate (0 to 0.5)
 * @param socialSecurityTaxablePercentage - Portion of SS that's taxable (0 to 0.85)
 * @returns Tax on fixed income
 * 
 * @example
 * const income = {
 *   socialSecurity: 30000,
 *   pensions: 24000,
 *   partTimeWork: 20000,
 *   rentalIncome: 12000
 * };
 * calculateTaxOnFixedIncome(income, 0.18, 0.50);
 * // Taxable: (30000 * 0.50) + 24000 + 20000 + 12000 = $71,000
 * // Tax: $71,000 * 0.18 = $12,780
 */
export function calculateTaxOnFixedIncome(
    income: {
        socialSecurity: number;
        pensions: number;
        partTimeWork: number;
        rentalIncome: number;
    },
    effectiveTaxRate: number,
    socialSecurityTaxablePercentage: number
): number {
    // Calculate taxable income
    const taxableSS = income.socialSecurity * socialSecurityTaxablePercentage;
    const taxableIncome =
        taxableSS + income.pensions + income.partTimeWork + income.rentalIncome;

    // Apply effective tax rate
    return taxableIncome * effectiveTaxRate;
}

/**
 * Calculates tax on a withdrawal from a tax-deferred account.
 * 
 * Tax-deferred accounts (Traditional 401k, Traditional IRA):
 * - 100% of withdrawal is taxable
 * - Simple calculation: withdrawal × effective rate
 * 
 * @param withdrawal - Withdrawal amount
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Tax on withdrawal
 * 
 * @example
 * calculateTaxOnTaxDeferredWithdrawal(10000, 0.18);
 * // Returns: $1,800
 */
export function calculateTaxOnTaxDeferredWithdrawal(
    withdrawal: number,
    effectiveTaxRate: number
): number {
    return withdrawal * effectiveTaxRate;
}

/**
 * Calculates tax on a withdrawal from a taxable brokerage account.
 * 
 * Taxable accounts:
 * - Only the GAIN portion is taxed (not the cost basis)
 * - Cost basis = original investment (already taxed)
 * - Gain = withdrawal × (1 - cost basis percentage)
 * 
 * @param withdrawal - Withdrawal amount
 * @param costBasisPercentage - Portion that is cost basis (e.g., 0.70 = 70%)
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Tax on withdrawal
 * 
 * @example
 * calculateTaxOnTaxableWithdrawal(10000, 0.70, 0.18);
 * // Cost basis: $7,000 (not taxed)
 * // Gain: $3,000 (taxed)
 * // Tax: $3,000 * 0.18 = $540
 */
export function calculateTaxOnTaxableWithdrawal(
    withdrawal: number,
    costBasisPercentage: number,
    effectiveTaxRate: number
): number {
    const gainPortion = withdrawal * (1 - costBasisPercentage);
    return gainPortion * effectiveTaxRate;
}

/**
 * Calculates tax on a withdrawal from a Roth account.
 * 
 * Roth accounts (Roth 401k, Roth IRA):
 * - Qualified withdrawals are TAX-FREE
 * - This simplified model assumes all withdrawals are qualified
 * 
 * @param _withdrawal - Withdrawal amount (unused - kept for API consistency)
 * @returns Tax on withdrawal (always 0 for Roth)
 * 
 * @example
 * calculateTaxOnRothWithdrawal(10000);
 * // Returns: $0 (Roth withdrawals are tax-free)
 */
export function calculateTaxOnRothWithdrawal(_withdrawal: number): number {
    return 0;
}

/**
 * Calculates the gross-up factor for tax-deferred withdrawals.
 * 
 * When you need $X after taxes, you must withdraw more than $X because
 * the withdrawal itself is taxable.
 * 
 * Formula: Gross Withdrawal = Net Needed / (1 - Tax Rate)
 * 
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Gross-up multiplier
 * 
 * @example
 * calculateTaxGrossUpFactor(0.18);
 * // Returns: 1.2195 (need to withdraw 21.95% more)
 * // Example: Need $10,000 after tax → withdraw $12,195
 */
export function calculateTaxGrossUpFactor(effectiveTaxRate: number): number {
    return 1 / (1 - effectiveTaxRate);
}

/**
 * Calculates how much to withdraw from a tax-deferred account to net a specific amount.
 * 
 * This is the CRITICAL function for tax gross-up calculations.
 * 
 * @param netAmountNeeded - Amount needed after taxes
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Gross withdrawal amount (before taxes)
 * 
 * @example
 * calculateGrossWithdrawalForNet(10000, 0.18);
 * // Need $10,000 after tax at 18% rate
 * // Withdraw: $10,000 / 0.82 = $12,195.12
 * // Tax: $12,195.12 * 0.18 = $2,195.12
 * // Net: $12,195.12 - $2,195.12 = $10,000 ✓
 */
export function calculateGrossWithdrawalForNet(
    netAmountNeeded: number,
    effectiveTaxRate: number
): number {
    if (netAmountNeeded <= 0) {
        return 0;
    }

    const grossUpFactor = calculateTaxGrossUpFactor(effectiveTaxRate);
    return netAmountNeeded * grossUpFactor;
}

/**
 * Calculates effective tax rate on taxable withdrawals.
 * 
 * For taxable accounts, the effective rate on the withdrawal is lower
 * because only the gain portion is taxed.
 * 
 * @param costBasisPercentage - Portion that is cost basis
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Effective tax rate on the withdrawal
 * 
 * @example
 * calculateEffectiveTaxRateOnTaxable(0.70, 0.18);
 * // Only 30% is taxable gain
 * // Effective rate: 0.18 * 0.30 = 0.054 (5.4%)
 */
export function calculateEffectiveTaxRateOnTaxable(
    costBasisPercentage: number,
    effectiveTaxRate: number
): number {
    return effectiveTaxRate * (1 - costBasisPercentage);
}

/**
 * Iteratively calculates taxes with convergence.
 * 
 * This function handles the circular dependency:
 * - Need to withdraw more to cover taxes
 * - But more withdrawal means more taxes
 * - Which means need to withdraw even more...
 * 
 * Solution: Iterate until the amount stabilizes (converges).
 * 
 * @param initialEstimate - Initial tax estimate
 * @param calculateFn - Function that recalculates taxes given current estimate
 * @returns Converged tax amount
 * 
 * @example
 * // Internal use - called by withdrawal algorithm
 */
export function iterateTaxCalculation(
    initialEstimate: number,
    calculateFn: (currentTaxEstimate: number) => number
): {
    finalTax: number;
    iterations: number;
    converged: boolean;
} {
    let currentTax = initialEstimate;
    let iterations = 0;

    for (iterations = 0; iterations < MAX_TAX_ITERATIONS; iterations++) {
        const newTax = calculateFn(currentTax);

        // Check for convergence
        const change = Math.abs(newTax - currentTax);
        if (change < TAX_CONVERGENCE_THRESHOLD) {
            return {
                finalTax: newTax,
                iterations: iterations + 1,
                converged: true,
            };
        }

        currentTax = newTax;
    }

    // Max iterations reached without convergence
    return {
        finalTax: currentTax,
        iterations,
        converged: false,
    };
}

/**
 * Calculates total taxes for a year including all sources.
 * 
 * This is the main aggregation function for taxes.
 * 
 * @param income - All income sources
 * @param withdrawals - Withdrawals from each account type
 * @param effectiveTaxRate - Combined effective tax rate
 * @param socialSecurityTaxablePercentage - Taxable portion of SS
 * @param costBasisPercentage - Cost basis for taxable account
 * @param payrollTax - Payroll tax from part-time work (already calculated)
 * @returns Object with tax breakdown
 * 
 * @example
 * const taxes = calculateTotalTaxes(
 *   { socialSecurity: 30000, pensions: 24000, partTimeWork: 20000, rentalIncome: 12000 },
 *   { taxDeferred: 15000, roth: 0, taxable: 5000 },
 *   0.18,
 *   0.50,
 *   0.70,
 *   1533
 * );
 */
export function calculateTotalTaxes(
    income: {
        socialSecurity: number;
        pensions: number;
        partTimeWork: number;
        rentalIncome: number;
    },
    withdrawals: {
        taxDeferred: number;
        roth: number;
        taxable: number;
    },
    effectiveTaxRate: number,
    socialSecurityTaxablePercentage: number,
    costBasisPercentage: number,
    payrollTax: number
): {
    onFixedIncome: number;
    onWithdrawals: number;
    payrollTax: number;
    total: number;
    breakdown: {
        socialSecurity: number;
        pensions: number;
        partTimeWork: number;
        rentalIncome: number;
        taxDeferredWithdrawals: number;
        rothWithdrawals: number;
        taxableWithdrawals: number;
    };
} {
    // Tax on fixed income
    const fixedIncomeTax = calculateTaxOnFixedIncome(
        income,
        effectiveTaxRate,
        socialSecurityTaxablePercentage
    );

    // Tax on withdrawals
    const taxDeferredTax = calculateTaxOnTaxDeferredWithdrawal(
        withdrawals.taxDeferred,
        effectiveTaxRate
    );

    const taxableTax = calculateTaxOnTaxableWithdrawal(
        withdrawals.taxable,
        costBasisPercentage,
        effectiveTaxRate
    );

    const rothTax = calculateTaxOnRothWithdrawal(withdrawals.roth);

    const totalWithdrawalTax = taxDeferredTax + taxableTax + rothTax;

    // Detailed breakdown
    const breakdown = {
        socialSecurity:
            income.socialSecurity * socialSecurityTaxablePercentage * effectiveTaxRate,
        pensions: income.pensions * effectiveTaxRate,
        partTimeWork: income.partTimeWork * effectiveTaxRate,
        rentalIncome: income.rentalIncome * effectiveTaxRate,
        taxDeferredWithdrawals: taxDeferredTax,
        rothWithdrawals: rothTax,
        taxableWithdrawals: taxableTax,
    };

    return {
        onFixedIncome: fixedIncomeTax,
        onWithdrawals: totalWithdrawalTax,
        payrollTax,
        total: fixedIncomeTax + totalWithdrawalTax + payrollTax,
        breakdown,
    };
}

/**
 * Validates tax calculation inputs.
 * 
 * @param effectiveTaxRate - Tax rate to validate
 * @param socialSecurityTaxablePercentage - SS taxable % to validate
 * @returns Validation result
 */
export function validateTaxInputs(
    effectiveTaxRate: number,
    socialSecurityTaxablePercentage: number
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (
        !Number.isFinite(effectiveTaxRate) ||
        effectiveTaxRate < 0 ||
        effectiveTaxRate > 0.5
    ) {
        errors.push('Effective tax rate must be between 0% and 50%');
    }

    if (
        !Number.isFinite(socialSecurityTaxablePercentage) ||
        socialSecurityTaxablePercentage < 0 ||
        socialSecurityTaxablePercentage > 0.85
    ) {
        errors.push('Social Security taxable percentage must be between 0% and 85%');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Estimates taxes for planning purposes (before detailed calculation).
 * 
 * This is used for quick estimates when you don't have exact withdrawal amounts yet.
 * 
 * @param grossIncome - Total gross income (before taxes)
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Estimated tax amount
 */
export function estimateTaxes(
    grossIncome: number,
    effectiveTaxRate: number
): number {
    return grossIncome * effectiveTaxRate;
}

/**
 * Calculates after-tax income given gross income and tax rate.
 * 
 * @param grossIncome - Income before taxes
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Income after taxes
 * 
 * @example
 * calculateAfterTaxIncome(100000, 0.18);
 * // Returns: $82,000
 */
export function calculateAfterTaxIncome(
    grossIncome: number,
    effectiveTaxRate: number
): number {
    return grossIncome * (1 - effectiveTaxRate);
}

/**
 * Calculates marginal tax on additional income.
 * 
 * In this simplified model, marginal rate = effective rate
 * (because we don't model actual tax brackets).
 * 
 * @param additionalIncome - Additional income to tax
 * @param effectiveTaxRate - Combined effective tax rate
 * @returns Tax on additional income
 */
export function calculateMarginalTax(
    additionalIncome: number,
    effectiveTaxRate: number
): number {
    return additionalIncome * effectiveTaxRate;
}