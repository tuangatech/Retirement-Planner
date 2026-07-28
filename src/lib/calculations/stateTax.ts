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
 * Scope today: the nine states with no individual income tax, plus Georgia. Virginia adds a
 * graduated-rate arm and its own retirement benefit.
 */

import type { USState } from '@/types';
import type { FilingStatus } from './taxes';
import {
    getStateTaxRules,
    type GaExclusion,
    type IncomeTaxRules,
    type StateTaxRules,
} from './stateTaxRules';

/**
 * The federal-AGI components a state calculation needs, assembled by the caller from values
 * the federal tax step has already computed so state tax never re-derives income.
 *
 * **Social Security is deliberately absent.** State AGI is federal AGI minus the federally
 * taxable SS the provisional-income formula produced, and every state we model exempts SS —
 * so building the base from these components means the subtraction is exact by construction
 * rather than a value that has to be passed in correctly. A state that actually taxes SS
 * would add the *federally taxable* amount back here (never the gross benefit).
 */
export interface StateTaxInputs {
    year: number;
    filingStatus: FilingStatus;
    /** Primary's age this year. */
    age: number;
    /** MFJ only: spouse's age this year. Undefined for single filers. */
    spouseAge?: number;
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
 * Picks the entry from a year-keyed schedule that governs `year`: the last entry whose
 * `fromYear` has already arrived, or the earliest entry for years before the schedule starts
 * (a retirement modeled in 2025 uses the TY2026 constants rather than nothing).
 *
 * Entries are assumed to be in ascending `fromYear` order, as committed in the rules JSON.
 */
function pickForYear<T extends { fromYear: number }>(schedule: T[], year: number): T {
    let chosen = schedule[0];
    for (const entry of schedule) {
        if (entry.fromYear <= year) chosen = entry;
    }
    return chosen;
}

/**
 * State AGI: federal AGI less federally taxable Social Security. Assembled from components,
 * so SS is simply never added — see the note on `StateTaxInputs`.
 */
function stateAGI(inputs: StateTaxInputs): number {
    return (
        inputs.pensions +
        inputs.partTimeWork +
        inputs.rentalIncome +
        inputs.taxDeferredWithdrawals +
        inputs.brokerageGains +
        inputs.hsaNonMedicalWithdrawals
    );
}

/**
 * Georgia's retirement-income exclusion for the year.
 *
 * Per person and age-tiered ($0 under 62, $35,000 at 62–64, $65,000 at 65+ rising to $70,000
 * in TY2027), capped by that person's eligible income. MFJ takes up to 2× the tier amount
 * because each spouse qualifies separately — but pooled accounts cannot attribute a
 * withdrawal to a spouse, so the combined cap is applied to combined income. That
 * over-excludes a couple whose retirement income is lopsided; disclosed in §6 of
 * docs/5-state-tax-model.md, and the same family of simplification as the pooled RMD.
 */
function georgiaExclusion(benefit: GaExclusion, inputs: StateTaxInputs): number {
    const tiers = pickForYear(benefit.tiers, inputs.year);
    const perPerson = (age: number): number =>
        age >= 65 ? tiers.age65 : age >= 62 ? tiers.age62 : 0;

    const cap =
        perPerson(inputs.age) +
        (inputs.filingStatus === 'married_joint' && inputs.spouseAge !== undefined
            ? perPerson(inputs.spouseAge)
            : 0);

    // Eligible income is the categories O.C.G.A. 48-7-27 enumerates — pensions, net rental,
    // capital gains, and tax-deferred distributions — with at most `earnedIncomeSublimit` of
    // earned income. Non-medical HSA withdrawals are federal "other income" and match no
    // enumerated category, so the plain reading denies them the exclusion (§6).
    const eligible =
        inputs.pensions +
        inputs.rentalIncome +
        inputs.brokerageGains +
        inputs.taxDeferredWithdrawals +
        Math.min(inputs.partTimeWork, benefit.earnedIncomeSublimit);

    return Math.min(cap, eligible);
}

function incomeTax(rules: IncomeTaxRules, inputs: StateTaxInputs): number {
    const deductionSchedule = pickForYear(rules.standardDeduction, inputs.year);
    const standardDeduction =
        inputs.filingStatus === 'married_joint' ? deductionSchedule.married : deductionSchedule.single;

    // State standard deductions are NOT inflated: neither Georgia's nor Virginia's is
    // statutorily indexed, so holding them flat while income inflates is what the law
    // actually does. A deliberate asymmetry with the federal base deduction (§6).
    const benefit =
        rules.retirementBenefit !== undefined ? georgiaExclusion(rules.retirementBenefit, inputs) : 0;

    const taxable = Math.max(0, stateAGI(inputs) - benefit - standardDeduction);
    return taxable * rules.rate.rate;
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
    inputs: StateTaxInputs
): StateTaxResult {
    if (rules === undefined) return { tax: 0, modeled: false };

    // A state with no income tax owes a real computed zero — meaningfully different from the
    // `modeled: false` case above, which the UI reports differently.
    if (!rules.taxesIncome) return { tax: 0, modeled: true };

    return { tax: incomeTax(rules, inputs), modeled: true };
}

/**
 * How much a $1,000 probe withdrawal moves the state bill. Wide enough to average over a
 * threshold the household is sitting just under (a blended rate is the right answer for a
 * gross-up), small enough not to smear a genuinely piecewise-constant rate.
 */
const MARGINAL_PROBE = 1000;

/**
 * The state's marginal rate on the next dollar of ordinary withdrawal, used to gross up
 * withdrawals so they cover their own state tax.
 *
 * Computed from fixed income *before* discretionary draws — the same non-circular shortcut
 * `calculateTaxFreeTaxDeferredRoom` uses. Residual over-withdrawal is reinvested to the
 * taxable account by `yearlyProjection`; under-withdrawal is the failure mode to avoid.
 *
 * Taken as a finite difference over a probe withdrawal rather than re-deriving each state's
 * marginal algebra. That is not a shortcut for its own sake: Georgia's exclusion **grows with
 * eligible income**, so an extra dollar of tax-deferred draw is untaxed while exclusion room
 * remains even though the household is already past its standard deduction. The probe gets
 * that, the deduction shield, and (once Virginia lands) its doubled phase-out band for free,
 * from the one formula that is already the source of truth.
 */
export function stateMarginalRate(
    rules: StateTaxRules | undefined,
    inputs: StateTaxInputs
): number {
    if (rules === undefined || !rules.taxesIncome) return 0;

    const base = incomeTax(rules, inputs);
    const bumped = incomeTax(rules, {
        ...inputs,
        taxDeferredWithdrawals: inputs.taxDeferredWithdrawals + MARGINAL_PROBE,
    });

    return (bumped - base) / MARGINAL_PROBE;
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
    if (!rules.taxesIncome) return { summary: 'no state income tax', caveat: rules.caveat };

    // Deliberately names no exclusion amount: it is age- and year-dependent, so any single
    // figure here would be wrong for most of the retirement. The engine holds the tiers.
    const rate = `${(rules.rate.rate * 100).toFixed(2)}% flat rate`;
    const benefit =
        rules.retirementBenefit !== undefined
            ? '; Social Security is exempt and an age-tiered retirement-income exclusion applies from age 62'
            : '; Social Security is exempt';

    return { summary: rate + benefit, caveat: rules.caveat };
}
