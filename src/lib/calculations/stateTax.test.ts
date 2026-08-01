// src/lib/calculations/stateTax.test.ts

import { describe, it, expect } from 'vitest';
import { computeStateTax, computeStateTaxDetailed, stateTaxDisclosure, type StateTaxInputs } from './stateTax';
import type { USState } from '@/types';
import {
    getStateTaxRules,
    isStateModeled,
    modeledStates,
    STATE_RULES_REVIEWED_FOR,
} from './stateTaxRules';
import { US_STATES } from '@/lib/constants';

/** A year with income in every category, so a zero result can't come from zero income. */
const INPUTS: StateTaxInputs = {
    year: 2026,
    filingStatus: 'single',
    age: 62,
    governmentPensionIncome: 0,
    privatePensionIncome: 18000,
    partTimeWork: 12000,
    rentalIncome: 9000,
    taxDeferredWithdrawals: 40000,
    brokerageGains: 6000,
    hsaNonMedicalWithdrawals: 3000,
};

/** The nine states with no individual income tax for TY2026 (docs/5-state-tax-model.md §1). */
const NO_INCOME_TAX_STATES = ['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY'] as const;

/** Georgia tax for `INPUTS` with the given fields replaced. */
function gaTax(overrides: Partial<StateTaxInputs> = {}): number {
    return computeStateTax(getStateTaxRules('GA'), { ...INPUTS, ...overrides }).tax;
}

/** Virginia tax for `INPUTS` with the given fields replaced. */
function vaTax(overrides: Partial<StateTaxInputs> = {}): number {
    return computeStateTax(getStateTaxRules('VA'), { ...INPUTS, ...overrides }).tax;
}

/** California tax for `INPUTS` with the given fields replaced. */
function caTax(overrides: Partial<StateTaxInputs> = {}): number {
    return computeStateTax(getStateTaxRules('CA'), { ...INPUTS, ...overrides }).tax;
}

/** New York tax for `INPUTS` with the given fields replaced. */
function nyTax(overrides: Partial<StateTaxInputs> = {}): number {
    return computeStateTax(getStateTaxRules('NY'), { ...INPUTS, ...overrides }).tax;
}

/**
 * Average state rate over $1,000 more tax-deferred withdrawal.
 *
 * This is what the withdrawal gross-up consumes — it evaluates `computeStateTax` at the draw it
 * is testing rather than multiplying by a rate — so the rate is measured the same way here
 * instead of being asserted from per-state algebra the engine does not use.
 */
function marginalRate(state: USState, overrides: Partial<StateTaxInputs> = {}): number {
    const rules = getStateTaxRules(state);
    const base = { ...INPUTS, ...overrides };
    const taxAt = (extra: number): number =>
        computeStateTax(rules, {
            ...base,
            taxDeferredWithdrawals: base.taxDeferredWithdrawals + extra,
        }).tax;
    return (taxAt(1000) - taxAt(0)) / 1000;
}

/** Only Georgia-eligible income, so the exclusion is the only thing under test. */
const PENSION_ONLY: Partial<StateTaxInputs> = {
    partTimeWork: 0,
    rentalIncome: 0,
    taxDeferredWithdrawals: 0,
    brokerageGains: 0,
    hsaNonMedicalWithdrawals: 0,
};

describe('computeStateTax', () => {
    it.each(NO_INCOME_TAX_STATES)('%s owes $0 and is reported as modeled', (state) => {
        const result = computeStateTax(getStateTaxRules(state), INPUTS);
        expect(result.tax).toBe(0);
        expect(result.modeled).toBe(true);
    });

    it('reports an unmodeled state as not modeled, so the UI does not claim otherwise', () => {
        // NJ is deliberately deferred — the user's marginal rate carries its burden.
        const result = computeStateTax(getStateTaxRules('NJ'), INPUTS);
        expect(result.tax).toBe(0);
        expect(result.modeled).toBe(false);
    });

    it('treats undefined rules as not modeled rather than throwing', () => {
        expect(computeStateTax(undefined, INPUTS)).toEqual({ tax: 0, modeled: false });
    });
});

