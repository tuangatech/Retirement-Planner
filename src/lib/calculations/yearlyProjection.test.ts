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
