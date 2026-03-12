// src/lib/calculations/index.ts

/**
 * Central export file for all calculation modules.
 * 
 * This makes imports cleaner and provides a single entry point
 * for all calculation functions.
 */

// Module 1: Random Number Generation
export {
    createSeededRNG,
    generateNormalReturn,
    generateAccountReturns,
    isValidSeed,
    createRunSeed,
} from './random';

// Module 2: RMD Calculations
export {
    RMD_TABLE,
    calculateRMD,
    isRMDRequired,
    getRMDDivisor,
    getRMDPercentage,
    validateRMDInputs,
    calculateRMDDetailed,
} from './rmd';

// Module 3: Social Security
export {
    SS_ADJUSTMENT_FACTORS,
    EARNINGS_TEST_LIMITS,
    FULL_RETIREMENT_AGE,
    calculateSocialSecurityBenefit,
    applyEarningsTest,
    calculateSocialSecurityWithEarningsTest,
    getClaimingAdjustmentFactor,
    isValidClaimingAge,
    calculateLifetimeBenefits,
} from './socialSecurity';

// Module 4: Income
export {
    PAYROLL_TAX_RATE,
    calculatePensionIncome,
    calculateTotalPensionIncome,
    calculatePartTimeWorkIncome,
    calculateRentalIncome,
    calculateYearlyIncome,
    validateIncomeInputs,
} from './income';

// Module 5: Expenses
export {
    MEDICARE_AGE,
    DEFAULT_HEALTHCARE_INFLATION,
    determinePhase,
    calculateLivingExpenses,
    calculatePreMedicareCosts,
    calculateMedicareCosts,
    calculateHealthcareCosts,
    calculateOneTimeExpenses,
    calculateYearlyExpenses,
} from './expenses';

// Module 6: Taxes
export {
    calculateTaxOnFixedIncome,
    calculateTaxOnTaxDeferredWithdrawal,
    calculateTaxOnTaxableWithdrawal,
    calculateTaxOnRothWithdrawal,
    calculateTaxGrossUpFactor,
    calculateGrossWithdrawalForNet,
    calculateEffectiveTaxRateOnTaxable,
    iterateTaxCalculation,
    calculateTotalTaxes,
    validateTaxInputs,
    estimateTaxes,
    calculateAfterTaxIncome,
    calculateMarginalTax,
} from './taxes';

// Module 7: Withdrawals
export {
    executeWithdrawals,
    handleSurplus,
    validateWithdrawalInputs,
    calculateTotalPortfolio,
    isPortfolioDepleted,
} from './withdrawals';

export type {
    AccountBalances,
    WithdrawalAmounts,
    IncomeForTax,
    WithdrawalResult,
} from './withdrawals';

// Module 8: Yearly Projection
export {
    calculateYearlyProjection,
    runCompleteSimulation,
    validateProjectionInputs,
    calculateProjectionSummary,
    type YearlyProjection,
} from './yearlyProjection';