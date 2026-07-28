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
    taxableSocialSecurity: 20000,
    pensions: 18000,
    partTimeWork: 12000,
    rentalIncome: 9000,
    taxDeferredWithdrawals: 40000,
    brokerageGains: 6000,
    hsaNonMedicalWithdrawals: 3000,
};

/** The nine states with no individual income tax for TY2026 (docs/5-state-tax-model.md §1). */
const NO_INCOME_TAX_STATES = ['AK', 'FL', 'NH', 'NV', 'SD', 'TN', 'TX', 'WA', 'WY'] as const;

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

describe('stateMarginalRate', () => {
    it('is 0 for states with no income tax, so the gross-up is unchanged', () => {
        expect(stateMarginalRate(getStateTaxRules('TX'), INPUTS)).toBe(0);
    });

    it('is 0 for unmodeled states', () => {
        expect(stateMarginalRate(undefined, INPUTS)).toBe(0);
    });
});

describe('state tax rules data', () => {
    it('models exactly the nine no-income-tax states', () => {
        expect(modeledStates().sort()).toEqual([...NO_INCOME_TAX_STATES].sort());
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
        expect(isStateModeled('GA')).toBe(false); // lands in the Georgia PR
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
});
