// src/lib/calculations/socialSecurity.test.ts

import { describe, it, expect } from 'vitest';
import {
    calculateSocialSecurityBenefit,
    applyEarningsTest,
    getClaimingAdjustmentFactor,
    isValidClaimingAge,
    EARNINGS_TEST_LIMITS,
    FULL_RETIREMENT_AGE,
} from './socialSecurity';

describe('calculateSocialSecurityBenefit', () => {
    it('returns 0 before the claiming age', () => {
        expect(calculateSocialSecurityBenefit(66, 67, 2500, 0.025)).toBe(0);
    });

    it('pays 100% of FRA benefit in the first year at FRA (no COLA yet)', () => {
        // $2,500/mo × 12 × 1.0 = $30,000.
        expect(calculateSocialSecurityBenefit(67, 67, 2500, 0.025)).toBeCloseTo(30000, 6);
    });

    it('reduces the benefit for early claiming (age 62 → 70%)', () => {
        // $2,500 × 12 × 0.70 = $21,000.
        expect(calculateSocialSecurityBenefit(62, 62, 2500, 0.03)).toBeCloseTo(21000, 6);
    });

    it('increases the benefit for delayed claiming (age 70 → 124%)', () => {
        // $2,500 × 12 × 1.24 = $37,200.
        expect(calculateSocialSecurityBenefit(70, 70, 2500, 0.03)).toBeCloseTo(37200, 6);
    });

    it('compounds COLA from the claiming year forward', () => {
        // Claimed at 67, now 70 → 3 years of 2.5% COLA on the $30,000 base.
        expect(calculateSocialSecurityBenefit(70, 67, 2500, 0.025))
            .toBeCloseTo(30000 * Math.pow(1.025, 3), 6);
    });
});

describe('applyEarningsTest', () => {
    it('does not reduce benefits at or after FRA', () => {
        expect(applyEarningsTest(30000, FULL_RETIREMENT_AGE + 1, 100000)).toBe(30000);
    });

    it('withholds $1 for every $2 over the pre-FRA limit', () => {
        // Age 65, earning $10k over the before-FRA limit → $5k reduction.
        const income = EARNINGS_TEST_LIMITS.BEFORE_FRA + 10000;
        expect(applyEarningsTest(24000, 65, income)).toBeCloseTo(24000 - 5000, 6);
    });

    it('does not reduce benefits when earnings are under the limit', () => {
        expect(applyEarningsTest(24000, 64, EARNINGS_TEST_LIMITS.BEFORE_FRA - 1)).toBe(24000);
    });

    it('never drives the benefit below zero', () => {
        expect(applyEarningsTest(5000, 63, EARNINGS_TEST_LIMITS.BEFORE_FRA + 1_000_000)).toBe(0);
    });
});

describe('claiming-age helpers', () => {
    it('maps claiming ages to adjustment factors', () => {
        expect(getClaimingAdjustmentFactor(62)).toBe(0.70);
        expect(getClaimingAdjustmentFactor(67)).toBe(1.0);
        expect(getClaimingAdjustmentFactor(70)).toBe(1.24);
        expect(getClaimingAdjustmentFactor(61)).toBeNull();
    });

    it('validates the 62–70 claiming window', () => {
        expect(isValidClaimingAge(67)).toBe(true);
        expect(isValidClaimingAge(61)).toBe(false);
        expect(isValidClaimingAge(71)).toBe(false);
        expect(isValidClaimingAge(67.5)).toBe(false);
    });
});
