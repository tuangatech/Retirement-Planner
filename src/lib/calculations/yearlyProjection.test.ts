// src/lib/calculations/yearlyProjection.test.ts

import { describe, it, expect } from 'vitest';
import { runCompleteSimulation } from './yearlyProjection';
import { createSeededRNG } from './random';
import { DEFAULT_VALUES } from '../constants';
import type { UserInputs } from '@/types';

/** Deep-ish clone of the defaults with per-test overrides. */
function makeInputs(overrides: Partial<UserInputs> = {}): UserInputs {
    return structuredClone({ ...DEFAULT_VALUES, ...overrides });
}

describe('runCompleteSimulation — success metric', () => {
    it('a richly funded, low-spend plan never depletes → success, positive balance', () => {
        const inputs = makeInputs();
        inputs.accounts.taxDeferred.balanceAtRetirement = 5_000_000;
        inputs.accounts.roth.balanceAtRetirement = 5_000_000;
        inputs.accounts.taxable.balanceAtRetirement = 5_000_000;
        // Use a benign, positive return sequence via a fixed seed + modest spend.
        inputs.phases.forEach(p => { p.annualSpending = 20_000; });

        const r = runCompleteSimulation(inputs, createSeededRNG(1));
        expect(r.success).toBe(true);
        expect(r.ageOfDepletion).toBeNull();
        expect(r.finalBalance).toBeGreaterThan(0);
    });

    it('a tiny portfolio with heavy spending depletes → failure, $0 final balance', () => {
        const inputs = makeInputs();
        inputs.accounts.taxDeferred.balanceAtRetirement = 10_000;
        inputs.accounts.roth.balanceAtRetirement = 0;
        inputs.accounts.taxable.balanceAtRetirement = 0;
        inputs.accounts.hsa.balanceAtRetirement = 0;
        inputs.phases.forEach(p => { p.annualSpending = 80_000; });
        // No outside income so the portfolio must carry all spending.
        inputs.income.socialSecurity.monthlyBenefitAtFRA = 0;

        const r = runCompleteSimulation(inputs, createSeededRNG(1));
        expect(r.success).toBe(false);
        expect(r.ageOfDepletion).not.toBeNull();
        // The key regression guard: a failed run reports exactly $0, never stranded pennies.
        expect(r.finalBalance).toBe(0);
    });

    it('produces one projection row per retirement year', () => {
        const inputs = makeInputs();
        const r = runCompleteSimulation(inputs, createSeededRNG(1));
        const expectedYears = inputs.personal.lifeExpectancy - inputs.personal.retirementAge + 1;
        expect(r.projections).toHaveLength(expectedYears);
    });

    it('is deterministic for a fixed seed', () => {
        const a = runCompleteSimulation(makeInputs(), createSeededRNG(7));
        const b = runCompleteSimulation(makeInputs(), createSeededRNG(7));
        expect(a.finalBalance).toBe(b.finalBalance);
        expect(a.ageOfDepletion).toBe(b.ageOfDepletion);
    });
});

describe('runCompleteSimulation — tax-smart vs standard sequencing', () => {
    const lifetimeTax = (r: ReturnType<typeof runCompleteSimulation>) =>
        r.projections.reduce((sum, p) => sum + p.taxes.total, 0);
    const gapTaxDeferred = (r: ReturnType<typeof runCompleteSimulation>, ssClaimAge: number) =>
        r.projections
            .filter(p => p.age < ssClaimAge)
            .reduce((sum, p) => sum + p.portfolio.withdrawals.taxDeferred, 0);

    // The classic gap-year case: a healthy taxable buffer plus delayed Social Security (70).
    // Under 'standard', the taxable account covers all gap-year spending so the large
    // tax-deferred balance sits untouched and later drives big, torpedo-triggering RMDs.
    // 'tax_smart' instead draws that tax-deferred down to the deduction floor (tax-free)
    // during the gap, cutting lifetime tax and preserving the higher-return taxable account.
    const SS_CLAIM_AGE = 70;
    function gapYearPlan(strategy: 'standard' | 'tax_smart'): UserInputs {
        const inputs = makeInputs();
        inputs.accounts.taxDeferred.balanceAtRetirement = 900_000;
        inputs.accounts.taxable.balanceAtRetirement = 600_000;
        inputs.accounts.roth.balanceAtRetirement = 100_000;
        inputs.accounts.hsa.balanceAtRetirement = 0;
        inputs.income.socialSecurity.claimingAge = SS_CLAIM_AGE;
        inputs.phases.forEach(p => { p.annualSpending = 55_000; });
        // Deterministic returns so the ONLY difference between runs is the strategy.
        inputs.simulation.returnStdDeviation = 0;
        inputs.withdrawalStrategy.strategy = strategy;
        return inputs;
    }

    it('tax-smart pays less lifetime tax and leaves more behind', () => {
        const std = runCompleteSimulation(gapYearPlan('standard'), createSeededRNG(42));
        const smart = runCompleteSimulation(gapYearPlan('tax_smart'), createSeededRNG(42));

        expect(lifetimeTax(smart)).toBeLessThan(lifetimeTax(std));
        expect(smart.finalBalance).toBeGreaterThan(std.finalBalance);
    });

    it('draws tax-deferred during the gap years, unlike standard sequencing', () => {
        const std = runCompleteSimulation(gapYearPlan('standard'), createSeededRNG(42));
        const smart = runCompleteSimulation(gapYearPlan('tax_smart'), createSeededRNG(42));

        // Standard leaves tax-deferred untouched in the gap (taxable covers spending);
        // tax-smart proactively fills the deduction floor from it.
        expect(gapTaxDeferred(std, SS_CLAIM_AGE)).toBeCloseTo(0, -1);
        expect(gapTaxDeferred(smart, SS_CLAIM_AGE)).toBeGreaterThan(100_000);
    });

    it('never produces a negative balance under tax-smart sequencing', () => {
        const smart = runCompleteSimulation(gapYearPlan('tax_smart'), createSeededRNG(42));
        for (const p of smart.projections) {
            expect(p.portfolio.balances.total).toBeGreaterThanOrEqual(0);
        }
    });
});
