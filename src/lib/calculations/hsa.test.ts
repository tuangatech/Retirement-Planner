// src/lib/calculations/hsa.test.ts

import { describe, it, expect } from 'vitest';
import { calculateHSAWithdrawal, canUseHSAForNonMedical } from './hsa';

describe('calculateHSAWithdrawal', () => {
    it('covers healthcare tax-free at any age', () => {
        const r = calculateHSAWithdrawal(60, 50000, 8000, 0, false, 0.18);
        expect(r.medicalWithdrawal).toBe(8000);
        expect(r.taxOnNonMedical).toBe(0);
        expect(r.remainingBalance).toBe(42000);
    });

    it('does NOT touch HSA for non-medical spending before 65', () => {
        // Age 60, large cash-flow gap, but non-medical HSA use isn't allowed pre-65.
        const r = calculateHSAWithdrawal(60, 50000, 8000, 30000, true, 0.18);
        expect(r.nonMedicalWithdrawal).toBe(0);
        expect(r.totalWithdrawal).toBe(8000); // healthcare only
    });

    it('uses excess HSA for general spending after 65 (taxed, grossed up)', () => {
        // Age 70: cover $8k healthcare, then net $10k of the gap from the remainder.
        const r = calculateHSAWithdrawal(70, 50000, 8000, 10000, true, 0.18);
        expect(r.medicalWithdrawal).toBe(8000);
        // gross to net $10k at 18% = 10,000 / 0.82.
        expect(r.nonMedicalWithdrawal).toBeCloseTo(10000 / 0.82, 6);
        expect(r.taxOnNonMedical).toBeCloseTo((10000 / 0.82) * 0.18, 6);
    });

    it('caps a non-medical withdrawal at the remaining balance', () => {
        // Only $2k left after healthcare, but a huge gap → limited to $2k.
        const r = calculateHSAWithdrawal(70, 10000, 8000, 100000, true, 0.18);
        expect(r.nonMedicalWithdrawal).toBe(2000);
        expect(r.remainingBalance).toBe(0);
    });

    it('returns all zeros when the HSA is empty', () => {
        const r = calculateHSAWithdrawal(70, 0, 8000, 10000, true, 0.18);
        expect(r.totalWithdrawal).toBe(0);
    });
});

describe('canUseHSAForNonMedical', () => {
    it('is false before 65, true at 65+', () => {
        expect(canUseHSAForNonMedical(64)).toBe(false);
        expect(canUseHSAForNonMedical(65)).toBe(true);
    });
});