describe('computeStateTaxDetailed', () => {
    it('agrees with computeStateTax on the final tax and modeled flag for every modeled state', () => {
        for (const state of modeledStates()) {
            const rules = getStateTaxRules(state);
            const detail = computeStateTaxDetailed(rules, INPUTS);
            const result = computeStateTax(rules, INPUTS);
            expect(detail.tax).toBeCloseTo(result.tax, 8);
            expect(detail.modeled).toBe(result.modeled);
        }
    });

    it('reports a real AGI even for a no-income-tax state', () => {
        const detail = computeStateTaxDetailed(getStateTaxRules('FL'), INPUTS);
        expect(detail.agi).toBe(88000);
        expect(detail.benefit).toBe(0);
        expect(detail.tax).toBe(0);
        expect(detail.modeled).toBe(true);
    });

    it("breaks down Georgia's exclusion and taxable income", () => {
        const detail = computeStateTaxDetailed(getStateTaxRules('GA'), INPUTS);
        expect(detail.agi).toBe(88000);
        expect(detail.benefit).toBe(35000); // age-62 tier, capped well below the $78,000 eligible
        expect(detail.standardDeduction).toBe(15000);
        expect(detail.taxableIncome).toBe(38000);
        expect(detail.tax).toBeCloseTo(38000 * 0.0499, 6);
    });

    it("breaks down New York's source-scoped pension exclusion", () => {
        const detail = computeStateTaxDetailed(getStateTaxRules('NY'), {
            ...INPUTS,
            age: 68,
            governmentPensionIncome: 10000,
            privatePensionIncome: 5000,
        });
        // Government pension is fully exempt; private (5,000) + tax-deferred (40,000) = 45,000
        // eligible, capped at $20,000 for one qualifying person.
        expect(detail.benefit).toBe(10000 + 20000);
    });

    it('reports zero detail without throwing when rules are undefined', () => {
        expect(computeStateTaxDetailed(undefined, INPUTS)).toEqual({
            agi: 88000,
            benefit: 0,
            standardDeduction: 0,
            personalExemption: 0,
            taxableIncome: 0,
            credit: 0,
            surtax: 0,
            tax: 0,
            modeled: false,
        });
    });
});

// AGI for INPUTS = 18k pensions + 12k work + 9k rental + 40k tax-deferred + 6k gains
// + 3k non-medical HSA = $88,000. Social Security never enters (every modeled state
// exempts it), which is why StateTaxInputs has no SS field at all.
describe('computeStateTax — Georgia', () => {
    it('taxes AGI above the exclusion and standard deduction at the flat rate', () => {
        // Age 62 → $35,000 exclusion; $15,000 standard deduction.
        // (88,000 − 35,000 − 15,000) × 4.99% = $1,896.20
        expect(gaTax()).toBeCloseTo(1896.2, 2);
    });

    it('gives no exclusion before age 62 — the state bill is front-loaded into the gap years', () => {
        // (88,000 − 0 − 15,000) × 4.99% = $3,642.70, nearly double the age-62 bill.
        expect(gaTax({ age: 61 })).toBeCloseTo(3642.7, 2);
        expect(gaTax({ age: 61 })).toBeGreaterThan(gaTax({ age: 62 }));
    });

    it('steps the exclusion up at 65 and again in TY2027, per HB 463', () => {
        // 65+ in 2026: (88,000 − 65,000 − 15,000) × 4.99% = $399.20
        expect(gaTax({ age: 65 })).toBeCloseTo(399.2, 2);
        // TY2027 raises 65+ to $70,000 — unconditional in the bill, so it is modeled.
        expect(gaTax({ age: 65, year: 2027 })).toBeCloseTo(149.7, 2);
        // The 62–64 tier does not move in 2027.
        expect(gaTax({ age: 63, year: 2027 })).toBeCloseTo(gaTax({ age: 63 }), 6);
    });

    it('holds the frozen TY2026 constants for later years — contingent cuts are not modeled', () => {
        // Only the exclusion steps in 2027; rate and deduction stay put (docs §2 Rule 1).
        expect(gaTax({ age: 61, year: 2040 })).toBeCloseTo(gaTax({ age: 61 }), 6);
    });

    it('caps the exclusion at eligible income, so it cannot shelter other income', () => {
        // $30k non-medical HSA is not an enumerated GA category, so only the $20k
        // tax-deferred draw is eligible: (50,000 − 20,000 − 15,000) × 4.99% = $748.50.
        // Were HSA income eligible, the exclusion would cover the whole $50k and tax $0.
        const tax = gaTax({
            age: 65,
            privatePensionIncome: 0,
            partTimeWork: 0,
            rentalIncome: 0,
            brokerageGains: 0,
            taxDeferredWithdrawals: 20000,
            hsaNonMedicalWithdrawals: 30000,
        });
        expect(tax).toBeCloseTo(748.5, 2);
    });

    it('counts at most $5,000 of earned income toward the exclusion (IT-511 sublimit)', () => {
        // $40k of wages, all of it in AGI but only $5k excludable:
        // (40,000 − 5,000 − 15,000) × 4.99% = $998.00. Without the sublimit: $0.
        const tax = gaTax({
            age: 65,
            privatePensionIncome: 0,
            rentalIncome: 0,
            taxDeferredWithdrawals: 0,
            brokerageGains: 0,
            hsaNonMedicalWithdrawals: 0,
            partTimeWork: 40000,
        });
        expect(tax).toBeCloseTo(998, 2);
    });

    it('MFJ takes two exclusions and the joint deduction', () => {
        const mfj: Partial<StateTaxInputs> = {
            ...PENSION_ONLY,
            filingStatus: 'married_joint',
            age: 66,
            spouseAge: 66,
            privatePensionIncome: 200000,
        };
        // 2 × $65,000 exclusion + $30,000 joint deduction → $40,000 taxable = $1,996.00
        expect(gaTax(mfj)).toBeCloseTo(1996, 2);
        // A single filer with the same income gets one exclusion and half the deduction.
        expect(gaTax({ ...mfj, filingStatus: 'single', spouseAge: undefined })).toBeCloseTo(5988, 2);
    });

    it('MFJ counts each spouse against their own age tier', () => {
        // Spouse is 60, so only the primary's $65,000 exclusion applies:
        // (200,000 − 65,000 − 30,000) × 4.99% = $5,239.50
        const tax = gaTax({
            ...PENSION_ONLY,
            filingStatus: 'married_joint',
            age: 66,
            spouseAge: 60,
            privatePensionIncome: 200000,
        });
        expect(tax).toBeCloseTo(5239.5, 2);
    });

    it('owes nothing when AGI is inside the exclusion plus deduction', () => {
        expect(gaTax({ ...PENSION_ONLY, age: 65, privatePensionIncome: 12000 })).toBe(0);
    });

    // docs/2-federal-tax-model.md's verified reference: a GA couple both 65+ with $80,400
    // gross — $43,200 of it Social Security — owing $0 Georgia tax. SS is exempt, and the
    // remaining $37,200 sits entirely inside their exclusion.
    it('owes $0 for the documented Georgia zero-tax-bill couple', () => {
        const tax = gaTax({
            ...PENSION_ONLY,
            filingStatus: 'married_joint',
            age: 66,
            spouseAge: 66,
            privatePensionIncome: 37200,
        });
        expect(tax).toBe(0);
    });
});

