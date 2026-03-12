// src/lib/calculations/income.ts

/**
 * Income Calculations Module
 * 
 * Aggregates all income sources during retirement:
 * - Social Security (with COLA and earnings test)
 * - Pensions (with COLA)
 * - Part-time work (with payroll taxes)
 * - Rental income (with optional inflation adjustment)
 */

import { calculateSocialSecurityWithEarningsTest } from './socialSecurity';
import type { Pension, PartTimeWork, RentalIncome, SocialSecurity } from '@/types';

/**
 * Payroll tax rate for Social Security and Medicare (FICA).
 * Employee portion: 7.65% (6.2% SS + 1.45% Medicare)
 */
export const PAYROLL_TAX_RATE = 0.0765;

/**
 * Calculates pension income for a given year.
 * 
 * Pensions typically start at a specific age and may include COLA.
 * - Private pensions: Usually no COLA (0%)
 * - Government pensions: Often 2% COLA
 * 
 * @param currentAge - Person's current age
 * @param pension - Pension configuration
 * @returns Annual pension income for this year
 * 
 * @example
 * const pension = {
 *   id: '1',
 *   name: 'State Pension',
 *   monthlyAmount: 1500,
 *   startAge: 65,
 *   colaRate: 0.02
 * };
 * calculatePensionIncome(65, pension); // $18,000 (first year)
 * calculatePensionIncome(66, pension); // $18,360 (after 2% COLA)
 */
export function calculatePensionIncome(
    currentAge: number,
    pension: Pension
): number {
    // Not yet receiving pension
    if (currentAge < pension.startAge) {
        return 0;
    }

    // Years since pension started (for COLA)
    const yearsSincePensionStart = currentAge - pension.startAge;

    // Calculate annual amount with COLA
    const annualAmount =
        pension.monthlyAmount *
        12 *
        Math.pow(1 + pension.colaRate, yearsSincePensionStart);

    return annualAmount;
}

/**
 * Calculates total pension income from all pensions.
 * 
 * @param currentAge - Person's current age
 * @param pensions - Array of pension configurations
 * @returns Total annual pension income
 * 
 * @example
 * const pensions = [
 *   { id: '1', name: 'Corp Pension', monthlyAmount: 1000, startAge: 65, colaRate: 0 },
 *   { id: '2', name: 'State Pension', monthlyAmount: 800, startAge: 62, colaRate: 0.02 }
 * ];
 * calculateTotalPensionIncome(65, pensions);
 * // Returns pension income from both sources at age 65
 */
export function calculateTotalPensionIncome(
    currentAge: number,
    pensions: Pension[]
): number {
    return pensions.reduce((total, pension) => {
        return total + calculatePensionIncome(currentAge, pension);
    }, 0);
}

/**
 * Calculates part-time work income (gross and net).
 * 
 * Part-time work during retirement is subject to:
 * - Payroll taxes (7.65% FICA)
 * - Income taxes (handled separately in tax module)
 * 
 * @param currentAge - Person's current age
 * @param partTimeWork - Part-time work configuration
 * @returns Object with gross income and payroll tax
 * 
 * @example
 * const work = {
 *   enabled: true,
 *   annualIncome: 25000,
 *   startAge: 65,
 *   endAge: 70
 * };
 * calculatePartTimeWorkIncome(67, work);
 * // Returns: { grossIncome: 25000, payrollTax: 1912.50 }
 */
export function calculatePartTimeWorkIncome(
    currentAge: number,
    partTimeWork: PartTimeWork
): {
    grossIncome: number;
    payrollTax: number;
} {
    // Not working or outside work age range
    if (
        !partTimeWork.enabled ||
        currentAge < partTimeWork.startAge ||
        currentAge > partTimeWork.endAge
    ) {
        return {
            grossIncome: 0,
            payrollTax: 0,
        };
    }

    const grossIncome = partTimeWork.annualIncome;
    const payrollTax = grossIncome * PAYROLL_TAX_RATE;

    return {
        grossIncome,
        payrollTax,
    };
}

/**
 * Calculates rental income for a given year.
 * 
 * Rental income can be:
 * - Fixed amount (no inflation adjustment)
 * - Inflation-adjusted (increases with general inflation)
 * - Ongoing or ending at a specific age
 * 
 * @param currentAge - Person's current age
 * @param rentalIncome - Rental income configuration
 * @param generalInflationRate - General inflation rate (if inflation adjusted)
 * @returns Annual net rental income
 * 
 * @example
 * const rental = {
 *   enabled: true,
 *   annualNetIncome: 24000,
 *   startAge: 60,
 *   endAge: null, // ongoing
 *   inflationAdjusted: true
 * };
 * calculateRentalIncome(65, rental, 0.03);
 * // Returns adjusted income: $24,000 * (1.03)^5 = $27,837
 */
