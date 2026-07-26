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
        // Pin the gap length so the scenario doesn't inherit (and break with) the mutable
        // DEFAULT_VALUES.retirementAge: a fixed 10-year gap (60 → SS at 70) keeps the taxable
        // buffer sufficient to cover the whole gap under 'standard' sequencing.
        inputs.personal.retirementAge = 60;
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

describe('runCompleteSimulation — RMD start age (flat 75, SECURE 2.0 born 1960+)', () => {
    // Big taxable buffer + standard sequencing so tax-deferred is untouched until the
    // RMD forces it; zero volatility for determinism.
    function rmdPlan(retirementAge: number): UserInputs {
        const inputs = makeInputs();
        inputs.personal.retirementAge = retirementAge;
        inputs.personal.lifeExpectancy = 90;
        inputs.accounts.taxDeferred.balanceAtRetirement = 1_000_000;
        inputs.accounts.roth.balanceAtRetirement = 0;
        inputs.accounts.taxable.balanceAtRetirement = 2_000_000;
        inputs.accounts.hsa.balanceAtRetirement = 0;
        inputs.phases = [
            { name: 'go_go', startAge: retirementAge, endAge: 74, annualSpending: 30_000 },
            { name: 'slow_go', startAge: 75, endAge: 85, annualSpending: 30_000 },
            { name: 'no_go', startAge: 86, endAge: 90, annualSpending: 30_000 },
        ];
        inputs.withdrawalStrategy.strategy = 'standard';
        inputs.simulation.returnStdDeviation = 0;
        return inputs;
    }
    const rmdAt = (r: ReturnType<typeof runCompleteSimulation>, age: number) =>
        r.projections.find(p => p.age === age)!.portfolio.rmdAmount;

    it('no RMD before 75 — begins exactly at 75, regardless of retirement age', () => {
        for (const retireAge of [55, 67]) {
            const r = runCompleteSimulation(rmdPlan(retireAge), createSeededRNG(1));
            expect(rmdAt(r, 73)).toBe(0);
            expect(rmdAt(r, 74)).toBe(0);
            expect(rmdAt(r, 75)).toBeGreaterThan(0);
        }
    });

    it('MFJ: the household RMD starts when the OLDER spouse turns 75', () => {
        // Primary retires at 62; spouse is 4 years older, so the older spouse turns 75 when
        // the primary is 71 → RMD begins at primary age 71 (not 75).
        const inputs = rmdPlan(62);
        inputs.personal.filingStatus = 'married_joint';
        inputs.personal.spouseAgeAtRetirement = 66; // spouse hits 75 at primary age 71
        const r = runCompleteSimulation(inputs, createSeededRNG(1));
        expect(rmdAt(r, 70)).toBe(0);
        expect(rmdAt(r, 71)).toBeGreaterThan(0);
    });
});

describe('runCompleteSimulation — married filing jointly', () => {
    const lifetimeTax = (r: ReturnType<typeof runCompleteSimulation>) =>
        r.projections.reduce((sum, p) => sum + p.taxes.total, 0);

    // A couple, both 67 at retirement. `spouseMonthly` = 0 keeps household income
    // identical to the single case (so filing status is the only difference); a positive
    // value adds a second SS stream. 'standard' strategy + zero volatility isolate the
    // tax model from the tax-smart fill and market noise.
    function couplePlan(mfj: boolean, spouseMonthly: number): UserInputs {
        const inputs = makeInputs();
        inputs.personal.retirementAge = 67;
        inputs.personal.lifeExpectancy = 90;
        inputs.phases = [
            { name: 'go_go', startAge: 67, endAge: 74, annualSpending: 70_000 },
            { name: 'slow_go', startAge: 75, endAge: 85, annualSpending: 60_000 },
            { name: 'no_go', startAge: 86, endAge: 90, annualSpending: 50_000 },
        ];
        inputs.accounts.taxDeferred.balanceAtRetirement = 1_200_000;
        inputs.accounts.roth.balanceAtRetirement = 100_000;
        inputs.accounts.taxable.balanceAtRetirement = 200_000;
        inputs.accounts.hsa.balanceAtRetirement = 0;
        inputs.income.socialSecurity.monthlyBenefitAtFRA = 2_500;
        inputs.income.socialSecurity.claimingAge = 67;
        inputs.simulation.returnStdDeviation = 0;
        inputs.withdrawalStrategy.strategy = 'standard';
        // Zero healthcare so single vs MFJ differ ONLY in filing status. MFJ's two-track
        // healthcare would otherwise double the couple's costs and muddy the tax isolation.
        inputs.healthcare.preMedicare = { monthlyPremium: 0, annualOutOfPocket: 0 };
        inputs.healthcare.medicare = {
            ...inputs.healthcare.medicare,
            partBStandardPremium: 0,
            partDPremium: 0,
            medigapPremium: 0,
            expectIRMAA: false,
            irmaaSurcharge: 0,
            outOfPocketByPhase: { phase1: 0, phase2: 0, phase3: 0 },
        };
        if (mfj) {
            inputs.personal.filingStatus = 'married_joint';
            inputs.personal.spouseAgeAtRetirement = 67;
            inputs.income.spouseSocialSecurity = {
                monthlyBenefitAtFRA: spouseMonthly,
                claimingAge: 67,
                colaRate: 0.03,
                taxablePercentage: 0.85,
            };
        } else {
            inputs.personal.filingStatus = 'single';
        }
        return inputs;
    }

    it('combines both spouses\' Social Security into the projection income', () => {
        const r = runCompleteSimulation(couplePlan(true, 1_800), createSeededRNG(3));
        // Year 0 (age 67 = FRA, both claim at 67): 30,000 + 21,600 = 51,600.
        expect(r.projections[0].income.socialSecurity).toBeCloseTo(51_600, 0);
    });

    it('pays less lifetime tax than a single filer at identical income (bigger joint floor)', () => {
        // Spouse SS = 0 → household income identical to single; only the deduction and SS
        // thresholds differ, so MFJ must owe strictly less tax over the plan.
        const single = runCompleteSimulation(couplePlan(false, 0), createSeededRNG(3));
        const mfj = runCompleteSimulation(couplePlan(true, 0), createSeededRNG(3));

        // Same household income each year (sanity check the isolation).
        expect(mfj.projections[0].income.socialSecurity)
            .toBeCloseTo(single.projections[0].income.socialSecurity, 0);
        expect(lifetimeTax(mfj)).toBeLessThan(lifetimeTax(single));
    });
});