describe('Virginia', () => {
    // Every figure below is hand-derived from §4.3 of docs/5-state-tax-model.md:
    //   taxable = AGI − ageDeduction − standardDeduction − exemptions, then the bracket schedule.
    // TY2026 constants: deduction $8,750/$17,500, exemption $930/filer + $800 per filer 65+.

    it('gives the full $12,000 age deduction below the phase-out threshold', () => {
        // 40,000 − 12,000 − 8,750 − 1,730 = 17,520 → 720 + 520 × 5.75%
        expect(vaTax({ ...PENSION_ONLY, age: 67, privatePensionIncome: 40000 })).toBeCloseTo(749.9, 2);
    });

    it('gives no age deduction before 65 — Virginia has no other retiree benefit', () => {
        // 40,000 − 8,750 − 930 = 30,320 → 720 + 13,320 × 5.75%. Nearly double the age-67 bill
        // on identical income: the benefit is keyed to 65, not to retiring.
        expect(vaTax({ ...PENSION_ONLY, age: 64, privatePensionIncome: 40000 })).toBeCloseTo(1485.9, 2);
    });

    it('phases the age deduction out $1 per $1 above $50,000 for a single filer', () => {
        // AFAGI 60,000 → deduction 12,000 − 10,000 = 2,000.
        expect(vaTax({ ...PENSION_ONLY, age: 67, privatePensionIncome: 60000 })).toBeCloseTo(2474.9, 2);
    });

    it('exhausts the age deduction $12,000 above the threshold', () => {
        // AFAGI 62,000 = 50,000 + 12,000 → deduction 0, and it cannot go negative.
        expect(vaTax({ ...PENSION_ONLY, age: 67, privatePensionIncome: 62000 })).toBeCloseTo(2704.9, 2);
        expect(vaTax({ ...PENSION_ONLY, age: 67, privatePensionIncome: 70000 })).toBeCloseTo(3164.9, 2);
    });

    it('owes nothing below the filing threshold, where the deduction alone would still bill tax', () => {
        // $11,000 clears deduction + exemption ($9,680) so the schedule would compute $26.40,
        // but § 58.1-321 imposes no tax under $11,950 of VAGI.
        expect(vaTax({ ...PENSION_ONLY, age: 64, privatePensionIncome: 11000 })).toBe(0);
        // $1 over the deduction+exemption and still under the threshold — still nothing.
        expect(vaTax({ ...PENSION_ONLY, age: 64, privatePensionIncome: 11949 })).toBe(0);
        expect(vaTax({ ...PENSION_ONLY, age: 64, privatePensionIncome: 11950 })).toBeGreaterThan(0);
    });

    it('walks the 2% / 3% / 5% brackets, not just the top rate', () => {
        // taxable 4,000 → 3,000 × 2% + 1,000 × 3% = 90
        expect(vaTax({ ...PENSION_ONLY, age: 64, privatePensionIncome: 4000 + 8750 + 930 })).toBeCloseTo(90, 2);
        // taxable 10,000 → 60 + 60 + 5,000 × 5% = 370
        expect(vaTax({ ...PENSION_ONLY, age: 64, privatePensionIncome: 10000 + 8750 + 930 })).toBeCloseTo(370, 2);
    });

    it('reduces to 5.75% less a fixed $257.50 in the top bracket', () => {
        // The doc's shortcut for sanity-checking any realistic retiree, re-derived here from the
        // statute rather than from the bracket walk: 720 + 5.75%(T − 17,000) ≡ 5.75%T − 257.50.
        for (const privatePensionIncome of [45000, 90000, 150000]) {
            const ageDeduction = Math.max(0, 12000 - Math.max(0, privatePensionIncome - 50000));
            const taxable = privatePensionIncome - ageDeduction - 8750 - 1730;
            expect(taxable).toBeGreaterThan(17000);
            expect(vaTax({ ...PENSION_ONLY, age: 67, privatePensionIncome })).toBeCloseTo(
                taxable * 0.0575 - 257.5,
                2
            );
        }
    });

    it('models the 2030 standard-deduction reversion, which raises the bill on flat income', () => {
        const income = { ...PENSION_ONLY, age: 67, privatePensionIncome: 40000 } as const;
        // $8,750 through 2026, $9,200 in 2027, $9,300 for 2028–2029, then $3,000 from 2030.
        expect(vaTax({ ...income, year: 2026 })).toBeCloseTo(749.9, 2);
        expect(vaTax({ ...income, year: 2027 })).toBeCloseTo(724.025, 2);
        expect(vaTax({ ...income, year: 2029 })).toBeCloseTo(718.5, 2);
        expect(vaTax({ ...income, year: 2030 })).toBeCloseTo(1080.525, 2);
        // The cliff costs this retiree $362.03 a year on unchanged income — a 50% jump, and the
        // single most questionable number the Virginia model produces (see the rules `caveat`).
        expect(vaTax({ ...income, year: 2030 }) - vaTax({ ...income, year: 2029 }))
            .toBeCloseTo(362.025, 2);
    });

    it('MFJ: pools a $24,000 cap and means-tests it on combined income', () => {
        // Both 67: cap 24,000, AFAGI 80,000 → 24,000 − 5,000 = 19,000 deduction;
        // deduction 17,500; exemptions 930×2 + 800×2 = 3,460 → taxable 40,040.
        expect(
            vaTax({
                ...PENSION_ONLY,
                filingStatus: 'married_joint',
                age: 67,
                spouseAge: 67,
                privatePensionIncome: 80000,
            })
        ).toBeCloseTo(2044.8, 2);
    });

    it('MFJ: counts only the spouses who have actually turned 65', () => {
        // One spouse 67, one 62 → cap 12,000, and only one $800 age addition.
        expect(
            vaTax({
                ...PENSION_ONLY,
                filingStatus: 'married_joint',
                age: 67,
                spouseAge: 62,
                privatePensionIncome: 80000,
            })
        ).toBeCloseTo(2780.8, 2);
    });

    it('MFJ: the means test is on combined income, so it needs no per-spouse attribution', () => {
        // Unlike Georgia's per-person exclusion, splitting the same household income between the
        // spouses cannot change the answer — the statute pools it. Pooled accounts are therefore
        // exact here rather than an approximation.
        const both = {
            ...PENSION_ONLY,
            filingStatus: 'married_joint' as const,
            age: 67,
            spouseAge: 67,
        };
        expect(vaTax({ ...both, privatePensionIncome: 80000 })).toBeCloseTo(
            vaTax({ ...both, privatePensionIncome: 30000, taxDeferredWithdrawals: 50000 }),
            2
        );
    });

    it('taxes a non-medical HSA draw that Georgia would exclude', () => {
        // Virginia has no income-type scoping at all: the age deduction is a means test, so every
        // dollar of AGI counts the same. The GA suite asserts the opposite for the same input.
        const withHSA = { ...PENSION_ONLY, age: 67, privatePensionIncome: 40000, hsaNonMedicalWithdrawals: 10000 };
        expect(vaTax(withHSA)).toBeGreaterThan(vaTax({ ...PENSION_ONLY, age: 67, privatePensionIncome: 40000 }));
    });
});

