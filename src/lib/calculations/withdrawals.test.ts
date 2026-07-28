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

    // The state marginal rate is the one state-tax touch point that can be exercised with a
    // nonzero value before Georgia/Virginia ship, so it is tested directly here.
    it('grosses up a tax-deferred draw for state tax as well as federal', () => {
        const balances: AccountBalances = { taxDeferred: 500_000, roth: 0, taxable: 0, hsa: 0 };
        const tdOnly: Array<'taxable' | 'tax_deferred' | 'roth'> = ['tax_deferred', 'taxable', 'roth'];

        const federalOnly = executeWithdrawals(
            65, 20_000, balances, 0, false, tdOnly, noIncome, 0.12, 0.85, 0.7,
            'standard', 2026, 1, 'single', undefined, 65, 75, 0
        );
        const withState = executeWithdrawals(
            65, 20_000, balances, 0, false, tdOnly, noIncome, 0.12, 0.85, 0.7,
            'standard', 2026, 1, 'single', undefined, 65, 75, 0.05
        );

        // No Social Security here and a $24,150 deduction floor at 65 in 2026, so a $20k
        // tax-deferred draw is entirely federally shielded: the federal-only case needs no
        // gross-up at all. (The old flat-rate gross-up drew 20,000 / 0.88 = $22,727 here and
        // leaned on surplus reinvestment to put the excess back.)
        expect(federalOnly.withdrawals.taxDeferred).toBeCloseTo(20_000, 0);

        // A 5% state rate is not shielded by the federal floor, so it does need grossing up:
        // 20,000 / 0.95 = $21,052.63.
        expect(withState.withdrawals.taxDeferred).toBeCloseTo(20_000 / 0.95, 0);
        expect(withState.withdrawals.taxDeferred).toBeGreaterThan(federalOnly.withdrawals.taxDeferred);

        // Both still net the amount actually needed — the point of the gross-up. The solve is
        // iterative rather than closed-form, so it lands within a cent, not to float exactness
        // (the UI only flags a shortfall above $0.50).
        expect(withState.withdrawals.taxDeferred - withState.taxOnWithdrawals).toBeCloseTo(20_000, 0);
        expect(withState.shortfall).toBeCloseTo(0, 1);
    });

    // Regression for the Social Security "tax torpedo" in the gross-up. Sizing a draw at the
    // flat rate ignores that each withdrawn dollar drags up to $0.85 of SS into the taxable
    // base, so the true marginal rate is up to 1.85× the headline rate. Withdrawals came out
    // systematically short in exactly the years SS is being phased in.
    describe('sizes draws against the real marginal rate, not the flat rate', () => {
        const balances: AccountBalances = { taxDeferred: 2_000_000, roth: 0, taxable: 0, hsa: 0 };
        const tdOnly: Array<'taxable' | 'tax_deferred' | 'roth'> = ['tax_deferred', 'taxable', 'roth'];
        // $28,800 of SS, so a draw on top of it pulls SS into tax. Age 67, 2035 → the senior
        // bonus has sunset, leaving a $23,682 floor at this inflation factor.
        const withSS: IncomeForTax = { ...noIncome, socialSecurity: 28_800 };

        /** Net proceeds of the year's draws — must cover the need, or the year spends air. */
        const netOf = (r: ReturnType<typeof executeWithdrawals>) =>
            r.withdrawals.taxDeferred + r.withdrawals.taxable + r.withdrawals.roth - r.taxOnWithdrawals;

        const draw = (need: number, income: IncomeForTax, strategy: 'standard' | 'tax_smart') =>
            executeWithdrawals(
                67, need, balances, 0, false, tdOnly, income, 0.12, 0.85, 0.7,
                strategy, 2035, 1.3048, 'single', undefined, 67, 75, 0
            );

        it('takes exactly the need when the deduction floor shields it entirely', () => {
            // No SS, $10k need, $23,682 floor → no tax, so no gross-up is warranted. The flat
            // rate would have drawn 10,000 / 0.88 = $11,364 and relied on reinvesting the excess.
            const r = draw(10_000, noIncome, 'standard');
            expect(r.withdrawals.taxDeferred).toBeCloseTo(10_000, 0);
            expect(r.taxOnWithdrawals).toBeCloseTo(0, 0);
        });

        it('nets the need exactly when the draw crosses the SS phase-in', () => {
            // Part of the $30k draw is shielded by the floor and part lands in the torpedo, so
            // the blended rate is 9.2% — neither the flat 12% nor the marginal 22.2%. Getting
            // this right is the whole point: the year covers its bill without over-drawing.
            const r = draw(30_000, withSS, 'standard');
            expect(r.withdrawals.taxDeferred).toBeCloseTo(33_032, 0);
            expect(netOf(r)).toBeCloseTo(30_000, 0);
        });

        it('reaches the same total whether or not the tax-smart fill splits the draw', () => {
            // The fill changes which dollars are nominally "free", not what the year owes — so
            // the total must agree. Under the flat-rate gross-up it did not: the fill's dollars
            // stopped being shielded once STEP 2 pulled SS into tax, and nothing paid for it.
            expect(draw(30_000, withSS, 'tax_smart').withdrawals.taxDeferred)
                .toBeCloseTo(draw(30_000, withSS, 'standard').withdrawals.taxDeferred, 0);
        });

        it('settles back to the headline rate once SS is capped at 85%', () => {
            // A $200k need runs past the phase-in, where each further dollar is taxed at 12%
            // again, so the blended rate lands just above 12%.
            const r = draw(200_000, withSS, 'standard');
            expect(netOf(r)).toBeCloseTo(200_000, 0);
            const blendedRate = r.taxOnWithdrawals / r.withdrawals.taxDeferred;
            expect(blendedRate).toBeGreaterThan(0.12);
            expect(blendedRate).toBeLessThan(0.13);
        });
    });

    // Regression: the tax-smart fill is sized to the FEDERAL deduction floor, so its federal
    // tax is ~0 — but a state applies its own, smaller shield. Treating the fill as net = gross
    // left the year short by the state tax on it every single year.
    it('charges state tax on the tax-smart fill, which the federal floor does not shield', () => {
        const balances: AccountBalances = { taxDeferred: 500_000, roth: 0, taxable: 0, hsa: 0 };
        const args = [60, 20_000, balances, 0, false, priority, noIncome, 0.12, 0.85, 0.7] as const;

        const federalOnly = executeWithdrawals(
            ...args, 'tax_smart', 2026, 1, 'single', undefined, 60, 75, 0
        );
        const withState = executeWithdrawals(
            ...args, 'tax_smart', 2026, 1, 'single', undefined, 60, 75, 0.0499
        );

        // At 60 the floor is the $16,100 base deduction, so both fill $16,100 first, then
        // top up from tax-deferred at the combined marginal rate.
        //   federal only: 16,100 + 3,900/0.88   = $20,531.82
        //   with GA:      16,100 + 4,703.39/0.8301 = $21,765.93
        // Before the fix the state case drew only $20,798 — $968 short of covering the year.
        expect(federalOnly.withdrawals.taxDeferred).toBeCloseTo(20_531.8, 0);
        expect(withState.withdrawals.taxDeferred).toBeCloseTo(21_765.9, 0);

        // The invariant that matters: each still nets exactly the $20,000 the year needed.
        expect(federalOnly.withdrawals.taxDeferred - federalOnly.taxOnWithdrawals).toBeCloseTo(20_000, 0);
        expect(withState.withdrawals.taxDeferred - withState.taxOnWithdrawals).toBeCloseTo(20_000, 0);
    });

    it('leaves withdrawals unchanged when the state marginal rate is 0', () => {
        const balances: AccountBalances = { taxDeferred: 500_000, roth: 0, taxable: 0, hsa: 0 };
        const args = [65, 20_000, balances, 0, false, priority, noIncome, 0.12, 0.85, 0.7] as const;
        const withoutArg = executeWithdrawals(...args);
        const withZero = executeWithdrawals(
            ...args, 'standard', 2026, 1, 'single', undefined, 65, 73, 0
        );
        expect(withZero.withdrawals).toEqual(withoutArg.withdrawals);
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

    it('MFJ: forces the RMD off the older spouse (rmdAge) even when the primary is under 73', () => {
        // Primary is 65 (no RMD of their own), but the older spouse is 75, so the pooled
        // tax-deferred RMD must still come out — keyed to rmdAge = 75.
        const balances: AccountBalances = { taxDeferred: 1_000_000, roth: 0, taxable: 500_000, hsa: 0 };
        const r = executeWithdrawals(
            65, 10_000, balances, 0, false, priority, noIncome, 0.12, 0.85, 0.7,
            'standard', 2026, 1, 'married_joint', 75, 75,
        );
        expect(r.rmdAmount).toBeCloseTo(1_000_000 / 24.6, 4);
        expect(r.withdrawals.taxDeferred).toBeCloseTo(r.rmdAmount, 4);
    });
});

