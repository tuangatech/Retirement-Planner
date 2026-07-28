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
 * A state that taxes income. Only the fields Georgia needs are here; Virginia widens `rate`
 * with a graduated arm and `retirementBenefit` with its age deduction.
 */
export interface IncomeTaxRules {
    state: USState;
    taxesIncome: true;
    /** Both modeled states exempt SS. Widen when a state that taxes it is added. */
    socialSecurity: 'exempt';
    rate: { kind: 'flat'; rate: number };
    /** Year-keyed schedule: state deductions change by legislation, on dated steps. */
    standardDeduction: Array<{ fromYear: number; single: number; married: number }>;
    retirementBenefit?: GaExclusion;
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