// California has no age-tiered exclusion or age deduction at all — ordinary income is ordinary
// income. Its complexity is structural instead: brackets vary by filing status, the personal/
// senior exemption is a CREDIT subtracted from tax rather than a deduction from taxable income,
// and a 1% surtax applies above $1,000,000 of taxable income (docs/5-state-tax-model.md §4.4).
describe('computeStateTax — California', () => {
    it('taxes AGI above the standard deduction through the single bracket schedule', () => {
        // AGI $88,000 − $5,706 standard deduction = $82,294 taxable, landing in the 9.3% bracket.
        // Bracket tax $4,091.98 − $168 exemption credit (not 65) = $3,923.98.
        expect(caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 88000 })).toBeCloseTo(3923.98, 2);
    });

    it('uses the married bracket schedule and doubles the exemption credit, not the single one', () => {
        // Same $88,000 AGI, but married brackets are wider and the credit doubles to $336.
        expect(
            caTax({
                ...PENSION_ONLY,
                filingStatus: 'married_joint',
                age: 62,
                spouseAge: 60,
                privatePensionIncome: 88000,
            })
        ).toBeCloseTo(1455.38, 2);
    });

    it('adds the age-65 credit addition per qualifying spouse, on top of the base credit', () => {
        expect(caTax({ ...PENSION_ONLY, age: 65, privatePensionIncome: 88000 })).toBeCloseTo(3755.98, 2);
        expect(
            caTax({
                ...PENSION_ONLY,
                filingStatus: 'married_joint',
                age: 66,
                spouseAge: 67,
                privatePensionIncome: 88000,
            })
        ).toBeCloseTo(1119.38, 2);
    });

    it('owes $0 below the standard deduction — the credit cannot make tax negative', () => {
        expect(caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 5000 })).toBe(0);
    });

    // R&TC §17054: the credit shrinks $6 (single) per $2,500 of state AGI over the threshold,
    // floored at $0 — a step function, not Virginia's smooth dollar-for-dollar phase-out.
    describe('exemption credit phase-out', () => {
        it('applies no reduction at or below the threshold', () => {
            expect(caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 252203 })).toBeCloseTo(19194.86, 2);
        });

        it('reduces the credit by one $6 increment for $1 over the threshold', () => {
            // Crossing the line costs $6 of credit — i.e. the bill jumps $6 more than the
            // bracket tax on that single extra dollar alone would predict.
            const at = (privatePensionIncome: number) => caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome });
            expect(at(252204) - at(252203)).toBeCloseTo(0.093 + 6, 2);
        });

        it('floors the credit at $0 once fully phased out, rather than going negative', () => {
            // $252,203 + 40 x $2,500 fully exhausts the $168 credit (40 x $6 = $240 > $168).
            expect(caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 350000 })).toBeCloseTo(28457.98, 2);
        });
    });

    // Prop 63 / FTB Form 540-ES: the $1,000,000 threshold does NOT double for joint filers —
    // a real marriage penalty, and the reason it is tested explicitly rather than assumed.
    describe('Behavioral Health Services Tax (formerly Mental Health Services Tax)', () => {
        it('adds 1% of taxable income above $1,000,000', () => {
            expect(caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 1050000 })).toBeCloseTo(109727.71, 2);
        });

        it('owes no surtax for two singles who would each owe it if their income were combined', () => {
            const eachAlone = caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 525000 });
            const combinedMarried = caTax({
                ...PENSION_ONLY,
                filingStatus: 'married_joint',
                age: 62,
                spouseAge: 60,
                privatePensionIncome: 1050000,
            });
            // $525,000 each: neither individually crosses $1,000,000 taxable, so no surtax.
            expect(eachAlone).toBeCloseTo(46946.36, 2);
            // The same combined income filed jointly crosses the UNDOUBLED $1,000,000 line.
            expect(combinedMarried).toBeCloseTo(94278.6, 2);
            expect(combinedMarried).toBeGreaterThan(eachAlone * 2);
        });

        it('is not reduced by the exemption credit — it is added after', () => {
            // At $1,050,000 the credit is fully phased out anyway (agi far past $252,203), so
            // this pins the ordering: surtax sits outside the max(0, bracketTax − credit) floor.
            const withSurtax = caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 1050000 });
            const withoutSurtaxIncome = caTax({ ...PENSION_ONLY, age: 62, privatePensionIncome: 1000000 });
            expect(withSurtax).toBeGreaterThan(withoutSurtaxIncome);
        });
    });
});

