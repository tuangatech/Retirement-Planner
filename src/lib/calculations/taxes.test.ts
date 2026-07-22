// src/lib/calculations/taxes.test.ts

import { describe, it, expect } from 'vitest';
import {
    TAX_RULES,
    calculateTaxableSocialSecurity,
    calculateStandardDeduction,
    calculateTaxFreeTaxDeferredRoom,
    calculateTotalTaxes,
    calculateTaxOnTaxableWithdrawal,
    calculateGrossWithdrawalForNet,
} from './taxes';

describe('calculateTaxableSocialSecurity (IRS provisional-income formula)', () => {
    it('taxes 0% when provisional income is below the first threshold', () => {
        // SS $20k, no other income → provisional = 10,000 < $25k single base.
        expect(calculateTaxableSocialSecurity(20000, 0, 'single')).toBe(0);
    });

    it('applies the 50% tier between the two thresholds', () => {
        // SS $24k, other income $16k → provisional = 16,000 + 12,000 = 28,000.
        // Between $25k and $34k → min(½·SS, ½·(prov − base)).
        // = min(12,000, 0.5·(28,000 − 25,000)) = min(12,000, 1,500) = 1,500.
        expect(calculateTaxableSocialSecurity(24000, 16000, 'single')).toBeCloseTo(1500, 6);
    });

    it('applies the 85% tier well above the second threshold', () => {
        // SS $30k, other income $60k → provisional = 60,000 + 15,000 = 75,000 (> $34k).
        // tier1 = min(15,000, 0.5·(34,000 − 25,000)) = 4,500.
        // taxable = min(0.85·30,000, 0.85·(75,000 − 34,000) + 4,500)
        //         = min(25,500, 39,350) = 25,500 (hits the 85% statutory cap).
        expect(calculateTaxableSocialSecurity(30000, 60000, 'single')).toBeCloseTo(25500, 6);
    });

    it('honors a user-lowered cap (approximating a state SS exemption)', () => {
        // Same high-income case, but cap taxable share at 50% instead of 85%.
        expect(calculateTaxableSocialSecurity(30000, 60000, 'single', 0.5)).toBeCloseTo(15000, 6);
    });

    it('uses the higher MFJ thresholds', () => {
        // SS $24k, other $16k → provisional 28,000. Under the MFJ base of $32k → $0,
        // whereas the same numbers were taxable for a single filer.
        expect(calculateTaxableSocialSecurity(24000, 16000, 'married_joint')).toBe(0);
    });

    it('returns 0 when there is no SS benefit', () => {
        expect(calculateTaxableSocialSecurity(0, 50000, 'single')).toBe(0);
    });
});

describe('calculateStandardDeduction (tax-free floor)', () => {
    it('under 65: base deduction only, no senior additions', () => {
        expect(calculateStandardDeduction(64, 2026, 'single')).toBe(TAX_RULES.standardDeduction.single);
    });

    it('age 65+: adds the age-65 addition and the OBBBA senior bonus', () => {
        // 2026 single: 16,100 + 2,050 (age 65) + 6,000 (senior bonus) = 24,150.
        expect(calculateStandardDeduction(65, 2026, 'single')).toBeCloseTo(24150, 6);
    });

    it('drops the senior bonus after its final year (2028)', () => {
        // 2029: base + age-65 addition only (16,100 + 2,050 = 18,150), bonus gone.
        expect(calculateStandardDeduction(70, 2029, 'single')).toBeCloseTo(18150, 6);
    });

    it('inflation-indexes the base + age-65 portion but not the flat senior bonus', () => {
        // factor 1.1 → (16,100 + 2,050)·1.1 + 6,000 = 19,965 + 6,000 = 25,965.
        expect(calculateStandardDeduction(65, 2026, 'single', 1.1)).toBeCloseTo(25965, 6);
    });

    it('can exclude the senior bonus when asked', () => {
        expect(calculateStandardDeduction(65, 2026, 'single', 1, false)).toBeCloseTo(18150, 6);
    });
});

describe('calculateTaxOnTaxableWithdrawal (gain-only)', () => {
    it('taxes only the gain portion, not the cost basis', () => {
        // $10k withdrawal, 70% basis → $3k gain × 18% = $540.
        expect(calculateTaxOnTaxableWithdrawal(10000, 0.7, 0.18)).toBeCloseTo(540, 6);
    });
});

describe('calculateGrossWithdrawalForNet (tax gross-up)', () => {
    it('grosses up so the after-tax amount equals the need', () => {
        const gross = calculateGrossWithdrawalForNet(10000, 0.18);
        expect(gross).toBeCloseTo(10000 / 0.82, 6);
        // Round-trip: gross − tax === net.
        expect(gross - gross * 0.18).toBeCloseTo(10000, 6);
    });

    it('returns 0 for a non-positive need', () => {
        expect(calculateGrossWithdrawalForNet(0, 0.18)).toBe(0);
        expect(calculateGrossWithdrawalForNet(-500, 0.18)).toBe(0);
    });
});

