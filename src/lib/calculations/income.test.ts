// src/lib/calculations/income.test.ts

import { describe, it, expect } from 'vitest';
import { calculateYearlyIncome, calculateGovernmentPensionIncome } from './income';
import type { SocialSecurity, PartTimeWork, RentalIncome, Pension } from '@/types';

const primarySS: SocialSecurity = {
    monthlyBenefitAtFRA: 2500,
    claimingAge: 67,
    colaRate: 0.03,
    taxablePercentage: 0.85,
};

const spouseSS: SocialSecurity = {
    monthlyBenefitAtFRA: 1800,
    claimingAge: 67,
    colaRate: 0.03,
    taxablePercentage: 0.85,
};

const noWork: PartTimeWork = { enabled: false, annualIncome: 0, startAge: 62, endAge: 70 };
const noRental: RentalIncome = {
    enabled: false,
    annualNetIncome: 0,
    startAge: 60,
    endAge: null,
    inflationAdjusted: false,
};

describe('calculateYearlyIncome — household Social Security (MFJ)', () => {
    it('single filer: only the primary benefit', () => {
        // Age 67 = FRA, claimed at 67 → 2500·12·1.0 = 30,000.
        const result = calculateYearlyIncome(67, primarySS, [], noWork, noRental, 0.03);
        expect(result.socialSecurity).toBeCloseTo(30000, 6);
    });

    it('MFJ: sums both spouses\' benefits into one stream', () => {
        // Primary 30,000 + spouse (1800·12·1.0) 21,600 = 51,600.
        const result = calculateYearlyIncome(67, primarySS, [], noWork, noRental, 0.03, spouseSS, 67);
        expect(result.socialSecurity).toBeCloseTo(51600, 6);
        expect(result.socialSecurityFull).toBeCloseTo(51600, 6);
    });

    it('MFJ: spouse who has not reached their claiming age adds nothing', () => {
        // spouseAge 64 < claimingAge 67 → spouse benefit 0; only the primary's 30,000.
        const result = calculateYearlyIncome(67, primarySS, [], noWork, noRental, 0.03, spouseSS, 64);
        expect(result.socialSecurity).toBeCloseTo(30000, 6);
    });
});

// The government/private split exists only for New York's source-dependent retirement benefit
// (docs/5-state-tax-model.md §4.5) — no other state distinguishes pension sources.
describe('calculateGovernmentPensionIncome', () => {
    const govPension: Pension = {
        id: '1',
        name: 'NY State Pension',
        monthlyAmount: 1000,
        startAge: 65,
        colaRate: 0,
        isGovernment: true,
    };
    const privatePension: Pension = {
        id: '2',
        name: 'Corp Pension',
        monthlyAmount: 800,
        startAge: 62,
        colaRate: 0,
    };

    it('sums only the pensions flagged isGovernment', () => {
        expect(calculateGovernmentPensionIncome(65, [govPension, privatePension])).toBeCloseTo(12000, 6);
    });

    it('is 0 when no pension is flagged government, including pre-existing pensions with no flag at all', () => {
        expect(calculateGovernmentPensionIncome(65, [privatePension])).toBe(0);
    });

    it('is 0 before the government pension has started', () => {
        expect(calculateGovernmentPensionIncome(64, [govPension])).toBe(0);
    });

    it('never exceeds the total pension income it is a subset of', () => {
        const total = calculateYearlyIncome(65, primarySS, [govPension, privatePension], noWork, noRental, 0.03)
            .pensions;
        expect(calculateGovernmentPensionIncome(65, [govPension, privatePension])).toBeLessThan(total);
    });
});