// New York's benefit-recapture surtax is resolved into extra bracket rows rather than a
// separate mechanism (docs/5-state-tax-model.md §4.5), so its complexity is in the retirement
// benefit instead: government pensions are fully exempt with no cap, private pension/annuity/IRA
// income gets a $20,000-per-person exclusion (age 59½, modeled as 60), and the two are not
// poolable across spouses. All figures below are independently computed via a Python reference
// script against the same committed bracket constants, not hand-derived.
describe('computeStateTax — New York', () => {
    it('taxes AGI above the standard deduction through the single bracket schedule when no exclusion applies', () => {
        // Age 55: no exclusion at all. AGI $88,000 − $8,000 standard deduction = $80,000 taxable.
        expect(nyTax({ age: 55, privatePensionIncome: 18000 })).toBeCloseTo(4155, 2);
    });

    it('fully exempts a government pension, no cap and no age test', () => {
        expect(
            nyTax({ ...PENSION_ONLY, age: 55, governmentPensionIncome: 50000, privatePensionIncome: 0 })
        ).toBe(0);
        expect(
            nyTax({ ...PENSION_ONLY, age: 70, governmentPensionIncome: 50000, privatePensionIncome: 0 })
        ).toBe(0);
    });

    it('excludes private pension income up to $20,000 once age-eligible', () => {
        // $15,000 sits entirely under the cap.
        expect(nyTax({ ...PENSION_ONLY, age: 60, privatePensionIncome: 15000 })).toBe(0);
        // $30,000 is capped at the $20,000 exclusion: (30,000 − 20,000 − 8,000) × 3.9% = $78.
        expect(nyTax({ ...PENSION_ONLY, age: 60, privatePensionIncome: 30000 })).toBeCloseTo(78, 2);
    });

    it('gives no private-source exclusion before the modeled age of 60', () => {
        // Same $30,000, one year younger: (30,000 − 8,000) × brackets = $1,023.
        expect(nyTax({ ...PENSION_ONLY, age: 59, privatePensionIncome: 30000 })).toBeCloseTo(1023, 2);
    });

    it('pools tax-deferred withdrawals into the same $20,000 cap as private pension income', () => {
        // $10,000 pension + $15,000 tax-deferred = $25,000 eligible, capped at $20,000 →
        // (25,000 − 20,000 − 8,000) is negative, so $0 tax — the exclusion still covers it all.
        expect(
            nyTax({ ...PENSION_ONLY, age: 61, privatePensionIncome: 10000, taxDeferredWithdrawals: 15000 })
        ).toBe(0);
    });

    it('MFJ: two qualifying spouses each get their own $20,000 exclusion', () => {
        // Both 62: $50,000 − $40,000 (2×$20,000) − $16,050 joint deduction is negative → $0.
        expect(
            nyTax({
                ...PENSION_ONLY,
                filingStatus: 'married_joint',
                age: 62,
                spouseAge: 62,
                privatePensionIncome: 50000,
            })
        ).toBe(0);
    });

    it('MFJ: only the spouse who has actually turned 60 gets an exclusion', () => {
        // One $20,000 exclusion: (50,000 − 20,000 − 16,050) × brackets = $588.30.
        expect(
            nyTax({
                ...PENSION_ONLY,
                filingStatus: 'married_joint',
                age: 62,
                spouseAge: 55,
                privatePensionIncome: 50000,
            })
        ).toBeCloseTo(588.3, 2);
    });

    it('owes $0 below the standard deduction', () => {
        expect(nyTax({ ...PENSION_ONLY, age: 55, taxDeferredWithdrawals: 5000, privatePensionIncome: 0 })).toBe(0);
    });

    // The benefit-recapture surtax, resolved into extra bracket rows (§4.5) — reachable at an
    // entirely ordinary retirement income level, unlike California's $1,000,000 surtax line.
    describe('benefit-recapture bracket rows above $107,650 of taxable income', () => {
        it('taxes exactly the published cumulative amount at the recapture zone boundaries', () => {
            // No exclusion (age 55), so AGI − $8,000 lands taxable exactly on each boundary.
            expect(
                nyTax({ ...PENSION_ONLY, age: 55, taxDeferredWithdrawals: 107650 + 8000, privatePensionIncome: 0 })
            ).toBeCloseTo(5905.71, 2);
            expect(
                nyTax({ ...PENSION_ONLY, age: 55, taxDeferredWithdrawals: 157650 + 8000, privatePensionIncome: 0 })
            ).toBeCloseTo(9670.71, 2);
        });

        it('a dollar earned inside the recapture zone is taxed above the ordinary bracket rate', () => {
            // $130,000 taxable sits inside the 7.53% recapture row, well above the 5.90% rate
            // just below the zone — the mechanism this section models is real, not a rounding
            // artifact.
            const inZone = nyTax({
                ...PENSION_ONLY, age: 55, taxDeferredWithdrawals: 130000 + 8000, privatePensionIncome: 0,
            });
            expect(inZone).toBeCloseTo(7588.66, 2);
        });
    });
});