export function calculateRentalIncome(
    currentAge: number,
    rentalIncome: RentalIncome,
    generalInflationRate: number
): number {
    // Not receiving rental income
    if (!rentalIncome.enabled || currentAge < rentalIncome.startAge) {
        return 0;
    }

    // Check if rental income has ended
    if (rentalIncome.endAge !== null && currentAge > rentalIncome.endAge) {
        return 0;
    }

    let income = rentalIncome.annualNetIncome;

    // Apply inflation adjustment if enabled
    if (rentalIncome.inflationAdjusted) {
        const yearsSinceStart = currentAge - rentalIncome.startAge;
        income = income * Math.pow(1 + generalInflationRate, yearsSinceStart);
    }

    return income;
}

/**
 * Calculates all income for a given year.
 * 
 * This is the main aggregation function that combines:
 * - Social Security (with earnings test)
 * - Pensions
 * - Part-time work
 * - Rental income
 * 
 * @param currentAge - Person's current age
 * @param socialSecurity - Social Security configuration
 * @param pensions - Array of pensions
 * @param partTimeWork - Part-time work configuration
 * @param rentalIncome - Rental income configuration
 * @param generalInflationRate - General inflation rate
 * @returns Object with detailed income breakdown
 * 
 * @example
 * const income = calculateYearlyIncome(
 *   68,
 *   { monthlyBenefitAtFRA: 2500, claimingAge: 67, colaRate: 0.025, taxablePercentage: 0.5 },
 *   [{ id: '1', name: 'Pension', monthlyAmount: 1000, startAge: 65, colaRate: 0 }],
 *   { enabled: true, annualIncome: 20000, startAge: 65, endAge: 70 },
 *   { enabled: true, annualNetIncome: 15000, startAge: 60, endAge: null, inflationAdjusted: true },
 *   0.03
 * );
 */
export function calculateYearlyIncome(
    currentAge: number,
    socialSecurity: SocialSecurity,
    pensions: Pension[],
    partTimeWork: PartTimeWork,
    rentalIncome: RentalIncome,
    generalInflationRate: number
): {
    socialSecurity: number;
    socialSecurityFull: number;
    socialSecurityReduction: number;
    pensions: number;
    partTimeWork: number;
    partTimePayrollTax: number;
    rentalIncome: number;
    totalBeforeWithdrawals: number;
} {
    // Social Security with earnings test
    const { grossIncome: partTimeGross } = calculatePartTimeWorkIncome(
        currentAge,
        partTimeWork
    );

    const ssResult = calculateSocialSecurityWithEarningsTest(
        currentAge,
        socialSecurity.claimingAge,
        socialSecurity.monthlyBenefitAtFRA,
        socialSecurity.colaRate,
        partTimeGross
    );

    // Pensions
    const pensionTotal = calculateTotalPensionIncome(currentAge, pensions);

    // Part-time work
    const { grossIncome: partTimeIncome, payrollTax: partTimePayrollTax } =
        calculatePartTimeWorkIncome(currentAge, partTimeWork);

    // Rental income
    const rentalIncomeAmount = calculateRentalIncome(
        currentAge,
        rentalIncome,
        generalInflationRate
    );

    // Total income before portfolio withdrawals
    const totalBeforeWithdrawals =
        ssResult.finalBenefit + pensionTotal + partTimeIncome + rentalIncomeAmount;

    return {
        socialSecurity: ssResult.finalBenefit,
        socialSecurityFull: ssResult.fullBenefit,
        socialSecurityReduction: ssResult.reduction,
        pensions: pensionTotal,
        partTimeWork: partTimeIncome,
        partTimePayrollTax,
        rentalIncome: rentalIncomeAmount,
        totalBeforeWithdrawals,
    };
}

/**
 * Validates income calculation inputs.
 * 
 * @param currentAge - Age to validate
 * @param socialSecurity - Social Security config to validate
 * @returns Validation result with any errors
 */
export function validateIncomeInputs(
    currentAge: number,
    socialSecurity: SocialSecurity
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Number.isFinite(currentAge) || currentAge < 0) {
        errors.push('Invalid current age');
    }

    if (socialSecurity.claimingAge < 62 || socialSecurity.claimingAge > 70) {
        errors.push('Social Security claiming age must be between 62 and 70');
    }

    if (socialSecurity.monthlyBenefitAtFRA < 0) {
        errors.push('Social Security benefit cannot be negative');
    }

    if (socialSecurity.colaRate < 0 || socialSecurity.colaRate > 0.15) {
        errors.push('COLA rate must be between 0% and 15%');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}