// src/lib/calculations/socialSecurity.ts

/**
 * Social Security Benefits Calculation Module
 * 
 * Calculates Social Security retirement benefits including:
 * - Early/delayed claiming adjustments
 * - Annual Cost of Living Adjustments (COLA)
 * - Earnings test for early claimers who work
 * 
 * Key Concepts:
 * - FRA (Full Retirement Age): Typically 67 for most people
 * - Early claiming (62-66): Reduced benefits
 * - Delayed claiming (68-70): Increased benefits
 * - COLA: Annual inflation adjustment
 * - Earnings test: Benefit reduction if claiming before FRA while working
 */

/**
 * Social Security benefit adjustment factors by claiming age.
 * 
 * These factors represent the percentage of Full Retirement Age (FRA)
 * benefit received when claiming at each age.
 * 
 * Source: Social Security Administration
 * - Age 62: 70% of FRA benefit
 * - Age 67 (FRA): 100% of FRA benefit
 * - Age 70: 124% of FRA benefit
 */
export const SS_ADJUSTMENT_FACTORS: Record<number, number> = {
    62: 0.70,
    63: 0.75,
    64: 0.80,
    65: 0.867,
    66: 0.933,
    67: 1.0, // Full Retirement Age
    68: 1.08,
    69: 1.16,
    70: 1.24,
};

/**
 * Earnings test limits for 2025 (these typically increase annually).
 * 
 * If you claim before FRA and work, benefits may be reduced based on earnings:
 * - Before FRA: $1 reduction for every $2 earned above limit
 * - In FRA year: $1 reduction for every $3 earned above limit
 * - After FRA: No limit
 */
export const EARNINGS_TEST_LIMITS = {
    BEFORE_FRA: 23400, // Annual limit before reaching FRA
    IN_FRA_YEAR: 62160, // Annual limit in year you reach FRA
} as const;

/**
 * Full Retirement Age (typically 67 for people born 1960 or later).
 */
export const FULL_RETIREMENT_AGE = 67;

/**
 * Calculates annual Social Security benefit for a given year.
 * 
 * This is the main function for Social Security calculations. It:
 * 1. Applies claiming age adjustment
 * 2. Applies COLA for years since claiming
 * 3. Returns 0 if not yet claiming age
 * 
 * @param currentAge - Person's current age in the year being calculated
 * @param claimingAge - Age when benefits will start (62-70)
 * @param monthlyBenefitAtFRA - Monthly benefit at Full Retirement Age
 * @param colaRate - Annual Cost of Living Adjustment rate (e.g., 0.025 = 2.5%)
 * @returns Annual Social Security benefit (before earnings test)
 * 
 * @example
 * // Person is 68, claimed at 67, FRA benefit is $2500/mo, 2.5% COLA
 * calculateSocialSecurityBenefit(68, 67, 2500, 0.025);
 * // Year 1 (age 67): $2500 * 12 * 1.0 = $30,000
 * // Year 2 (age 68): $2500 * 12 * 1.0 * 1.025 = $30,750
 */
export function calculateSocialSecurityBenefit(
    currentAge: number,
    claimingAge: number,
    monthlyBenefitAtFRA: number,
    colaRate: number
): number {
    // Not yet claiming
    if (currentAge < claimingAge) {
        return 0;
    }

    // Get adjustment factor for claiming age
    const adjustmentFactor = SS_ADJUSTMENT_FACTORS[claimingAge] ?? 1.0;

    // Years since claiming (for COLA application)
    const yearsSinceClaiming = currentAge - claimingAge;

    // Calculate annual benefit with COLA
    const annualBenefit =
        monthlyBenefitAtFRA *
        12 *
        adjustmentFactor *
        Math.pow(1 + colaRate, yearsSinceClaiming);

    return annualBenefit;
}

/**
 * Applies Social Security earnings test.
 * 
 * If you claim before Full Retirement Age and work, benefits may be reduced:
 * - Before FRA year: $1 withheld for every $2 earned above $23,400 (2025)
 * - In FRA year: $1 withheld for every $3 earned above $62,160 (2025)
 * - After FRA: No reduction (unlimited earnings)
 * 
 * Note: Withheld benefits are not lost forever - they increase your benefit
 * once you reach FRA. This calculator does NOT model that adjustment.
 * 
 * @param fullBenefit - Full Social Security benefit before earnings test
 * @param currentAge - Person's current age
 * @param partTimeIncome - Annual income from part-time work
 * @returns Actual benefit after earnings test reduction
 * 
 * @example
 * // Age 65, earning $30,000, benefit before reduction is $24,000
 * applyEarningsTest(24000, 65, 30000);
 * // Over limit by: $30,000 - $23,400 = $6,600
 * // Reduction: $6,600 / 2 = $3,300
 * // Benefit after reduction: $24,000 - $3,300 = $20,700
 */
