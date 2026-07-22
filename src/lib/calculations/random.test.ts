// src/lib/calculations/random.test.ts

import { describe, it, expect } from 'vitest';
import {
    createSeededRNG,
    generateAccountReturns,
    createRunSeed,
    isValidSeed,
} from './random';

describe('createSeededRNG (Mulberry32)', () => {
    it('is deterministic: same seed → same sequence', () => {
        const a = createSeededRNG(12345);
        const b = createSeededRNG(12345);
        const seqA = [a(), a(), a()];
        const seqB = [b(), b(), b()];
        expect(seqA).toEqual(seqB);
    });

    it('produces different sequences for different seeds', () => {
        const a = createSeededRNG(1);
        const b = createSeededRNG(2);
        expect(a()).not.toBe(b());
    });

    it('produces values within [0, 1)', () => {
        const rng = createSeededRNG(999);
        for (let i = 0; i < 1000; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });
});

describe('generateAccountReturns (shared market shock)', () => {
    it('applies one correlated shock: equal-return accounts move together', () => {
        const rng = createSeededRNG(42);
        const r = generateAccountReturns(
            { taxDeferred: 0.07, roth: 0.07, taxable: 0.07, hsa: 0.05 },
            0.15,
            rng,
        );
        // Same expected return + same shock ⇒ identical realized return.
        expect(r.taxDeferred).toBe(r.roth);
        expect(r.taxDeferred).toBe(r.taxable);
        // Different expected return but the SAME shock: the spread stays exactly
        // the difference in expected returns (0.07 − 0.05 = 0.02), not random.
        expect(r.taxDeferred - r.hsa).toBeCloseTo(0.02, 10);
    });

    it('clamps returns to the [-0.50, 0.50] band', () => {
        const rng = createSeededRNG(7);
        for (let i = 0; i < 500; i++) {
            const r = generateAccountReturns(
                { taxDeferred: 0.07, roth: 0.07, taxable: 0.07, hsa: 0.05 },
                0.5, // large vol to force extremes
                rng,
            );
            for (const v of Object.values(r)) {
                expect(v).toBeGreaterThanOrEqual(-0.5);
                expect(v).toBeLessThanOrEqual(0.5);
            }
        }
    });

    it('consumes exactly 2 rng() calls per year (sequence stability)', () => {
        // A fresh RNG advanced 2 steps by hand should equal the state after one
        // generateAccountReturns call, proving the documented 2-call contract.
        const probe = createSeededRNG(123);
        probe(); probe();
        const afterTwoManual = probe();

        const rng = createSeededRNG(123);
        generateAccountReturns({ taxDeferred: 0.07, roth: 0.07, taxable: 0.07, hsa: 0.05 }, 0.15, rng);
        expect(rng()).toBe(afterTwoManual);
    });
});

describe('seed helpers', () => {
    it('createRunSeed yields distinct seeds per run', () => {
        expect(createRunSeed(0)).not.toBe(createRunSeed(1));
    });

    it('isValidSeed accepts 32-bit unsigned integers only', () => {
        expect(isValidSeed(0)).toBe(true);
        expect(isValidSeed(4294967295)).toBe(true);
        expect(isValidSeed(-1)).toBe(false);
        expect(isValidSeed(1.5)).toBe(false);
    });
});
