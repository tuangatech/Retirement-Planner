// src/lib/calculations/rmd.ts

/**
 * Required Minimum Distribution (RMD) Calculation Module
 * 
 * Implements IRS Uniform Lifetime Table for calculating RMDs from
 * tax-deferred retirement accounts (Traditional 401k, Traditional IRA).
 * 
 * Key Rules (SECURE Act 2.0):
 * - RMDs begin at age 73 (changed from 72 in 2023)
 * - Based on Uniform Lifetime Table
 * - RMD = Account Balance / Life Expectancy Factor
 * - Must be taken by December 31 each year
 */

/**
 * IRS Uniform Lifetime Table (2024+ rules)
 * 
 * Maps age to life expectancy factor (divisor).
 * Used to calculate Required Minimum Distributions.
 * 
 * Source: IRS Publication 590-B, Appendix B
 * Effective for distributions after December 31, 2021
 */
export const RMD_TABLE: Record<number, number> = {
    73: 26.5,
    74: 25.5,
    75: 24.6,
    76: 23.7,
    77: 22.9,
    78: 22.0,
    79: 21.1,
    80: 20.2,
    81: 19.4,
    82: 18.5,
    83: 17.7,
    84: 16.8,
    85: 16.0,
    86: 15.2,
    87: 14.4,
    88: 13.7,
    89: 12.9,
    90: 12.2,
    91: 11.5,
    92: 10.8,
    93: 10.1,
    94: 9.5,
    95: 8.9,
    96: 8.4,
    97: 7.8,
    98: 7.3,
    99: 6.8,
    100: 6.4,
    // Ages 101+ use the same factor as age 100
};

/**
 * Calculates the Required Minimum Distribution for a given age and balance.
 * 
 * RMD Rules:
 * - No RMD required before age 73
 * - RMD = Balance / Divisor from Uniform Lifetime Table
 * - Ages 101+ use the same divisor as age 100 (6.4)
 * 
 * @param age - Current age
 * @param balance - Tax-deferred account balance as of December 31 prior year
 * @returns RMD amount (0 if age < 73 or balance is 0)
 * 
 * @example
 * calculateRMD(72, 1000000); // Returns 0 (too young)
 * calculateRMD(73, 1000000); // Returns 37,735.85 ($1M / 26.5)
 * calculateRMD(85, 500000);  // Returns 31,250 ($500K / 16.0)
 * calculateRMD(110, 200000); // Returns 31,250 ($200K / 6.4, uses age 100 factor)
 */
export function calculateRMD(age: number, balance: number): number {
    // No RMD required before age 73
    if (age < 73) {
        return 0;
    }

    // Handle zero or negative balance
    if (balance <= 0) {
        return 0;
    }

    // Get divisor from table, use age 100 factor for ages 101+
    const divisor = RMD_TABLE[age] ?? RMD_TABLE[100];

    // Calculate RMD
    return balance / divisor;
}

/**
 * Determines if RMD is required for a given age.
 * 
 * @param age - Current age
 * @returns True if RMD is required (age >= 73)
 * 
 * @example
 * isRMDRequired(72); // false
 * isRMDRequired(73); // true
 * isRMDRequired(85); // true
 */
export function isRMDRequired(age: number): boolean {
    return age >= 73;
}

/**
 * Gets the life expectancy divisor for a given age from the RMD table.
 * 
 * @param age - Current age
 * @returns Life expectancy divisor, or null if age < 73
 * 
 * @example
 * getRMDDivisor(73); // 26.5
 * getRMDDivisor(100); // 6.4
 * @example
 * getRMDDivisor(110); // 6.4 (uses age 100 factor)
 * getRMDDivisor(72); // null (too young for RMD)
 */
export function getRMDDivisor(age: number): number | null {
    if (age < 73) {
        return null;
    }
    return RMD_TABLE[age] ?? RMD_TABLE[100];
}

/**
 * Calculates what percentage of the account balance must be distributed as RMD.
 * 
 * @param age - Current age
 * @returns RMD percentage (0 to 1), or 0 if age < 73
 * 
 * @example
 * getRMDPercentage(73); // 0.0377 (3.77%)
 * getRMDPercentage(85); // 0.0625 (6.25%)
 * getRMDPercentage(100); // 0.1563 (15.63%)
 */
export function getRMDPercentage(age: number): number {
    const divisor = getRMDDivisor(age);
    if (divisor === null) {
        return 0;
    }
    return 1 / divisor;
}

/**
 * Validates RMD calculation inputs.
 * 
 * @param age - Age to validate
 * @param balance - Balance to validate
 * @returns Object with isValid flag and optional error message
 * 
 * @example
 * validateRMDInputs(73, 1000000); // { isValid: true }
 * validateRMDInputs(-5, 1000000); // { isValid: false, error: "Invalid age" }
 * validateRMDInputs(73, -1000); // { isValid: false, error: "Invalid balance" }
 */
export function validateRMDInputs(
    age: number,
    balance: number
): { isValid: boolean; error?: string } {
    if (!Number.isFinite(age) || age < 0 || age > 120) {
        return { isValid: false, error: 'Invalid age: must be between 0 and 120' };
    }

    if (!Number.isFinite(balance) || balance < 0) {
        return { isValid: false, error: 'Invalid balance: must be non-negative' };
    }

    return { isValid: true };
}

/**
 * Calculates RMD with detailed breakdown.
 * Useful for debugging and displaying information to users.
 * 
 * @param age - Current age
 * @param balance - Tax-deferred account balance
 * @returns Object with RMD amount, divisor, and metadata
 * 
 * @example
 * calculateRMDDetailed(73, 1000000);
 * // Returns:
 * // {
 * //   rmdAmount: 37735.85,
 * //   divisor: 26.5,
 * //   percentage: 0.0377,
 * //   isRequired: true,
 * //   age: 73,
 * //   balance: 1000000
 * // }
 */
export function calculateRMDDetailed(age: number, balance: number): {
    rmdAmount: number;
    divisor: number | null;
    percentage: number;
    isRequired: boolean;
    age: number;
    balance: number;
} {
    const divisor = getRMDDivisor(age);
    const percentage = getRMDPercentage(age);
    const rmdAmount = calculateRMD(age, balance);

    return {
        rmdAmount,
        divisor,
        percentage,
        isRequired: isRMDRequired(age),
        age,
        balance,
    };
}