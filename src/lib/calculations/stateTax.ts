// src/lib/calculations/stateTax.ts

/**
 * State Income Tax Module
 *
 * Computes the selected state's income tax on top of the federal calculation in `taxes.ts`.
 * Kept separate from the federal model because state constants are re-verified per state,
 * per year — see docs/5-state-tax-model.md.
 *
 * Both kinds of state we plan to model start from **federal AGI**, so every input this module
 * needs already exists inside the federal tax step. Nothing here is stochastic and nothing
 * calls `rng()`, so the simulation stays deterministic.
 *
 * IMPORTANT: state tax is a real cash outflow. It has to reach the cash-flow gap and the
 * withdrawal gross-up, not just the final report — otherwise the engine under-withdraws by
 * the state tax every year and the plan "spends" money it never took out.
 *
 * Scope today: the nine states with no individual income tax. Georgia and Virginia add a
 * second `StateTaxRules` arm plus the formula branches marked below.
 */

import type { USState } from '@/types';
import type { FilingStatus } from './taxes';
import { getStateTaxRules, type StateTaxRules } from './stateTaxRules';

/**
 * The federal-AGI components a state calculation needs, assembled by the caller from values
 * the federal tax step has already computed so state tax never re-derives income.
 *
 * Every field is already required by the Georgia and Virginia formulas, so the call site in
 * `yearlyProjection.ts` assembles the complete set now. That is deliberate: it means adding a
 * real state is a change to this module and the rules JSON only, with no engine rewiring.
 *
 * `taxableSocialSecurity` is the amount the IRS provisional-income formula actually put into
 * federal AGI — every state we model exempts SS, so this is subtracted back out exactly
 * rather than re-estimated.
 */
export interface StateTaxInputs {
    year: number;
    filingStatus: FilingStatus;
    /** Primary's age this year. */
    age: number;
    /** MFJ only: spouse's age this year. Undefined for single filers. */
    spouseAge?: number;
    taxableSocialSecurity: number;
    pensions: number;
    partTimeWork: number;
    rentalIncome: number;
    taxDeferredWithdrawals: number;
    /** Gain portion of brokerage withdrawals only — cost basis is not income. */
    brokerageGains: number;
    /** Non-medical HSA withdrawals (age 65+); medical withdrawals are never taxable. */
    hsaNonMedicalWithdrawals: number;
}

export interface StateTaxResult {
    tax: number;
    /**
     * True when the engine computed this state's tax, including a genuine $0 for states with
     * no income tax. False means the state is not modeled and the user's manual marginal rate
     * is still doing the work — the UI must not claim state tax was handled.
     */
    modeled: boolean;
}

/**
 * State income tax for one year.
 *
 * @param rules - from `getStateTaxRules(state)`; `undefined` when the state is not modeled.
 *   Passed in rather than looked up internally so this stays a pure function of its inputs
 *   and can be tested against synthetic rules.
 */
export function computeStateTax(
    rules: StateTaxRules | undefined,
    _inputs: StateTaxInputs
): StateTaxResult {
    if (rules === undefined) return { tax: 0, modeled: false };

    // Every modeled state has no individual income tax, so this is a real computed zero —
    // meaningfully different from the `modeled: false` case above, which the UI reports
    // differently. GA/VA branch on `rules.taxesIncome` here.
    return { tax: 0, modeled: true };
}

/**
 * The state's marginal rate on the next dollar of ordinary withdrawal, used to gross up
 * withdrawals so they cover their own state tax.
 *
 * Computed from fixed income *before* discretionary draws — the same non-circular shortcut
 * `calculateTaxFreeTaxDeferredRoom` uses. Residual over-withdrawal is reinvested to the
 * taxable account by `yearlyProjection`; under-withdrawal is the failure mode to avoid.
 *
 * Always 0 while only no-income-tax states are modeled. Georgia returns its flat rate once
 * the exclusion and standard deduction are used up; Virginia returns its bracket rate,
 * **doubled** inside the age-deduction phase-out band where each extra dollar of income also
 * destroys a dollar of deduction.
 */
export function stateMarginalRate(
    _rules: StateTaxRules | undefined,
    _inputs: StateTaxInputs
): number {
    return 0;
}

/**
 * Disclosure text for the selected state, or `null` when the state is not modeled. Presentation
 * reads this instead of restating tax rules in the UI layer.
 *
 * `caveat` surfaces a liability we deliberately do not model but must not hide — currently
 * Washington's capital-gains excise tax.
 */
export function stateTaxDisclosure(
    state: USState
): { summary: string; caveat?: string } | null {
    const rules = getStateTaxRules(state);
    if (rules === undefined) return null;
    return { summary: 'no state income tax', caveat: rules.caveat };
}
