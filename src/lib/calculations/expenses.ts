// src/lib/calculations/expenses.ts

/**
 * Expense Calculations Module
 * 
 * Calculates annual expenses including:
 * - Phase-based living expenses (Go-Go, Slow-Go, No-Go)
 * - Healthcare costs (Pre-Medicare and Medicare)
 * - One-time major expenses
 * - All with inflation adjustments
 */

import type {
    RetirementPhase,
    OneTimeExpense,
    PreMedicareCosts,
    MedicareCosts,
} from '@/types';

/**
 * Medicare eligibility age.
 */
export const MEDICARE_AGE = 65;

/**
 * Default healthcare inflation rate (typically higher than general inflation).
 */
export const DEFAULT_HEALTHCARE_INFLATION = 0.05;

/**
 * Determines which retirement phase a person is in based on age.
 * 
 * @param currentAge - Person's current age
 * @param phases - Array of three retirement phases
 * @returns Phase name ('go_go', 'slow_go', 'no_go') or 'working' if before retirement
 * 
 * @example
 * const phases = [
 *   { name: 'go_go', startAge: 65, endAge: 75, annualSpending: 60000 },
 *   { name: 'slow_go', startAge: 76, endAge: 85, annualSpending: 50000 },
 *   { name: 'no_go', startAge: 86, endAge: 95, annualSpending: 40000 }
 * ];
 * determinePhase(70, phases); // 'go_go'
 * determinePhase(80, phases); // 'slow_go'
 * determinePhase(60, phases); // 'working'
 */
export function determinePhase(
    currentAge: number,
    phases: [RetirementPhase, RetirementPhase, RetirementPhase]
): 'working' | 'go_go' | 'slow_go' | 'no_go' {
    // Check each phase
    for (const phase of phases) {
        if (currentAge >= phase.startAge && currentAge <= phase.endAge) {
            return phase.name;
        }
    }

    // Before retirement
    return 'working';
}

/**
 * Calculates phase-based living expenses with inflation adjustment.
 * 
 * Living expenses are defined in "today's dollars" and adjusted for inflation
 * from the retirement start year.
 * 
 * @param currentAge - Person's current age
 * @param retirementAge - Age when retirement begins
 * @param phases - Array of three retirement phases
 * @param generalInflationRate - Annual inflation rate
 * @returns Annual living expenses for this year
 * 
 * @example
 * const phases = [
 *   { name: 'go_go', startAge: 65, endAge: 75, annualSpending: 60000 },
 *   { name: 'slow_go', startAge: 76, endAge: 85, annualSpending: 50000 },
 *   { name: 'no_go', startAge: 86, endAge: 95, annualSpending: 40000 }
 * ];
 * calculateLivingExpenses(65, 65, phases, 0.03); // $60,000 (first year)
 * calculateLivingExpenses(70, 65, phases, 0.03); // $69,556 (5 years of 3% inflation)
 */
export function calculateLivingExpenses(
    currentAge: number,
    retirementAge: number,
    phases: [RetirementPhase, RetirementPhase, RetirementPhase],
    generalInflationRate: number
): number {
    // No living expenses before retirement (working years)
    if (currentAge < retirementAge) {
        return 0;
    }

    // Determine current phase
    const phase = determinePhase(currentAge, phases);

    // Shouldn't happen, but handle gracefully
    if (phase === 'working') {
        return 0;
    }

    // Find the phase object
    const currentPhase = phases.find((p) => p.name === phase);
    if (!currentPhase) {
        return 0;
    }

    // Calculate years since retirement (for inflation)
    const yearsSinceRetirement = currentAge - retirementAge;

    // Apply inflation to base spending
    const inflatedSpending =
        currentPhase.annualSpending *
        Math.pow(1 + generalInflationRate, yearsSinceRetirement);

    return inflatedSpending;
}

/**
 * Calculates pre-Medicare healthcare costs with inflation.
 * 
 * @param currentAge - Person's current age
 * @param preMedicare - Pre-Medicare costs configuration
 * @param healthcareInflationRate - Healthcare-specific inflation rate
 * @param retirementAge - Age when retirement begins (for inflation calc)
 * @returns Annual pre-Medicare healthcare costs
 * 
 * @example
 * const preMedicare = {
 *   monthlyPremium: 600,
 *   annualOutOfPocket: 3000
 * };
 * calculatePreMedicareCosts(62, preMedicare, 0.05, 60);
 * // Premiums: $600 * 12 * (1.05)^2 = $7,938
 * // Out-of-pocket: $3,000 * (1.05)^2 = $3,307.50
 * // Total: $11,245.50
 */