describe('executeWithdrawals — tax-smart sequencing', () => {
    const balances = (): AccountBalances => ({ taxDeferred: 500_000, roth: 0, taxable: 500_000, hsa: 0 });

    it("'standard' (default) does NOT pre-fill tax-deferred — taxable covers the gap", () => {
        // Age 60 gap year, big need. Default strategy = 'standard'.
        const r = executeWithdrawals(60, 40_000, balances(), 0, false, priority, noIncome, 0.12, 0.85, 0.7);
        expect(r.withdrawals.taxDeferred).toBe(0);
        expect(r.withdrawals.taxable).toBeGreaterThan(0);
    });

    it('tax_smart fills tax-deferred up to the standard-deduction floor, then taxable', () => {
        // Age 60, 2026 → base floor 16,100 (no SS/other income). Need ($40k) exceeds the room,
        // so the fill maxes at the floor and the remainder comes from taxable.
        const r = executeWithdrawals(
            60, 40_000, balances(), 0, false, priority, noIncome, 0.12, 0.85, 0.7,
            'tax_smart', 2026, 1, 'single',
        );
        expect(r.withdrawals.taxDeferred).toBeCloseTo(16_100, -1);
        expect(r.withdrawals.taxable).toBeGreaterThan(0);   // remainder from taxable
        // The tax-deferred fill itself is tax-free; the only tax here is the small gains
        // tax on the taxable remainder (~$44k gross × 30% gain × 12% ≈ under $1k).
        expect(r.taxOnWithdrawals).toBeLessThan(1_000);
    });

    it('caps the fill at the spending need (never draws beyond it — that is the Roth tier)', () => {
        // Need ($5k) is below the room ($16.1k), so only $5k is pulled and taxable is untouched.
        const r = executeWithdrawals(
            60, 5_000, balances(), 0, false, priority, noIncome, 0.12, 0.85, 0.7,
            'tax_smart', 2026, 1, 'single',
        );
        expect(r.withdrawals.taxDeferred).toBeCloseTo(5_000, -1);
        expect(r.withdrawals.taxable).toBeCloseTo(0, -1);
    });

    it('caps the fill at the available tax-deferred balance', () => {
        const b: AccountBalances = { taxDeferred: 3_000, roth: 0, taxable: 500_000, hsa: 0 };
        const r = executeWithdrawals(
            60, 40_000, b, 0, false, priority, noIncome, 0.12, 0.85, 0.7,
            'tax_smart', 2026, 1, 'single',
        );
        expect(r.withdrawals.taxDeferred).toBeCloseTo(3_000, -1);
    });

    it('counts a forced RMD toward the room (fill only tops up to the floor)', () => {
        // Age 75, need large enough that the RMD does NOT cover it (no early return), so the
        // fill step runs. RMD = 500k / 24.6 ≈ 20,325, floor = 24,150 → the fill only adds the
        // ~3,825 gap, leaving total tax-deferred exactly at the floor.
        const r = executeWithdrawals(
            75, 200_000, balances(), 0, false, priority, noIncome, 0.12, 0.85, 0.7,
            'tax_smart', 2026, 1, 'single',
        );
        expect(r.rmdAmount).toBeCloseTo(500_000 / 24.6, 0);
        expect(r.withdrawals.taxDeferred).toBeCloseTo(24_150, -1);
    });
});
