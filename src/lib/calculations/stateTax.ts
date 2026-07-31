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
 * Scope today: the nine states with no individual income tax, plus Georgia (flat rate, per-person
 * retirement exclusion), Virginia (graduated brackets, household age deduction), and California
 * (brackets by filing status, a credit-based exemption, and a flat surtax above $1,000,000).
 */

import type { USState } from '@/types';
import type { FilingStatus } from './taxes';
import {
    getStateTaxRules,
    type CaExemptionCredit,
    type GaExclusion,
    type IncomeTaxRules,
    type StateTaxRules,
    type VaAgeDeduction,
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

/** Taxpayers on the return who have reached `minAge`: 1 for a single filer, 0–2 for MFJ. */
function countAtLeastAge(inputs: StateTaxInputs, minAge: number): number {
    const spouseQualifies =
        inputs.filingStatus === 'married_joint' &&
        inputs.spouseAge !== undefined &&
        inputs.spouseAge >= minAge;
    return (inputs.age >= minAge ? 1 : 0) + (spouseQualifies ? 1 : 0);
}

/**
 * Virginia's age deduction for the year: $12,000 per taxpayer 65+, reduced $1 for every $1 of
 * AFAGI above $50,000 single / $75,000 married.
 *
 * `afagi` is Virginia's "adjusted federal adjusted gross income" — federal AGI less federally
 * taxable Social Security and Tier 1 Railroad Retirement, which is exactly what `stateAGI`
 * already builds (see the note on `StateTaxInputs`), so it is passed in rather than recomputed.
 *
 * The means test is per *return* on *combined* income against a pooled cap, so unlike Georgia's
 * per-person exclusion it needs no attribution of a withdrawal to a spouse and this tool's
 * pooled-accounts MFJ model gives the statutory answer rather than an approximation.
 *
 * Because the phase-out is dollar-for-dollar, a dollar earned inside the band also destroys a
 * dollar of deduction: taxable income rises by $2 and the marginal rate doubles to ~11.5%. That
 * is why the withdrawal gross-up evaluates this whole function instead of taking one rate.
 */
function virginiaAgeDeduction(
    benefit: VaAgeDeduction,
    inputs: StateTaxInputs,
    afagi: number
): number {
    const eligible = countAtLeastAge(inputs, benefit.minAge);
    if (eligible === 0) return 0;

    const threshold =
        inputs.filingStatus === 'married_joint'
            ? benefit.threshold.married
            : benefit.threshold.single;

    const cap = benefit.perPerson * eligible;
    return Math.max(0, cap - benefit.reductionPerDollar * Math.max(0, afagi - threshold));
}

/** Virginia's personal exemptions: per filer, plus an addition for each filer aged 65+. */
function personalExemptions(rules: IncomeTaxRules, inputs: StateTaxInputs): number {
    const exemption = rules.personalExemption;
    if (exemption === undefined) return 0;

    const filers = inputs.filingStatus === 'married_joint' ? 2 : 1;
    // The age-65 addition is keyed to 65 by § 58.1-322.03 in its own right — it happens to match
    // the age deduction's threshold but is not derived from it. Dependent and blindness
    // exemptions are not modeled (§4.3).
    return exemption.perFiler * filers + exemption.age65Addition * countAtLeastAge(inputs, 65);
}

/**
 * California's personal/senior exemption credit, phased out $6 (single/MFS) or $12 (married)
 * per $2,500 increment of state AGI over the threshold (R&TC §17054), floored at $0.
 *
 * A step function, not a smooth dollar-for-dollar reduction like Virginia's age deduction: the
 * credit only drops when cumulative AGI crosses a new $2,500 line, so it does not create an
 * elevated marginal *rate* the way Virginia's phase-out does — it adds at most a $6-$12 blip at
 * each crossing. The withdrawal gross-up (§3) prices that blip correctly anyway, because it
 * already re-evaluates this whole formula at each candidate draw rather than assuming linearity.
 *
 * Phased out against state AGI rather than federal AGI: the two differ only by the excluded SS
 * amount, which is immaterial at the $252k+/$504k+ incomes where this phase-out even starts.
 */
function caExemptionCredit(credit: CaExemptionCredit, inputs: StateTaxInputs, agi: number): number {
    const filers = inputs.filingStatus === 'married_joint' ? 2 : 1;
    const base = credit.perFiler * filers + credit.age65Addition * countAtLeastAge(inputs, 65);

    const threshold =
        inputs.filingStatus === 'married_joint'
            ? credit.phaseOut.threshold.married
            : credit.phaseOut.threshold.single;
    const perIncrement =
        inputs.filingStatus === 'married_joint'
            ? credit.phaseOut.reductionPerIncrement.married
            : credit.phaseOut.reductionPerIncrement.single;

    const increments = Math.ceil(Math.max(0, agi - threshold) / credit.phaseOut.increment);
    return Math.max(0, base - increments * perIncrement);
}

/** Marginal-bracket tax. `upTo: null` marks the top bracket. */
function applyBrackets(
    brackets: Array<{ upTo: number | null; rate: number }>,
    taxable: number
): number {
    let tax = 0;
    let floor = 0;

    for (const bracket of brackets) {
        if (taxable <= floor) break;
        const ceiling = bracket.upTo ?? Infinity;
        tax += (Math.min(taxable, ceiling) - floor) * bracket.rate;
        floor = ceiling;
    }

    return tax;
}

function incomeTax(rules: IncomeTaxRules, inputs: StateTaxInputs): number {
    const agi = stateAGI(inputs);

    // Below the filing threshold no tax is imposed and no return is required (Virginia,
    // § 58.1-321). Without this the band between the standard deduction and the threshold would
    // be billed tax nobody owes — a few hundred dollars a year once the 2030 deduction cliff
    // widens that band. Georgia has no such floor, so the field is absent there.
    if (rules.filingThreshold !== undefined) {
        const threshold =
            inputs.filingStatus === 'married_joint'
                ? rules.filingThreshold.married
                : rules.filingThreshold.single;
        if (agi < threshold) return 0;
    }

    const deductionSchedule = pickForYear(rules.standardDeduction, inputs.year);
    const standardDeduction =
        inputs.filingStatus === 'married_joint' ? deductionSchedule.married : deductionSchedule.single;

    // State standard deductions are NOT inflated: neither Georgia's nor Virginia's is
    // statutorily indexed, so holding them flat while income inflates is what the law
    // actually does. A deliberate asymmetry with the federal base deduction (§6).
    const benefit =
        rules.retirementBenefit === undefined
            ? 0
            : rules.retirementBenefit.kind === 'ga_exclusion'
              ? georgiaExclusion(rules.retirementBenefit, inputs)
              : virginiaAgeDeduction(rules.retirementBenefit, inputs, agi);

    const taxable = Math.max(
        0,
        agi - benefit - standardDeduction - personalExemptions(rules, inputs)
    );

    const bracketTax =
        rules.rate.kind === 'flat'
            ? taxable * rules.rate.rate
            : rules.rate.kind === 'graduated'
              ? applyBrackets(rules.rate.brackets, taxable)
              : applyBrackets(
                    inputs.filingStatus === 'married_joint' ? rules.rate.married : rules.rate.single,
                    taxable
                );

    // California's exemption credit reduces computed TAX, not taxable income (§4.4) — the
    // opposite ordering from Virginia's deduction-style personalExemption above.
    const credit =
        rules.exemptionCredit === undefined ? 0 : caExemptionCredit(rules.exemptionCredit, inputs, agi);
    const regularTax = Math.max(0, bracketTax - credit);

    // The Behavioral Health Services Tax is computed on taxable income directly and is not
    // reducible by the exemption credit — it is added after, per FTB's own worksheet (§4.4).
    const surtax =
        rules.surtax === undefined ? 0 : rules.surtax.rate * Math.max(0, taxable - rules.surtax.threshold);

    return regularTax + surtax;
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

    // Deliberately names no benefit amount: it is age-, year- and income-dependent, so any single
    // figure here would be wrong for most of the retirement. The engine holds the schedules.
    const rate =
        rules.rate.kind === 'flat'
            ? `${(rules.rate.rate * 100).toFixed(2)}% flat rate`
            : rules.rate.kind === 'graduated'
              ? `graduated rates to ${(rules.rate.brackets[rules.rate.brackets.length - 1].rate * 100).toFixed(2)}%`
              : `graduated rates to ${(rules.rate.single[rules.rate.single.length - 1].rate * 100).toFixed(2)}%`;

    const benefit =
        rules.retirementBenefit === undefined
            ? '; Social Security is exempt'
            : rules.retirementBenefit.kind === 'ga_exclusion'
              ? '; Social Security is exempt and an age-tiered retirement-income exclusion applies from age 62'
              : '; Social Security is exempt and an income-tested age deduction applies from age 65';

    const surtax =
        rules.surtax === undefined
            ? ''
            : `; plus a ${(rules.surtax.rate * 100).toFixed(0)}% surtax above $${rules.surtax.threshold.toLocaleString()} taxable income`;

    return { summary: rate + benefit + surtax, caveat: rules.caveat };
}
