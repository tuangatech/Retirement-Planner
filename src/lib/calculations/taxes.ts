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
 * Simplified U.S. tax-rule constants used by the effective-rate model.
 *
 * Figures approximate 2025 federal law and should be reviewed annually. Kept in
 * this module (rather than constants.ts) to avoid a circular import
 * (constants.ts → types → yearlyProjection → taxes).
 *
 * NOT modeled: the OBBBA senior-bonus MAGI phase-out (above $150k MFJ / $75k
 * single — negligible for this tool's typical users), itemized deductions,
 * credits, and the 0%/15%/20% long-term capital-gains brackets.
 */
export const TAX_RULES = {
    // Base standard deduction by filing status — 2026 (IRS Rev. Proc. 2025-32).
    standardDeduction: { single: 16100, married_joint: 32200 },
    // Additional standard deduction per filer/spouse age 65+ — 2026.
    additionalStandardDeduction65: { single: 2050, married_joint: 1650 },
    // OBBBA "senior bonus" deduction: $6,000 per person age 65+, tax years 2025–2028.
    seniorBonusDeduction: 6000,
    seniorBonusLastYear: 2028,
    // Social Security provisional-income thresholds (IRC §86). NOT inflation-indexed
    // (frozen since 1993) — this is what drives the "tax torpedo" over time.
    ssProvisionalThresholds: {
        single: { base: 25000, second: 34000 },
        married_joint: { base: 32000, second: 44000 },
    },
    // Statutory maximum share of SS benefits that can be federally taxable.
    ssMaxTaxableFraction: 0.85,
} as const;

export type FilingStatus = 'single' | 'married_joint';

/**
 * Calculates the federally taxable portion of Social Security via the IRS
 * provisional-income formula (IRC §86 / Pub. 915), rather than a fixed percentage.
 *
 * Provisional income = other AGI items (excluding SS) + ½ of SS benefits.
 * The result is capped at `maxTaxableFraction` (default 85%, the statutory max;
 * a user may lower it to approximate a state SS exemption).
 *
 * @example
 * // $43,200 SS, $19,200 other income, single
 * calculateTaxableSocialSecurity(43200, 19200, 'single');
 * // provisional = 19200 + 21600 = 40800; above $34k → tier-2 formula
 */
export function calculateTaxableSocialSecurity(
    ssBenefit: number,
    otherTaxableIncome: number,
    filingStatus: FilingStatus = 'single',
    maxTaxableFraction: number = TAX_RULES.ssMaxTaxableFraction
): number {
    if (ssBenefit <= 0) return 0;

    const { base, second } = TAX_RULES.ssProvisionalThresholds[filingStatus];
    const provisional = otherTaxableIncome + 0.5 * ssBenefit;

    let taxable: number;
    if (provisional <= base) {
        taxable = 0;
    } else if (provisional <= second) {
        taxable = Math.min(0.5 * ssBenefit, 0.5 * (provisional - base));
    } else {
        const tier1 = Math.min(0.5 * ssBenefit, 0.5 * (second - base));
        taxable = Math.min(0.85 * ssBenefit, 0.85 * (provisional - second) + tier1);
    }

    return Math.min(taxable, maxTaxableFraction * ssBenefit);
}

/**
 * Computes the total standard deduction "tax-free floor" for the year.
 *
 * Includes the base standard deduction, the age-65+ addition, and (for tax years
 * through 2028) the OBBBA senior bonus. The base + age-65 portion is scaled by
 * `inflationFactor` so it keeps pace with the simulation's inflated income; the
 * temporary senior bonus is applied flat.
 *
 * Single-filer assumption: one "senior" once age ≥ 65. (MFJ spouse ages are not
 * modeled — that's the Full-tier feature.)
 */
export function calculateStandardDeduction(
    currentAge: number,
    year: number,
    filingStatus: FilingStatus = 'single',
    inflationFactor: number = 1,
    includeSeniorBonus: boolean = true
): number {
    const seniors = currentAge >= 65 ? 1 : 0;

    let deduction =
        TAX_RULES.standardDeduction[filingStatus] +
        TAX_RULES.additionalStandardDeduction65[filingStatus] * seniors;

    deduction *= inflationFactor;

    if (includeSeniorBonus && seniors > 0 && year <= TAX_RULES.seniorBonusLastYear) {
        deduction += TAX_RULES.seniorBonusDeduction * seniors;
    }

    return deduction;
}

/**
 * Tax-smart sequencing helper: how much can be pulled from a tax-deferred account
 * this year while keeping total taxable income at or below the standard-deduction
 * floor (i.e. an approximately tax-free draw).
 *
 * This is NOT simply `deduction − otherTaxable`: each extra dollar of tax-deferred
 * income raises provisional income, which can drag up to $0.85 of Social Security
 * into the taxable base (the "tax torpedo"). So the total taxable income as a
 * function of the draw `x` is
 *
 *     total(x) = taxableSS(otherOrdinary + x) + otherOrdinary + x
 *
 * which is monotonically increasing in `x`. We bisect for the largest `x` with
 * `total(x) ≤ deduction`. The caller still caps the result by the spending need and
 * the available balance.
 *
 * @param ssBenefit - Social Security benefit for the year
 * @param otherOrdinaryTaxable - non-SS taxable income already present (pensions,
 *   part-time, rental, brokerage gains, and any RMD already withdrawn)
 * @param ssTaxablePctCap - user cap on the taxable share of SS (≤ statutory 85%)
 * @returns the tax-free tax-deferred draw (0 if the floor is already used up)
 */
export function calculateTaxFreeTaxDeferredRoom(
    ssBenefit: number,
    otherOrdinaryTaxable: number,
    ssTaxablePctCap: number,
    currentAge: number,
    year: number,
    deductionInflationFactor: number = 1,
    filingStatus: FilingStatus = 'single',
    includeSeniorBonus: boolean = true
): number {
    const deduction = calculateStandardDeduction(
        currentAge,
        year,
        filingStatus,
        deductionInflationFactor,
        includeSeniorBonus
    );

    const totalTaxableAt = (x: number): number =>
        calculateTaxableSocialSecurity(ssBenefit, otherOrdinaryTaxable + x, filingStatus, ssTaxablePctCap) +
        otherOrdinaryTaxable +
        x;

    // Already at/above the floor before any discretionary draw → no tax-free room.
    if (totalTaxableAt(0) >= deduction) return 0;

    // Bisect for the draw that lifts taxable income up to (not over) the floor.
    // Upper bound: x = deduction always overshoots since total(x) ≥ x.
    let lo = 0;
    let hi = deduction;
    for (let i = 0; i < 40 && hi - lo > 1; i++) {
        const mid = (lo + hi) / 2;
        if (totalTaxableAt(mid) <= deduction) {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    return lo;
}

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
    socialSecurityTaxablePercentage: number,
    currentAge: number,
    year: number,
    deductionInflationFactor: number = 1,
    filingStatus: FilingStatus = 'single',
    includeSeniorBonus: boolean = true
): number {
    // Taxable Social Security via the provisional-income formula (other fixed income
    // only — withdrawals are added in the final calculation). The user-specified
    // percentage acts as a cap on the statutory 85% maximum.
    const otherIncome = income.pensions + income.partTimeWork + income.rentalIncome;
    const taxableSS = calculateTaxableSocialSecurity(
        income.socialSecurity,
        otherIncome,
        filingStatus,
        socialSecurityTaxablePercentage
    );

    const taxableIncome = taxableSS + otherIncome;

    // Subtract the standard-deduction floor before applying the rate.
    const deduction = calculateStandardDeduction(
        currentAge,
        year,
        filingStatus,
        deductionInflationFactor,
        includeSeniorBonus
    );

    return Math.max(0, taxableIncome - deduction) * effectiveTaxRate;
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
    payrollTax: number,
    currentAge: number,
    year: number,
    deductionInflationFactor: number = 1,
    /**
     * Non-medical portion of HSA withdrawals (age 65+). Taxed as ordinary income;
     * medical HSA withdrawals are tax-free and excluded. Defaults to 0.
     */
    hsaNonMedicalWithdrawal: number = 0,
    filingStatus: FilingStatus = 'single',
    includeSeniorBonus: boolean = true
): {
    onFixedIncome: number;
    onWithdrawals: number;
    payrollTax: number;
    total: number;
} {
    // Only the GAIN portion of a brokerage withdrawal is income; cost basis is not.
    const brokerageGain = withdrawals.taxable * (1 - costBasisPercentage);

    // Ordinary withdrawal income (tax-deferred + non-medical HSA). Roth is tax-free.
    const ordinaryWithdrawals = withdrawals.taxDeferred + hsaNonMedicalWithdrawal;

    // Taxable Social Security via the provisional formula. "Other income" for the
    // formula includes everything in AGI except SS itself.
    const otherAGIexclSS =
        income.pensions + income.partTimeWork + income.rentalIncome +
        ordinaryWithdrawals + brokerageGain;
    const taxableSS = calculateTaxableSocialSecurity(
        income.socialSecurity,
        otherAGIexclSS,
        filingStatus,
        socialSecurityTaxablePercentage
    );

    // Split the taxable base so the reported fixed-income vs withdrawal tax remains
    // meaningful. The standard deduction is applied to fixed income first, then any
    // leftover shields withdrawal income.
    const fixedBase = taxableSS + income.pensions + income.partTimeWork + income.rentalIncome;
    const withdrawalBase = ordinaryWithdrawals + brokerageGain;

    const deduction = calculateStandardDeduction(
        currentAge,
        year,
        filingStatus,
        deductionInflationFactor,
        includeSeniorBonus
    );

    const fixedTaxable = Math.max(0, fixedBase - deduction);
    const deductionLeftover = Math.max(0, deduction - fixedBase);
    const withdrawalTaxable = Math.max(0, withdrawalBase - deductionLeftover);

    const onFixedIncome = fixedTaxable * effectiveTaxRate;
    const onWithdrawals = withdrawalTaxable * effectiveTaxRate;

    return {
        onFixedIncome,
        onWithdrawals,
        payrollTax,
        total: onFixedIncome + onWithdrawals + payrollTax,
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