export function calculatePreMedicareCosts(
    currentAge: number,
    preMedicare: PreMedicareCosts,
    healthcareInflationRate: number,
    retirementAge: number
): number {
    // No pre-Medicare costs if on Medicare
    if (currentAge >= MEDICARE_AGE) {
        return 0;
    }

    // No pre-Medicare costs if not yet retired
    if (currentAge < retirementAge) {
        return 0;
    }

    // Years since retirement (for inflation)
    const yearsSinceRetirement = currentAge - retirementAge;

    // Inflate premiums and out-of-pocket
    const annualPremium =
        preMedicare.monthlyPremium *
        12 *
        Math.pow(1 + healthcareInflationRate, yearsSinceRetirement);

    const annualOutOfPocket =
        preMedicare.annualOutOfPocket *
        Math.pow(1 + healthcareInflationRate, yearsSinceRetirement);

    return annualPremium + annualOutOfPocket;
}

/**
 * Calculates Medicare costs with inflation.
 * 
 * Medicare costs include:
 * - Part B premium (standard + IRMAA if applicable)
 * - Part D premium (prescription drug coverage)
 * - Medigap premium (supplemental coverage)
 * - Out-of-pocket expenses (varies by phase)
 * 
 * @param currentAge - Person's current age
 * @param medicare - Medicare costs configuration
 * @param healthcareInflationRate - Healthcare-specific inflation rate
 * @param currentPhase - Current retirement phase
 * @returns Annual Medicare costs
 * 
 * @example
 * const medicare = {
 *   partBStandardPremium: 185,
 *   partDPremium: 55,
 *   expectIRMAA: true,
 *   irmaaSurcharge: 150,
 *   medigapPremium: 200,
 *   outOfPocketByPhase: { phase1: 4000, phase2: 6500, phase3: 12000 }
 * };
 * calculateMedicareCosts(70, medicare, 0.05, 'go_go');
 * // Premiums + out-of-pocket with 5 years of 5% inflation
 */
export function calculateMedicareCosts(
    currentAge: number,
    medicare: MedicareCosts,
    healthcareInflationRate: number,
    currentPhase: 'working' | 'go_go' | 'slow_go' | 'no_go'
): number {
    // Not yet on Medicare
    if (currentAge < MEDICARE_AGE) {
        return 0;
    }

    // Years since Medicare eligibility (for inflation)
    const yearsSinceMedicare = currentAge - MEDICARE_AGE;

    // Calculate premiums with inflation
    const partBPremium =
        medicare.partBStandardPremium *
        12 *
        Math.pow(1 + healthcareInflationRate, yearsSinceMedicare);

    const partDPremium =
        medicare.partDPremium *
        12 *
        Math.pow(1 + healthcareInflationRate, yearsSinceMedicare);

    const irmaa = medicare.expectIRMAA
        ? medicare.irmaaSurcharge *
        12 *
        Math.pow(1 + healthcareInflationRate, yearsSinceMedicare)
        : 0;

    const medigapPremium =
        medicare.medigapPremium *
        12 *
        Math.pow(1 + healthcareInflationRate, yearsSinceMedicare);

    // Get phase-specific out-of-pocket costs
    let baseOutOfPocket = 0;
    if (currentPhase === 'go_go') {
        baseOutOfPocket = medicare.outOfPocketByPhase.phase1;
    } else if (currentPhase === 'slow_go') {
        baseOutOfPocket = medicare.outOfPocketByPhase.phase2;
    } else if (currentPhase === 'no_go') {
        baseOutOfPocket = medicare.outOfPocketByPhase.phase3;
    }

    const outOfPocket =
        baseOutOfPocket * Math.pow(1 + healthcareInflationRate, yearsSinceMedicare);

    return partBPremium + partDPremium + irmaa + medigapPremium + outOfPocket;
}

/**
 * Calculates total healthcare costs for a given year.
 * 
 * @param currentAge - Person's current age
 * @param retirementAge - Age when retirement begins
 * @param preMedicare - Pre-Medicare costs
 * @param medicare - Medicare costs
 * @param phases - Retirement phases (for phase determination)
 * @param healthcareInflationRate - Healthcare inflation rate
 * @returns Total annual healthcare costs
 */
