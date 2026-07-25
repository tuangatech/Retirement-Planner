// src/lib/calculations/expenses.test.ts

import { describe, it, expect } from 'vitest';
import { calculateHealthcareCosts, calculateYearlyExpenses } from './expenses';
import type { PreMedicareCosts, MedicareCosts, RetirementPhase } from '@/types';

// Simple fixtures with a 0% healthcare-inflation default so expected values are exact;
// the inflation test below sets a nonzero rate deliberately.
const PRE_MED: PreMedicareCosts = { monthlyPremium: 1000, annualOutOfPocket: 2000 };
// Medicare monthly = 200 + 50 + 250 = 500 → $6,000/yr premiums.
const MED: MedicareCosts = {
    partBStandardPremium: 200,
    partDPremium: 50,
    medigapPremium: 250,
    expectIRMAA: false,
    irmaaSurcharge: 0,
    outOfPocketByPhase: { phase1: 3000, phase2: 5000, phase3: 8000 },
};
const PHASES: [RetirementPhase, RetirementPhase, RetirementPhase] = [
    { name: 'go_go', startAge: 60, endAge: 74, annualSpending: 60_000 },
    { name: 'slow_go', startAge: 75, endAge: 85, annualSpending: 50_000 },
    { name: 'no_go', startAge: 86, endAge: 95, annualSpending: 40_000 },
];

describe('calculateHealthcareCosts — two-track (MFJ) healthcare', () => {
    it('single filer (no spouseAge): one pre-Medicare track', () => {
        const r = calculateHealthcareCosts(60, 60, PRE_MED, MED, PHASES, 0);
        expect(r.premiums).toBe(12_000);
        expect(r.outOfPocket).toBe(2_000);
        expect(r.total).toBe(14_000);
    });

    it('MFJ, both spouses pre-Medicare: costs exactly double (equal per-person)', () => {
        const r = calculateHealthcareCosts(60, 60, PRE_MED, MED, PHASES, 0, 60);
        expect(r.premiums).toBe(24_000);
        expect(r.outOfPocket).toBe(4_000);
    });

    it('MFJ, mixed timelines: your Medicare track + spouse pre-Medicare track', () => {
        // You 66 (Medicare, go_go phase); spouse 63 (still pre-Medicare).
        const r = calculateHealthcareCosts(66, 60, PRE_MED, MED, PHASES, 0, 63);
        // You: $6,000 premiums + $3,000 OOP (go_go). Spouse: $12,000 + $2,000.
        expect(r.premiums).toBe(18_000);
        expect(r.outOfPocket).toBe(5_000);
    });

    it('inflates each track from its own clock: Medicare from 65, pre-Medicare from retirement', () => {
        // You 70 (Medicare, 5 yrs past 65); spouse 63 (pre-Medicare, 10 calendar yrs since
        // retirement at age 60). Rate 5%.
        const r = calculateHealthcareCosts(70, 60, PRE_MED, MED, PHASES, 0.05, 63);
        const you = 6_000 * 1.05 ** 5 + 3_000 * 1.05 ** 5; // premium + go_go OOP
        const spouse = 12_000 * 1.05 ** 10 + 2_000 * 1.05 ** 10;
        expect(r.total).toBeCloseTo(you + spouse, 4);
    });
});

describe('calculateYearlyExpenses — spouseAge wiring', () => {
    it('passing spouseAge adds the second healthcare track to the total', () => {
        const single = calculateYearlyExpenses(60, 60, PHASES, [], PRE_MED, MED, 0.03, 0);
        const couple = calculateYearlyExpenses(60, 60, PHASES, [], PRE_MED, MED, 0.03, 0, 60);
        expect(couple.healthcarePremiums).toBeCloseTo(single.healthcarePremiums * 2, 4);
        expect(couple.healthcareOutOfPocket).toBeCloseTo(single.healthcareOutOfPocket * 2, 4);
        // Living + one-time are unchanged; only healthcare doubles.
        expect(couple.living).toBe(single.living);
    });
});