describe('calculateTotalTaxes (aggregation)', () => {
    const income = { socialSecurity: 0, pensions: 0, partTimeWork: 0, rentalIncome: 0 };
    const noWithdrawals = { taxDeferred: 0, roth: 0, taxable: 0 };

    it('is $0 when a modest SS-only retiree stays under the deduction floor', () => {
        // SS $30k only, age 68 (2026 floor $24,150). Provisional = 15,000 < $25k → $0 taxable SS.
        const t = calculateTotalTaxes(
            { ...income, socialSecurity: 30000 },
            noWithdrawals,
            0.12, 0.85, 0.7, 0, /* age */ 68, /* year */ 2029,
        );
        expect(t.total).toBe(0);
    });

    it('taxes tax-deferred withdrawals as ordinary income above the floor', () => {
        // $61,102 traditional withdrawal, age 64 (no senior additions → floor 16,100).
        // taxable = 61,102 − 16,100 = 45,002 × 12% = 5,400.24.
        const t = calculateTotalTaxes(
            income,
            { taxDeferred: 61102, roth: 0, taxable: 0 },
            0.12, 0.85, 0.7, 0, /* age */ 64, /* year */ 2030,
        );
        expect(t.onWithdrawals).toBeCloseTo(5400.24, 2);
        expect(t.total).toBeCloseTo(5400.24, 2);
    });

    it('never taxes Roth withdrawals', () => {
        const withRoth = calculateTotalTaxes(
            income, { taxDeferred: 0, roth: 50000, taxable: 0 },
            0.12, 0.85, 0.7, 0, 70, 2030,
        );
        expect(withRoth.total).toBe(0);
    });

    it('adds payroll tax straight through to the total', () => {
        const t = calculateTotalTaxes(
            income, noWithdrawals, 0.12, 0.85, 0.7, /* payrollTax */ 1530, 62, 2030,
        );
        expect(t.payrollTax).toBe(1530);
        expect(t.total).toBe(1530);
    });

    it('taxes non-medical HSA withdrawals (age 65+) as ordinary income', () => {
        // $20k non-medical HSA at age 70, 2029 floor 18,150 → taxable 1,850 × 12% = 222.
        const t = calculateTotalTaxes(
            income, noWithdrawals, 0.12, 0.85, 0.7, 0, 70, 2029, 1, /* hsaNonMedical */ 20000,
        );
        expect(t.total).toBeCloseTo(222, 6);
    });
});

describe('calculateTaxFreeTaxDeferredRoom (tax-smart fill)', () => {
    it('equals the full deduction floor when there is no other taxable income', () => {
        // Age 65+, 2026 floor = 16,100 + 2,050 + 6,000 = 24,150. No SS, no other income →
        // total taxable is just the draw itself, so the room is the whole floor.
        const room = calculateTaxFreeTaxDeferredRoom(0, 0, 0.85, 65, 2026, 1, 'single');
        expect(room).toBeCloseTo(24_150, -1); // within ~$5 (bisection tolerance)
    });

    it('uses the base-only floor before age 65', () => {
        // Age 60, 2026 → base standard deduction 16,100 (no age-65 add, no senior bonus).
        const room = calculateTaxFreeTaxDeferredRoom(0, 0, 0.85, 60, 2026, 1, 'single');
        expect(room).toBeCloseTo(16_100, -1);
    });

    it('drops the senior bonus once it sunsets in 2029', () => {
        // Age 65, 2029 → 16,100 + 2,050 = 18,150 (bonus gone).
        const room = calculateTaxFreeTaxDeferredRoom(0, 0, 0.85, 65, 2029, 1, 'single');
        expect(room).toBeCloseTo(18_150, -1);
    });

    it('returns 0 when other income already fills the floor', () => {
        expect(calculateTaxFreeTaxDeferredRoom(0, 30_000, 0.85, 65, 2026, 1, 'single')).toBe(0);
    });

    it('shrinks the room via the SS "torpedo" feedback', () => {
        // SS $30k, no other income, age 65+, 2026 floor 24,150. Each extra $1 of tax-deferred
        // raises provisional income and drags SS into the taxable base, so the tax-free room
        // is well below the naive 24,150. Closed-form solve gives ≈ $19,351.
        const room = calculateTaxFreeTaxDeferredRoom(30_000, 0, 0.85, 65, 2026, 1, 'single');
        expect(room).toBeCloseTo(19_351, -1);
        expect(room).toBeLessThan(24_150); // strictly less than the no-SS room
    });
});
