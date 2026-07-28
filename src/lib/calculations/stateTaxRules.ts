// src/lib/calculations/stateTaxRules.ts

/**
 * Typed access to the per-state tax constants.
 *
 * The constants themselves live in `stateTaxRules.json` — deliberately JSON rather than
 * TypeScript so that `scripts/verify_plan.py` can read the same file instead of
 * re-declaring the numbers in Python. One file, two readers, no hand-kept sync.
 *
 * Only states we actually model appear in the JSON. An absent state means "not modeled":
 * the engine leaves the user's manual marginal rate alone (see docs/5-state-tax-model.md).
 */

import type { USState } from '@/types';
import rulesData from './stateTaxRules.json';

/**
 * A state with no individual income tax. `caveat` carries a non-income-tax liability we
 * deliberately do not model but must disclose (Washington's capital-gains excise tax).
 */
export interface NoIncomeTaxRules {
    state: USState;
    taxesIncome: false;
    caveat?: string;
    note?: string;
    sources: Record<string, string>;
}

/**
 * Georgia's retirement-income exclusion: per person, age-tiered, and capped by that person's
 * eligible income (docs/5-state-tax-model.md §4.2).
 *
 * A discriminated union member rather than a generalized "exclusion" record — Virginia's age
 * deduction is structurally different (household-level and means-tested), and two unlike
 * benefits do not justify an abstraction over benefits nobody has written yet.
 */
export interface GaExclusion {
    kind: 'ga_exclusion';
    /** Year-keyed: the TY2027 step-up to $70,000 is unconditional, so it is modeled. */
    tiers: Array<{ fromYear: number; age62: number; age65: number }>;
    /** Most of the exclusion that may be earned income (IT-511 p.21). */
    earnedIncomeSublimit: number;
}

/**
 * Virginia's age deduction: $12,000 per taxpayer aged 65+, means-tested at the *household*
 * level against combined AFAGI and phased out dollar-for-dollar above the threshold
 * (docs/5-state-tax-model.md §4.3).
 *
 * Structurally the opposite of Georgia's exclusion. Georgia's is per person and capped by that
 * person's eligible income, so it *grows* with retirement income; Virginia's is a pooled cap
 * that *shrinks* as household income rises, and cares nothing about which income type funds it.
 * That is why these are two union members and not one parameterized "exclusion".
 */
export interface VaAgeDeduction {
    kind: 'va_age_deduction';
    perPerson: number;
    /** Age at which a taxpayer becomes eligible (65 — the born-before-1939 tier is not modeled). */
    minAge: number;
    /** AFAGI above which the deduction starts phasing out, per return on combined income. */
    threshold: { single: number; married: number };
    /** Dollars of deduction lost per dollar of AFAGI over the threshold (1 — hence 2× the rate). */
    reductionPerDollar: number;
}

/**
 * A state that taxes income. `rate` carries both a flat arm (Georgia) and a graduated one
 * (Virginia); `personalExemption` and `filingThreshold` are Virginia-only and absent for Georgia,
 * whose flat-tax structure has neither.
 */
export interface IncomeTaxRules {
    state: USState;
    taxesIncome: true;
    /** Both modeled states exempt SS. Widen when a state that taxes it is added. */
    socialSecurity: 'exempt';
    rate:
        | { kind: 'flat'; rate: number }
        // Ascending; the final bracket has `upTo: null`. Virginia's schedule does not vary by
        // filing status, unlike NY's and CA's — see §10 before widening this for them.
        | { kind: 'graduated'; brackets: Array<{ upTo: number | null; rate: number }> };
    /** Year-keyed schedule: state deductions change by legislation, on dated steps. */
    standardDeduction: Array<{ fromYear: number; single: number; married: number }>;
    /** Per filer, doubled for MFJ, plus an addition for each spouse aged 65+. */
    personalExemption?: { perFiler: number; age65Addition: number };
    /**
     * State AGI below which no tax is imposed and no return is required. A *filing* rule rather
     * than a computation, but without it we bill a low-income retiree the tax on the band between
     * the deduction and the threshold.
     */
    filingThreshold?: { single: number; married: number };
    retirementBenefit?: GaExclusion | VaAgeDeduction;
    caveat?: string;
    note?: string;
    sources: Record<string, string>;
}

export type StateTaxRules = NoIncomeTaxRules | IncomeTaxRules;

/** Tax year the committed constants were last verified against their primary sources. */
export const STATE_RULES_REVIEWED_FOR: number = rulesData.reviewedFor;

const RULES: Partial<Record<USState, StateTaxRules>> = Object.fromEntries(
    Object.entries(rulesData.states).map(([state, rules]) => [
        state,
        { state: state as USState, ...rules } as StateTaxRules,
    ])
);

/** Rules for a state, or `undefined` when the state is not modeled. */
export function getStateTaxRules(state: USState): StateTaxRules | undefined {
    return RULES[state];
}

/** Whether this state's tax is computed by the engine rather than folded into the user's rate. */
export function isStateModeled(state: USState): boolean {
    return RULES[state] !== undefined;
}

/** Every modeled state, for the wizard's state selector grouping. */
export function modeledStates(): USState[] {
    return Object.keys(RULES) as USState[];
}
