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
 * States that do tax income (GA, VA) land here as a second union member. Until then the
 * union has one arm — widening it is the whole job of the Georgia and Virginia PRs.
 */
export type StateTaxRules = NoIncomeTaxRules;

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