export function calculateHealthcareCosts(
    currentAge: number,
    retirementAge: number,
    preMedicare: PreMedicareCosts,
    medicare: MedicareCosts,
    phases: [RetirementPhase, RetirementPhase, RetirementPhase],
    healthcareInflationRate: number
): {
    premiums: number;
    outOfPocket: number;
    total: number;
} {
    const phase = determinePhase(currentAge, phases);

    if (currentAge < MEDICARE_AGE) {
        const total = calculatePreMedicareCosts(
            currentAge,
            preMedicare,
            healthcareInflationRate,
            retirementAge
        );
        // Pre-Medicare breakdown (rough estimate)
        const premiums = preMedicare.monthlyPremium * 12;
        const outOfPocket = total - premiums;
        return { premiums, outOfPocket, total };
    } else {
        const total = calculateMedicareCosts(
            currentAge,
            medicare,
            healthcareInflationRate,
            phase
        );
        // Medicare breakdown (rough estimate - premiums are ~60% of total)
        const premiums = total * 0.6;
        const outOfPocket = total - premiums;
        return { premiums, outOfPocket, total };
    }
}

/**
 * Calculates one-time expenses for a given year.
 * 
 * @param currentAge - Person's current age
 * @param oneTimeExpenses - Array of one-time expenses
 * @param retirementAge - Age when retirement begins
 * @param generalInflationRate - General inflation rate
 * @returns Total one-time expenses for this year
 * 
 * @example
 * const expenses = [
 *   { id: '1', description: 'New car', amount: 35000, age: 70 },
 *   { id: '2', description: 'Home repair', amount: 15000, age: 70 }
 * ];
 * calculateOneTimeExpenses(70, expenses, 65, 0.03);
 * // Returns: $50,000 * (1.03)^5 = $57,964
 */
export function calculateOneTimeExpenses(
    currentAge: number,
    oneTimeExpenses: OneTimeExpense[],
    retirementAge: number,
    generalInflationRate: number
): number {
    // Filter expenses for this age
    const expensesThisYear = oneTimeExpenses.filter((e) => e.age === currentAge);

    // Sum up expenses with inflation adjustment
    const total = expensesThisYear.reduce((sum, expense) => {
        // Years from retirement to expense
        const yearsSinceRetirement = expense.age - retirementAge;

        // Inflate expense amount
        const inflatedAmount =
            expense.amount * Math.pow(1 + generalInflationRate, yearsSinceRetirement);

        return sum + inflatedAmount;
    }, 0);

    return total;
}

/**
 * Calculates all expenses for a given year.
 * 
 * This is the main aggregation function for expenses.
 * 
 * @param currentAge - Person's current age
 * @param retirementAge - Age when retirement begins
 * @param phases - Retirement phases
 * @param oneTimeExpenses - One-time expenses
 * @param preMedicare - Pre-Medicare costs
 * @param medicare - Medicare costs
 * @param generalInflationRate - General inflation rate
 * @param healthcareInflationRate - Healthcare inflation rate
 * @returns Object with detailed expense breakdown
 */
export function calculateYearlyExpenses(
    currentAge: number,
    retirementAge: number,
    phases: [RetirementPhase, RetirementPhase, RetirementPhase],
    oneTimeExpenses: OneTimeExpense[],
    preMedicare: PreMedicareCosts,
    medicare: MedicareCosts,
    generalInflationRate: number,
    healthcareInflationRate: number
): {
    living: number;
    healthcarePremiums: number;
    healthcareOutOfPocket: number;
    oneTimeExpenses: number;
    total: number;
} {
    const living = calculateLivingExpenses(
        currentAge,
        retirementAge,
        phases,
        generalInflationRate
    );

    const healthcare = calculateHealthcareCosts(
        currentAge,
        retirementAge,
        preMedicare,
        medicare,
        phases,
        healthcareInflationRate
    );

    const oneTime = calculateOneTimeExpenses(
        currentAge,
        oneTimeExpenses,
        retirementAge,
        generalInflationRate
    );

    return {
        living,
        healthcarePremiums: healthcare.premiums,
        healthcareOutOfPocket: healthcare.outOfPocket,
        oneTimeExpenses: oneTime,
        total: living + healthcare.total + oneTime,
    };
}