// What the withdrawal gross-up actually depends on. A state's marginal rate is NOT its headline
// rate, and it is not even constant across one year's draw — which is why `executeWithdrawals`
// takes the whole state formula as a function (docs/5-state-tax-model.md §3).
describe('marginal rate on the next dollar of withdrawal', () => {
    it('is 0 for states with no income tax, so the gross-up is unchanged', () => {
        expect(marginalRate('TX')).toBe(0);
    });

    it('GA: is the flat rate once the exclusion is exhausted', () => {
        // $100k of pension income uses up the whole $65,000 exclusion, so the next
        // tax-deferred dollar is taxed outright.
        expect(marginalRate('GA', { ...PENSION_ONLY, age: 65, privatePensionIncome: 100000 })).toBeCloseTo(0.0499, 6);
    });

    it('GA: is 0 while exclusion room remains, even though tax is already owed', () => {
        // The withdrawal creates its own exclusion room dollar-for-dollar, so it is free at the
        // margin. This is why "past the deduction ⇒ 4.99%" is wrong: it would over-gross-up
        // every draw here.
        const inputs = {
            ...PENSION_ONLY,
            age: 65,
            privatePensionIncome: 40000,
            hsaNonMedicalWithdrawals: 30000,
        };
        expect(gaTax(inputs)).toBeGreaterThan(0);
        expect(marginalRate('GA', inputs)).toBe(0);
    });

    it('GA: is the flat rate before 62, when there is no exclusion to grow', () => {
        expect(marginalRate('GA', { ...PENSION_ONLY, age: 61, privatePensionIncome: 20000 })).toBeCloseTo(0.0499, 6);
    });

    it('GA: is 0 below the standard deduction', () => {
        expect(marginalRate('GA', { ...PENSION_ONLY, age: 61, privatePensionIncome: 5000 })).toBe(0);
    });

    it('GA: blends across a threshold the household is sitting just under', () => {
        // $200 under the deduction: only $800 of the next $1,000 is taxed, so the gross-up sees
        // 3.992% rather than a full 4.99% — the right answer for sizing that draw.
        expect(marginalRate('GA', { ...PENSION_ONLY, age: 61, privatePensionIncome: 14800 })).toBeCloseTo(0.03992, 6);
    });

    // The reason the gross-up takes a function and not a rate. Virginia's age deduction dies at
    // $1 per $1, so inside the band a withdrawn dollar adds *two* dollars of taxable income.
    it('VA: doubles to 11.5% inside the age-deduction phase-out band', () => {
        expect(marginalRate('VA', { ...PENSION_ONLY, age: 67, privatePensionIncome: 55000 })).toBeCloseTo(0.115, 6);
    });

    it('VA: is the top bracket rate below the phase-out band', () => {
        // $45,000 keeps AFAGI (and the probe) under the $50,000 threshold, so the full $12,000
        // deduction survives and only the bracket rate applies.
        expect(marginalRate('VA', { ...PENSION_ONLY, age: 67, privatePensionIncome: 45000 })).toBeCloseTo(0.0575, 6);
    });

    it('VA: is only 5% for a modest-income retiree still inside the third bracket', () => {
        // $30,000 leaves taxable income of $7,520 — the graduated schedule is worth implementing
        // rather than assuming every retiree lands in the top bracket.
        expect(marginalRate('VA', { ...PENSION_ONLY, age: 67, privatePensionIncome: 30000 })).toBeCloseTo(0.05, 6);
    });

    it('VA: is the top bracket rate again above the phase-out band', () => {
        // The band is AFAGI $50,000–$62,000 for a single 65-year-old; $70,000 is past the end,
        // where the deduction is already fully gone and cannot be destroyed twice.
        expect(marginalRate('VA', { ...PENSION_ONLY, age: 67, privatePensionIncome: 70000 })).toBeCloseTo(0.0575, 6);
    });

    it('VA: is 0 before 65 when income is under the filing threshold', () => {
        expect(marginalRate('VA', { ...PENSION_ONLY, age: 64, privatePensionIncome: 5000 })).toBe(0);
    });

    // A single rate applied to a whole draw is wrong precisely because of this: a household
    // sitting at the start of the band pays 11.5% on the first $12,000 and 5.75% after.
    it('VA: a draw that crosses the band out of it is charged less than the in-band rate', () => {
        const inBand = marginalRate('VA', { ...PENSION_ONLY, age: 67, privatePensionIncome: 50000 });
        const rules = getStateTaxRules('VA');
        const at = (privatePensionIncome: number): number =>
            computeStateTax(rules, { ...INPUTS, ...PENSION_ONLY, age: 67, privatePensionIncome }).tax;

        // $30,000 spans the band ($50k → $62k at 11.5%) and beyond ($62k → $80k at 5.75%).
        const blended = (at(80000) - at(50000)) / 30000;
        expect(blended).toBeLessThan(inBand);
        expect(blended).toBeCloseTo((12000 * 0.115 + 18000 * 0.0575) / 30000, 6);
    });

    it('CA: is the bracket rate on an ordinary draw — no exclusion or deduction ever narrows it', () => {
        // $88,000 of pension sits taxable income ($82,294) inside the 9.3% bracket, away from
        // both the credit phase-out and the $1,000,000 surtax line.
        expect(marginalRate('CA', { ...PENSION_ONLY, age: 62, privatePensionIncome: 88000 })).toBeCloseTo(0.093, 6);
    });

    it('CA: gains one extra point above $1,000,000 taxable, from the surtax', () => {
        expect(marginalRate('CA', { ...PENSION_ONLY, age: 62, privatePensionIncome: 1050000 })).toBeCloseTo(0.133, 6);
    });

    it('NY: is 0 while the $20,000 exclusion still has room, even below the standard deduction', () => {
        // Same shape as Georgia: the draw creates its own exclusion room dollar-for-dollar.
        expect(marginalRate('NY', { ...PENSION_ONLY, age: 60, privatePensionIncome: 0 })).toBe(0);
    });

    it('NY: is the bottom bracket rate once the exclusion and deduction are both exhausted', () => {
        expect(marginalRate('NY', { ...PENSION_ONLY, age: 60, taxDeferredWithdrawals: 35000, privatePensionIncome: 0 }))
            .toBeCloseTo(0.039, 6);
    });

    it('NY: is elevated inside the benefit-recapture bracket rows, well above the ordinary rate', () => {
        // No exclusion (age 55) isolates the recapture mechanism from the pension benefit.
        expect(marginalRate('NY', { ...PENSION_ONLY, age: 55, taxDeferredWithdrawals: 130000, privatePensionIncome: 0 }))
            .toBeCloseTo(0.0753, 6);
    });
});

