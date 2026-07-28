// src/lib/calculations/stateTax.test.ts

import { describe, it, expect } from 'vitest';
import { computeStateTax, stateMarginalRate, stateTaxDisclosure, type StateTaxInputs } from './stateTax';
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
    pensions: 18000,
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

/** Georgia's marginal rate on the next dollar of tax-deferred withdrawal. */
function gaMarginal(overrides: Partial<StateTaxInputs> = {}): number {
    return stateMarginalRate(getStateTaxRules('GA'), { ...INPUTS, ...overrides });
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
        // CA is deliberately deferred — the user's marginal rate carries its burden.
        const result = computeStateTax(getStateTaxRules('CA'), INPUTS);
        expect(result.tax).toBe(0);
        expect(result.modeled).toBe(false);
    });

    it('treats undefined rules as not modeled rather than throwing', () => {
        expect(computeStateTax(undefined, INPUTS)).toEqual({ tax: 0, modeled: false });
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
            pensions: 0,
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
            pensions: 0,
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
            pensions: 200000,
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
            pensions: 200000,
        });
        expect(tax).toBeCloseTo(5239.5, 2);
    });

    it('owes nothing when AGI is inside the exclusion plus deduction', () => {
        expect(gaTax({ ...PENSION_ONLY, age: 65, pensions: 12000 })).toBe(0);
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
            pensions: 37200,
        });
        expect(tax).toBe(0);
    });
});

describe('stateMarginalRate', () => {
    it('is 0 for states with no income tax, so the gross-up is unchanged', () => {
        expect(stateMarginalRate(getStateTaxRules('TX'), INPUTS)).toBe(0);
    });

    it('is 0 for unmodeled states', () => {
        expect(stateMarginalRate(undefined, INPUTS)).toBe(0);
    });

    it('GA: is the flat rate once the exclusion is exhausted', () => {
        // $100k of pension income uses up the whole $65,000 exclusion, so the next
        // tax-deferred dollar is taxed outright.
        expect(gaMarginal({ ...PENSION_ONLY, age: 65, pensions: 100000 })).toBeCloseTo(0.0499, 6);
    });

    it('GA: is 0 while exclusion room remains, even though tax is already owed', () => {
        // The withdrawal creates its own exclusion room dollar-for-dollar, so it is free at
        // the margin. This is why the rate is a finite difference rather than "past the
        // deduction ⇒ 4.99%": that shortcut would over-gross-up every draw here.
        const inputs = {
            ...PENSION_ONLY,
            age: 65,
            pensions: 40000,
            hsaNonMedicalWithdrawals: 30000,
        };
        expect(gaTax(inputs)).toBeGreaterThan(0);
        expect(gaMarginal(inputs)).toBe(0);
    });

    it('GA: is the flat rate before 62, when there is no exclusion to grow', () => {
        expect(gaMarginal({ ...PENSION_ONLY, age: 61, pensions: 20000 })).toBeCloseTo(0.0499, 6);
    });

    it('GA: is 0 below the standard deduction', () => {
        expect(gaMarginal({ ...PENSION_ONLY, age: 61, pensions: 5000 })).toBe(0);
    });

    it('GA: blends across a threshold the household is sitting just under', () => {
        // $200 under the deduction: only $800 of the $1,000 probe is taxed, so the
        // gross-up sees 3.992% rather than a full 4.99% — the right answer for sizing.
        expect(gaMarginal({ ...PENSION_ONLY, age: 61, pensions: 14800 })).toBeCloseTo(0.03992, 6);
    });
});

describe('state tax rules data', () => {
    it('models the nine no-income-tax states plus Georgia', () => {
        expect(modeledStates().sort()).toEqual([...NO_INCOME_TAX_STATES, 'GA'].sort());
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
        expect(isStateModeled('VA')).toBe(false); // lands in the Virginia PR
        expect(isStateModeled('NY')).toBe(false);
    });
});

describe('stateTaxDisclosure', () => {
    it('returns null for unmodeled states so the UI falls back to the manual-rate note', () => {
        expect(stateTaxDisclosure('NY')).toBeNull();
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
});
