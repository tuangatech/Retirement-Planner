// src/lib/calculations/compareStatesTax.test.ts

import { describe, it, expect } from 'vitest';
import { compareStatesTax, type StateTaxComparisonInput } from './compareStatesTax';
import { modeledStates } from './stateTaxRules';

/** The MFJ situation from docs/scenario-tax-comparisons.md — federal, GA, FL, and NY all owe $0. */
const ZERO_TAX_SITUATION: StateTaxComparisonInput = {
    filingStatus: 'married_joint',
    age: 68,
    spouseAge: 66,
    year: 2026,
    socialSecurity: 43200,
    governmentPensionIncome: 0,
    privatePensionIncome: 0,
    taxDeferredWithdrawal: 14000,
    investmentGains: 7200,
    partTimeWork: 0,
    rentalIncome: 0,
    hsaNonMedicalWithdrawal: 0,
    effectiveTaxRate: 0.12,
};

describe('compareStatesTax', () => {
    it('matches the documented zero-tax MFJ situation for federal, GA, FL, and NY', () => {
        const result = compareStatesTax(ZERO_TAX_SITUATION);

        expect(result.federal.taxableIncome).toBe(0);
        expect(result.federal.tax).toBe(0);

        const byState = Object.fromEntries(result.states.map((r) => [r.state, r]));
        expect(byState.GA.detail.tax).toBe(0);
        expect(byState.FL.detail.tax).toBe(0);
        expect(byState.FL.taxesIncome).toBe(false);
        expect(byState.NY.detail.tax).toBe(0);
    });

    it('returns exactly one row per modeled state', () => {
        const result = compareStatesTax(ZERO_TAX_SITUATION);
        expect(result.states.map((r) => r.state).sort()).toEqual(modeledStates().sort());
    });

    it('computes a real federal breakdown consistent with its own taxable-income figure', () => {
        const result = compareStatesTax(ZERO_TAX_SITUATION);
        // Non-SS AGI items: $14,000 + $7,200 = $21,200; taxable SS via the provisional formula.
        expect(result.federal.agi).toBe(result.federal.taxableSocialSecurity + 21200);
        expect(result.federal.taxableIncome).toBe(
            Math.max(0, result.federal.agi - result.federal.standardDeduction)
        );
    });

    it("exposes the Georgia vs. New York gap when investment gains dominate income", () => {
        const result = compareStatesTax({
            filingStatus: 'single',
            age: 70,
            year: 2026,
            socialSecurity: 0,
            governmentPensionIncome: 0,
            privatePensionIncome: 0,
            taxDeferredWithdrawal: 0,
            investmentGains: 100000,
            partTimeWork: 0,
            rentalIncome: 0,
            hsaNonMedicalWithdrawal: 0,
            effectiveTaxRate: 0.12,
        });

        const byState = Object.fromEntries(result.states.map((r) => [r.state, r]));

        // Georgia's retirement exclusion reaches brokerage gains; New York's private-pension
        // exclusion does not (it only ever pools private pension income + tax-deferred draws).
        expect(byState.GA.detail.benefit).toBe(65000);
        expect(byState.NY.detail.benefit).toBe(0);
        expect(byState.NY.detail.tax).toBeGreaterThan(byState.GA.detail.tax);
    });
});
