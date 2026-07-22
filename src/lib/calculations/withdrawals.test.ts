// src/lib/calculations/withdrawals.test.ts

import { describe, it, expect } from 'vitest';
import {
    executeWithdrawals,
    handleSurplus,
    calculateTotalPortfolio,
    isPortfolioDepleted,
    type AccountBalances,
    type IncomeForTax,
} from './withdrawals';

const noIncome: IncomeForTax = { socialSecurity: 0, pensions: 0, partTimeWork: 0, rentalIncome: 0 };
const priority: Array<'taxable' | 'tax_deferred' | 'roth'> = ['taxable', 'tax_deferred', 'roth'];

describe('portfolio helpers', () => {
    it('calculateTotalPortfolio sums all four account types', () => {
        expect(calculateTotalPortfolio({ taxDeferred: 100, roth: 200, taxable: 300, hsa: 400 })).toBe(1000);
    });

    it('isPortfolioDepleted uses the $100 threshold', () => {
        expect(isPortfolioDepleted({ taxDeferred: 0, roth: 0, taxable: 50, hsa: 0 })).toBe(true);
        expect(isPortfolioDepleted({ taxDeferred: 0, roth: 0, taxable: 150, hsa: 0 })).toBe(false);
    });

    it('handleSurplus reinvests into the taxable account', () => {
        const after = handleSurplus(5000, { taxDeferred: 0, roth: 0, taxable: 1000, hsa: 0 });
        expect(after.taxable).toBe(6000);
    });
});

describe('executeWithdrawals', () => {
    it('covers a cash-flow gap from the first priority account (net ≈ need)', () => {
        const balances: AccountBalances = { taxDeferred: 0, roth: 0, taxable: 500_000, hsa: 0 };
        const r = executeWithdrawals(65, 20_000, balances, 0, false, priority, noIncome, 0.12, 0.85, 0.7);
        const afterTax = r.withdrawals.taxable - r.taxOnWithdrawals;
        expect(afterTax).toBeCloseTo(20_000, 0);
        expect(r.shortfall).toBe(0);
        expect(r.withdrawals.taxDeferred).toBe(0);
    });

    it('forces an RMD from tax-deferred at age 73+ regardless of priority', () => {
        // Taxable is first in priority, but the RMD must still come out of tax-deferred.
        const balances: AccountBalances = { taxDeferred: 1_000_000, roth: 0, taxable: 500_000, hsa: 0 };
        const r = executeWithdrawals(75, 10_000, balances, 0, false, priority, noIncome, 0.12, 0.85, 0.7);
        // RMD at 75 = balance / 24.6.
        expect(r.rmdAmount).toBeCloseTo(1_000_000 / 24.6, 4);
        expect(r.withdrawals.taxDeferred).toBeCloseTo(r.rmdAmount, 4);
        // The RMD dwarfs the $10k need, so the after-tax remainder is reinvested as excess.
        expect(r.rmdExcess).toBeGreaterThan(0);
    });

    it('reports a shortfall when all accounts are exhausted', () => {
        const balances: AccountBalances = { taxDeferred: 0, roth: 0, taxable: 1_000, hsa: 0 };
        const r = executeWithdrawals(65, 50_000, balances, 0, false, priority, noIncome, 0.12, 0.85, 0.7);
        expect(r.shortfall).toBeGreaterThan(0);
    });

    it('spends the HSA on healthcare first, tax-free', () => {
        const balances: AccountBalances = { taxDeferred: 0, roth: 0, taxable: 100_000, hsa: 50_000 };
        const r = executeWithdrawals(70, 8_000, balances, 8_000, false, priority, noIncome, 0.12, 0.85, 0.7);
        expect(r.hsaForHealthcare).toBe(8_000);
        expect(r.updatedBalances.hsa).toBe(42_000);
    });
});