export function applyEarningsTest(
    fullBenefit: number,
    currentAge: number,
    partTimeIncome: number
): number {
    // No earnings test after Full Retirement Age
    if (currentAge >= FULL_RETIREMENT_AGE) {
        return fullBenefit;
    }

    // No reduction if not working or earning below limit
    if (partTimeIncome === 0) {
        return fullBenefit;
    }

    // In year of reaching FRA (different rules)
    if (currentAge === FULL_RETIREMENT_AGE) {
        if (partTimeIncome <= EARNINGS_TEST_LIMITS.IN_FRA_YEAR) {
            return fullBenefit;
        }

        // $1 reduction for every $3 over limit
        const excessEarnings = partTimeIncome - EARNINGS_TEST_LIMITS.IN_FRA_YEAR;
        const reduction = excessEarnings / 3;

        return Math.max(0, fullBenefit - reduction);
    }

    // Before FRA year
    if (partTimeIncome <= EARNINGS_TEST_LIMITS.BEFORE_FRA) {
        return fullBenefit;
    }

    // $1 reduction for every $2 over limit
    const excessEarnings = partTimeIncome - EARNINGS_TEST_LIMITS.BEFORE_FRA;
    const reduction = excessEarnings / 2;

    return Math.max(0, fullBenefit - reduction);
}

/**
 * Calculates final Social Security benefit including earnings test.
 * 
 * This is a convenience function that combines benefit calculation
 * and earnings test application.
 * 
 * @param currentAge - Person's current age
 * @param claimingAge - Age when benefits started (62-70)
 * @param monthlyBenefitAtFRA - Monthly benefit at Full Retirement Age
 * @param colaRate - Annual COLA rate
 * @param partTimeIncome - Annual income from work (0 if not working)
 * @returns Object with full benefit and benefit after earnings test
 * 
 * @example
 * calculateSocialSecurityWithEarningsTest(65, 65, 2500, 0.025, 30000);
 * // Returns:
 * // {
 * //   fullBenefit: 26010,  // $2500 * 12 * 0.867
 * //   finalBenefit: 22710, // After earnings test reduction
 * //   reduction: 3300
 * // }
 */
export function calculateSocialSecurityWithEarningsTest(
    currentAge: number,
    claimingAge: number,
    monthlyBenefitAtFRA: number,
    colaRate: number,
    partTimeIncome: number
): {
    fullBenefit: number;
    finalBenefit: number;
    reduction: number;
} {
    const fullBenefit = calculateSocialSecurityBenefit(
        currentAge,
        claimingAge,
        monthlyBenefitAtFRA,
        colaRate
    );

    const finalBenefit = applyEarningsTest(fullBenefit, currentAge, partTimeIncome);

    return {
        fullBenefit,
        finalBenefit,
        reduction: fullBenefit - finalBenefit,
    };
}

/**
 * Gets the adjustment factor for a claiming age.
 * 
 * @param claimingAge - Age when claiming (62-70)
 * @returns Adjustment factor (0.70 to 1.24), or null if invalid age
 * 
 * @example
 * getClaimingAdjustmentFactor(62); // 0.70 (70% of FRA benefit)
 * getClaimingAdjustmentFactor(67); // 1.0 (100% of FRA benefit)
 * getClaimingAdjustmentFactor(70); // 1.24 (124% of FRA benefit)
 */
export function getClaimingAdjustmentFactor(
    claimingAge: number
): number | null {
    return SS_ADJUSTMENT_FACTORS[claimingAge] ?? null;
}

/**
 * Validates claiming age.
 * 
 * @param claimingAge - Age to validate
 * @returns True if valid (62-70), false otherwise
 * 
 * @example
 * isValidClaimingAge(67); // true
 * isValidClaimingAge(61); // false
 * isValidClaimingAge(71); // false
 */
export function isValidClaimingAge(claimingAge: number): boolean {
    return claimingAge >= 62 && claimingAge <= 70 && Number.isInteger(claimingAge);
}

/**
 * Calculates lifetime Social Security benefits from claiming age to given age.
 * 
 * Useful for comparing different claiming strategies.
 * 
 * @param claimingAge - Age when claiming starts
 * @param endAge - Age to calculate benefits through
 * @param monthlyBenefitAtFRA - Monthly benefit at FRA
 * @param colaRate - Annual COLA rate
 * @returns Total benefits received from claiming to end age
 * 
 * @example
 * // Compare claiming at 62 vs 67 through age 85
 * const total62 = calculateLifetimeBenefits(62, 85, 2500, 0.025);
 * const total67 = calculateLifetimeBenefits(67, 85, 2500, 0.025);
 * // total62 might be higher due to more years, but lower annual amounts
 */
export function calculateLifetimeBenefits(
    claimingAge: number,
    endAge: number,
    monthlyBenefitAtFRA: number,
    colaRate: number
): number {
    let totalBenefits = 0;

    for (let age = claimingAge; age <= endAge; age++) {
        const yearlyBenefit = calculateSocialSecurityBenefit(
            age,
            claimingAge,
            monthlyBenefitAtFRA,
            colaRate
        );
        totalBenefits += yearlyBenefit;
    }

    return totalBenefits;
}