// src/lib/calculations/rmd.test.ts

import { describe, it, expect } from 'vitest';
import { calculateRMD, isRMDRequired, getRMDDivisor, RMD_TABLE } from './rmd';

describe('calculateRMD', () => {
    it('is $0 before the RMD start age (73)', () => {
        expect(calculateRMD(72, 1_000_000)).toBe(0);
    });

    it('uses the age-73 divisor (26.5) at the start age', () => {
        expect(calculateRMD(73, 1_000_000)).toBeCloseTo(1_000_000 / 26.5, 6);
    });

    it('matches the IRS Uniform Lifetime Table divisor at age 85', () => {
        expect(calculateRMD(85, 500_000)).toBeCloseTo(500_000 / 16.0, 6);
    });

    it('falls back to the age-100 divisor (6.4) for ages 101+', () => {
        expect(calculateRMD(110, 200_000)).toBeCloseTo(200_000 / RMD_TABLE[100], 6);
    });

    it('returns 0 for a zero or negative balance', () => {
        expect(calculateRMD(80, 0)).toBe(0);
        expect(calculateRMD(80, -100)).toBe(0);
    });
});

describe('isRMDRequired', () => {
    it('is false at 72 and true from 73', () => {
        expect(isRMDRequired(72)).toBe(false);
        expect(isRMDRequired(73)).toBe(true);
    });
});

describe('getRMDDivisor', () => {
    it('returns null below age 73', () => {
        expect(getRMDDivisor(72)).toBeNull();
    });

    it('returns the table value at 73 and 100', () => {
        expect(getRMDDivisor(73)).toBe(26.5);
        expect(getRMDDivisor(100)).toBe(6.4);
    });
});