describe('state tax rules data', () => {
    it('models the nine no-income-tax states plus Georgia, Virginia, California, and New York', () => {
        expect(modeledStates().sort()).toEqual(
            [...NO_INCOME_TAX_STATES, 'CA', 'GA', 'NY', 'VA'].sort()
        );
    });

    it('records the tax year the constants were verified against', () => {
        expect(STATE_RULES_REVIEWED_FOR).toBe(2026);
    });

    it('every modeled state code is a real US state in the selector', () => {
        const selectable = new Set(US_STATES.map((s) => s.value));
        for (const state of modeledStates()) {
            expect(selectable.has(state)).toBe(true);
        }
    });

    it('every modeled state cites at least one primary source', () => {
        for (const state of modeledStates()) {
            const rules = getStateTaxRules(state);
            expect(Object.keys(rules!.sources).length).toBeGreaterThan(0);
        }
    });

    it('isStateModeled distinguishes modeled from deferred states', () => {
        expect(isStateModeled('FL')).toBe(true);
        expect(isStateModeled('GA')).toBe(true);
        expect(isStateModeled('VA')).toBe(true);
        expect(isStateModeled('CA')).toBe(true);
        expect(isStateModeled('NY')).toBe(true);
        expect(isStateModeled('NJ')).toBe(false);
    });
});

