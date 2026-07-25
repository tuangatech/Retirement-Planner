// src/lib/calculations/income.test.ts

import { describe, it, expect } from 'vitest';
import { calculateYearlyIncome } from './income';
import type { SocialSecurity, PartTimeWork, RentalIncome } from '@/types';

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