describe('stateTaxDisclosure', () => {
    it('returns null for unmodeled states so the UI falls back to the manual-rate note', () => {
        expect(stateTaxDisclosure('NJ')).toBeNull();
    });

    it('surfaces WA capital-gains excise tax as a caveat, since we do not model it', () => {
        const disclosure = stateTaxDisclosure('WA');
        expect(disclosure?.caveat).toMatch(/capital gains/i);
        expect(disclosure?.caveat).toContain('278,000');
    });

    it('carries no caveat for a plainly zero-tax state', () => {
        expect(stateTaxDisclosure('TX')?.caveat).toBeUndefined();
    });

    it('summarises GA from the committed constants, naming no exclusion amount', () => {
        const disclosure = stateTaxDisclosure('GA');
        expect(disclosure?.summary).toContain('4.99% flat rate');
        expect(disclosure?.summary).toMatch(/Social Security is exempt/);
        expect(disclosure?.summary).toMatch(/from age 62/);
    });

    it('discloses that frozen contingent escalators overstate GA tax', () => {
        expect(stateTaxDisclosure('GA')?.caveat).toMatch(/revenue trigger/i);
    });

    it('summarises CA with its graduated top rate and the surtax note', () => {
        const disclosure = stateTaxDisclosure('CA');
        expect(disclosure?.summary).toContain('12.30%');
        expect(disclosure?.summary).toMatch(/Social Security is exempt/);
        expect(disclosure?.summary).toMatch(/1% surtax above \$1,000,000/);
    });

    it('discloses that CA figures are dated to the last confirmed tax year', () => {
        expect(stateTaxDisclosure('CA')?.caveat).toMatch(/cannot be finalized/i);
    });

    it('summarises NY with its graduated top rate and the source-split retirement benefit', () => {
        const disclosure = stateTaxDisclosure('NY');
        expect(disclosure?.summary).toContain('10.90%');
        expect(disclosure?.summary).toMatch(/government pensions are fully exempt/);
        expect(disclosure?.summary).toMatch(/\$20,000-per-person exclusion/);
    });

    it('discloses the benefit-recapture surtax and the unmodeled NYC/Yonkers local tax', () => {
        const caveat = stateTaxDisclosure('NY')?.caveat;
        expect(caveat).toMatch(/claws back the benefit/i);
        expect(caveat).toMatch(/New York City and Yonkers/);
    });
});
