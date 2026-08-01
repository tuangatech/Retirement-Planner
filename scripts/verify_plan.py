#!/usr/bin/env python3
"""
Retirement Plan Verification Script (v2 — JSON bundle)
======================================================
Independently re-checks a simulation run for mathematical consistency.

As of v2 this reads a SINGLE self-describing JSON file exported from the app
("Export Verification JSON" button on the Annual Breakdown tab). That bundle
contains the full user inputs, the simulation settings, the aggregate results,
and the complete p10/p50/p90 year-by-year projections. Because inputs AND
results live in the same file, there is no longer a hand-maintained PLAN dict
to keep in sync — every expected value is derived from the inputs the app
actually ran with.

What is verified (deterministic, derived from inputs):
  - Social Security  (FRA benefit x claiming-age factor x COLA, + earnings test)
  - Rental income    (base x general inflation from start age)
  - Living expenses   (phase spending x general inflation from retirement)
  - Healthcare premiums   (pre-Medicare and Medicare, inflated correctly;
                      two per-person tracks summed for MFJ)
  - Healthcare out-of-pocket (pre-Medicare and Medicare, inflated correctly;
                      two per-person tracks summed for MFJ)
  - Income tax       (provisional-income SS formula + standard-deduction floor +
                      marginal rate) and payroll tax (7.65% of part-time work)
  - State income tax (GA's age-tiered exclusion, VA's means-tested age deduction and
                      graduated brackets, CA's brackets-by-status + exemption credit +
                      surtax, NY's brackets-by-status (recapture resolved into extra
                      bracket rows) + source-split retirement benefit; $0 for the nine
                      no-income-tax states)
  - RMDs             (IRS Uniform Lifetime divisor on the start-of-year tax-deferred
                      balance, from age 75; MFJ pools under the OLDER spouse's age)
  - Component sums: Total Income / Expenses / Tax / Withdrawals
  - Cash-flow identity: Income + Withdrawals = Expenses + Taxes + Net Cash Flow
  - Funding: withdrawals actually cover the year they fund (netCashFlow >= 0). This is
             the check that catches a broken gross-up — the plan "spending" money it
             never withdrew — which two separate bugs did before it existed.

The TAX_RULES table below MUST stay in sync with TAX_RULES in
src/lib/calculations/taxes.ts. See docs/2-federal-tax-model.md for the model and sources.

What is NOT verified (stochastic):
  - Portfolio account balances (random returns each year).
    Instead: implied annual return per account is checked for plausibility.

Workflow:
  1. Run a simulation in the app.
  2. On the Annual Breakdown tab, click "Export Verification JSON".
  3. Save the downloaded retirement-verification-<timestamp>.json into THIS
     scripts/ folder (works the same on macOS and Windows).
  4. Run this script — it automatically picks the newest bundle in scripts/.

Usage:
  python verify_plan.py                              # newest bundle in scripts/
  python verify_plan.py --json path/to/bundle.json
  python verify_plan.py --percentile p10 --tolerance 0.03
"""

import argparse
import glob
import json
import math
import os
import sys

# ─── DEFAULTS ─────────────────────────────────────────────────────────────────
DEFAULT_TOLERANCE = 0.02          # ±2% (tighter than v1: the split is now exact)
PLAUSIBLE_RETURN_MIN = -0.60      # Flag if implied annual return < -60%
PLAUSIBLE_RETURN_MAX = 1.50       # Flag if implied annual return > +150%
MEDICARE_AGE = 65
FULL_RETIREMENT_AGE = 67

# Social Security claiming-age adjustment factors (must match the app).
SS_ADJUSTMENT_FACTORS = {
    62: 0.70, 63: 0.75, 64: 0.80, 65: 0.867, 66: 0.933,
    67: 1.0, 68: 1.08, 69: 1.16, 70: 1.24,
}
EARNINGS_TEST_BEFORE_FRA = 23400
EARNINGS_TEST_IN_FRA_YEAR = 62160

# Age at which this tool starts RMDs — a flat 75 (SECURE 2.0 for those born 1960+), matching
# RMD_START_AGE in src/lib/calculations/rmd.ts.
RMD_START_AGE = 75

# IRS Uniform Lifetime Table divisors — must mirror RMD_TABLE in src/lib/calculations/rmd.ts.
# Duplicated by hand (like TAX_RULES below) rather than shared: this is a published IRS table, so
# an independent transcription is exactly the kind of error worth catching. Ages 101+ reuse 100.
RMD_DIVISORS = {
    73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
    80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2,
    87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1,
    94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
}

# Largest negative netCashFlow treated as rounding rather than a funding failure. The engine's
# gross-up solve converges to within $1, so a few cents either side of zero is expected; anything
# bigger means withdrawals did not cover the year.
FUNDING_TOLERANCE = 1.0

# Tax-rule constants — must mirror TAX_RULES in src/lib/calculations/taxes.ts
TAX_RULES = {
    "standard_deduction": {"single": 16100, "married_joint": 32200},   # 2026
    "additional_65": {"single": 2050, "married_joint": 1650},          # 2026
    "senior_bonus": 6000,
    "senior_bonus_last_year": 2028,
    "ss_thresholds": {
        "single": {"base": 25000, "second": 34000},
        "married_joint": {"base": 32000, "second": 44000},
    },
    "ss_max_taxable_fraction": 0.85,
}


# Directory containing this script — bundles are expected to be saved here.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Per-state tax constants, read from the SAME file the TypeScript engine uses. Deliberately
# shared rather than re-declared here: a wrong constant is caught by human review against the
# primary source, while a wrong *formula* is what this script independently re-derives.
# See docs/5-state-tax-model.md.
STATE_RULES_PATH = os.path.join(
    SCRIPT_DIR, os.pardir, "src", "lib", "calculations", "stateTaxRules.json"
)


def load_state_tax_rules() -> dict:
    try:
        with open(STATE_RULES_PATH, encoding="utf-8") as f:
            return json.load(f).get("states", {})
    except FileNotFoundError:
        print(f"Warning: state tax rules not found at {STATE_RULES_PATH} — "
              "treating all states as unmodeled.")
        return {}


STATE_TAX_RULES = load_state_tax_rules()


def pick_for_year(schedule: list, year: int) -> dict:
    """Entry from a year-keyed schedule governing `year`.

    The last entry already in force, or the earliest one for years before the schedule
    starts. Mirrors `pickForYear` in stateTax.ts.
    """
    chosen = schedule[0]
    for entry in schedule:
        if entry["fromYear"] <= year:
            chosen = entry
    return chosen


# ─── BUNDLE LOADING ─────────────────────────────────────────────────────────────
def find_newest_bundle() -> str | None:
    """Return the newest retirement-verification-*.json saved in scripts/."""
    candidates = glob.glob(os.path.join(SCRIPT_DIR, "retirement-verification-*.json"))
    if not candidates:
        return None
    return max(candidates, key=os.path.getmtime)


def load_bundle(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ─── EXPECTED-VALUE FORMULAS (derived from the bundle's inputs) ─────────────────
class Plan:
    """Expected-value formulas built from the app inputs in the bundle."""

    def __init__(self, inputs: dict):
        self.inputs = inputs
        self.retirement_age = inputs["personal"]["retirementAge"]
        sim = inputs["simulation"]
        self.gen_infl = sim["generalInflationRate"]
        self.hc_infl = sim["healthcareInflationRate"]
        self.phases = inputs["phases"]
        self.ss = inputs["income"]["socialSecurity"]
        self.pensions = inputs["income"].get("pensions", []) or []
        self.rental = inputs["income"]["rentalIncome"]
        self.part_time = inputs["income"]["partTimeWork"]
        self.pre_med = inputs["healthcare"]["preMedicare"]
        self.med = inputs["healthcare"]["medicare"]
        self.filing = inputs["personal"].get("filingStatus") or "single"
        self.eff_rate = inputs["tax"]["combinedEffectiveRate"]
        self.state = inputs["personal"]["state"]
        # Absent mode = scenario saved before state tax existed; state is folded into the rate.
        self.state_mode = inputs["tax"].get("stateTaxMode") or "manual"
        self.ss_cap = self.ss.get("taxablePercentage", TAX_RULES["ss_max_taxable_fraction"])
        self.cost_basis = inputs["accounts"]["taxable"].get("costBasisPercentage", 0.70)
        # MFJ (Phase 1): spouse SS stream + spouse age for per-spouse deduction seniors.
        self.spouse_ss = inputs["income"].get("spouseSocialSecurity")
        self.spouse_age_at_ret = inputs["personal"].get("spouseAgeAtRetirement")

    # -- phase helpers --
    def get_phase(self, age: int) -> dict:
        for p in self.phases:
            if p["startAge"] <= age <= p["endAge"]:
                return p
        return self.phases[-1]

    def yrs_from_retirement(self, age: int) -> int:
        return age - self.retirement_age

    # -- income --
    def part_time_income(self, age: int) -> float:
        w = self.part_time
        if not w.get("enabled") or age < w["startAge"] or age > w["endAge"]:
            return 0.0
        return w["annualIncome"]

    def spouse_age(self, age: int) -> int | None:
        """Spouse's age this year (MFJ), derived from their age at the primary's retirement."""
        if self.filing != "married_joint" or self.spouse_age_at_ret is None:
            return None
        return self.spouse_age_at_ret + (age - self.retirement_age)

    def _ss_benefit(self, s: dict, own_age: int) -> float:
        """Base SS benefit (claiming factor + COLA), no earnings test."""
        claiming = s["claimingAge"]
        if own_age < claiming:
            return 0.0
        factor = SS_ADJUSTMENT_FACTORS.get(claiming, 1.0)
        return s["monthlyBenefitAtFRA"] * 12 * factor * (1 + s["colaRate"]) ** (own_age - claiming)

    def exp_ss(self, age: int) -> float:
        # Primary benefit with the earnings test.
        primary = self._ss_benefit(self.ss, age)
        earnings = self.part_time_income(age)
        if age < FULL_RETIREMENT_AGE and earnings > 0:
            if age == FULL_RETIREMENT_AGE:
                over = max(0.0, earnings - EARNINGS_TEST_IN_FRA_YEAR)
                primary = max(0.0, primary - over / 3)
            else:
                over = max(0.0, earnings - EARNINGS_TEST_BEFORE_FRA)
                primary = max(0.0, primary - over / 2)

        # Spouse benefit (MFJ, no earnings test) → household total.
        sp_age = self.spouse_age(age)
        spouse = (self._ss_benefit(self.spouse_ss, sp_age)
                  if self.spouse_ss is not None and sp_age is not None else 0.0)
        return primary + spouse

    def exp_pensions(self, age: int) -> float:
        total = 0.0
        for p in self.pensions:
            if age >= p["startAge"]:
                total += p["monthlyAmount"] * 12 * (1 + p["colaRate"]) ** (age - p["startAge"])
        return total

    def exp_government_pensions(self, age: int) -> float:
        """Government-source subset of `exp_pensions` — only New York's retirement benefit
        distinguishes pension sources (docs/5-state-tax-model.md §4.5)."""
        total = 0.0
        for p in self.pensions:
            if p.get("isGovernment") and age >= p["startAge"]:
                total += p["monthlyAmount"] * 12 * (1 + p["colaRate"]) ** (age - p["startAge"])
        return total

    def exp_rental(self, age: int) -> float:
        r = self.rental
        if not r.get("enabled") or age < r["startAge"]:
            return 0.0
        end = r.get("endAge")
        if end is not None and age > end:
            return 0.0
        base = r["annualNetIncome"]
        if r.get("inflationAdjusted"):
            return base * (1 + self.gen_infl) ** (age - r["startAge"])
        return base

    # -- expenses --
    def exp_living(self, age: int) -> float:
        if age < self.retirement_age:
            return 0.0
        phase = self.get_phase(age)
        return phase["annualSpending"] * (1 + self.gen_infl) ** self.yrs_from_retirement(age)

    # Healthcare is per-person: pre-Medicare inflates by calendar years since retirement
    # (same for both spouses — they retire the same year); Medicare inflates from each
    # person's own 65. MFJ sums two tracks (equal per-person costs); the Medicare OOP
    # phase is keyed to your age.
    def _person_hc_premiums(self, person_age: int, yrs_since_ret: int) -> float:
        if person_age < MEDICARE_AGE:
            return self.pre_med["monthlyPremium"] * 12 * (1 + self.hc_infl) ** yrs_since_ret
        yrs = person_age - MEDICARE_AGE
        monthly = (
            self.med["partBStandardPremium"]
            + self.med["partDPremium"]
            + self.med["medigapPremium"]
            + (self.med["irmaaSurcharge"] if self.med.get("expectIRMAA") else 0)
        )
        return monthly * 12 * (1 + self.hc_infl) ** yrs

    def _person_hc_oop(self, person_age: int, yrs_since_ret: int, phase_name: str) -> float:
        if person_age < MEDICARE_AGE:
            return self.pre_med["annualOutOfPocket"] * (1 + self.hc_infl) ** yrs_since_ret
        yrs = person_age - MEDICARE_AGE
        oop_by_phase = self.med["outOfPocketByPhase"]
        base = {"go_go": oop_by_phase["phase1"],
                "slow_go": oop_by_phase["phase2"],
                "no_go": oop_by_phase["phase3"]}.get(phase_name, 0)
        return base * (1 + self.hc_infl) ** yrs

    def exp_hc_premiums(self, age: int) -> float:
        if age < self.retirement_age:
            return 0.0
        yrs_since_ret = age - self.retirement_age
        total = self._person_hc_premiums(age, yrs_since_ret)
        sp_age = self.spouse_age(age)
        if sp_age is not None:
            total += self._person_hc_premiums(sp_age, yrs_since_ret)
        return total

    def exp_hc_oop(self, age: int) -> float:
        if age < self.retirement_age:
            return 0.0
        yrs_since_ret = age - self.retirement_age
        phase_name = self.get_phase(age)["name"]
        total = self._person_hc_oop(age, yrs_since_ret, phase_name)
        sp_age = self.spouse_age(age)
        if sp_age is not None:
            total += self._person_hc_oop(sp_age, yrs_since_ret, phase_name)
        return total

    # -- taxes --
    def taxable_social_security(self, ss_benefit: float, other_income: float) -> float:
        """IRS provisional-income formula, capped at the user's max fraction."""
        if ss_benefit <= 0:
            return 0.0
        th = TAX_RULES["ss_thresholds"][self.filing]
        base, second = th["base"], th["second"]
        provisional = other_income + 0.5 * ss_benefit
        if provisional <= base:
            taxable = 0.0
        elif provisional <= second:
            taxable = min(0.5 * ss_benefit, 0.5 * (provisional - base))
        else:
            tier1 = min(0.5 * ss_benefit, 0.5 * (second - base))
            taxable = min(0.85 * ss_benefit, 0.85 * (provisional - second) + tier1)
        return min(taxable, self.ss_cap * ss_benefit)

    def standard_deduction(self, age: int, year: int) -> float:
        sp_age = self.spouse_age(age)
        seniors = (1 if age >= 65 else 0) + (1 if sp_age is not None and sp_age >= 65 else 0)
        infl = (1 + self.gen_infl) ** max(0, age - self.retirement_age)
        ded = (TAX_RULES["standard_deduction"][self.filing]
               + TAX_RULES["additional_65"][self.filing] * seniors) * infl
        if seniors and year <= TAX_RULES["senior_bonus_last_year"]:
            ded += TAX_RULES["senior_bonus"] * seniors
        return ded

    def expected_income_tax(self, row: dict) -> float:
        """Expected onFixedIncome + onWithdrawals for a projection row."""
        inc = row["income"]
        wd = row["portfolio"]["withdrawals"]
        hsa_nonmed = max(0.0, wd["hsa"] - row["portfolio"]["hsaForHealthcare"])
        brokerage_gain = wd["taxable"] * (1 - self.cost_basis)
        ordinary_wd = wd["taxDeferred"] + hsa_nonmed

        other_excl_ss = (inc["pensions"] + inc["partTimeWork"] + inc["rentalIncome"]
                         + ordinary_wd + brokerage_gain)
        taxable_ss = self.taxable_social_security(inc["socialSecurity"], other_excl_ss)

        fixed_base = taxable_ss + inc["pensions"] + inc["partTimeWork"] + inc["rentalIncome"]
        wd_base = ordinary_wd + brokerage_gain

        ded = self.standard_deduction(int(row["age"]), int(row["year"]))
        fixed_taxable = max(0.0, fixed_base - ded)
        ded_left = max(0.0, ded - fixed_base)
        wd_taxable = max(0.0, wd_base - ded_left)
        return (fixed_taxable + wd_taxable) * self.eff_rate

    # -- RMDs --
    def expected_rmd(self, age: int, start_tax_deferred: float) -> float:
        """RMD for the year, from the start-of-year tax-deferred balance.

        For MFJ this tool pools both spouses' accounts under a single RMD trigger — the OLDER
        spouse's age — so distributions begin no later than required (docs/4-married-filing-jointly.md).
        That decision is only visible end-to-end here, which is why it is re-derived rather than
        assumed.
        """
        sp_age = self.spouse_age(age)
        rmd_age = max(age, sp_age) if sp_age is not None else age
        if rmd_age < RMD_START_AGE:
            return 0.0
        divisor = RMD_DIVISORS.get(rmd_age, RMD_DIVISORS[100])
        return start_tax_deferred / divisor

    # -- state tax --
    def _state_standard_deduction(self, rules: dict, year: int) -> float:
        entry = pick_for_year(rules["standardDeduction"], year)
        return entry["married"] if self.filing == "married_joint" else entry["single"]

    def _count_at_least_age(self, age: int, min_age: int) -> int:
        """Taxpayers on the return who have reached `min_age`: 1 for single, 0-2 for MFJ."""
        sp_age = self.spouse_age(age)
        return (1 if age >= min_age else 0) + (1 if sp_age is not None and sp_age >= min_age else 0)

    def _va_age_deduction(self, benefit: dict, age: int, afagi: float) -> float:
        """Virginia's age deduction: $12,000 per taxpayer 65+, phased out $1 per $1 of AFAGI
        above $50,000 single / $75,000 married.

        AFAGI is federal AGI less federally taxable SS, which is what `agi` already is here. The
        means test is per RETURN on COMBINED income against a pooled cap, so — unlike Georgia's
        per-person exclusion — pooled accounts give the statutory answer with no attribution
        needed (docs/5-state-tax-model.md §4.3).
        """
        eligible = self._count_at_least_age(age, benefit["minAge"])
        if eligible == 0:
            return 0.0
        limit = benefit["threshold"]["married" if self.filing == "married_joint" else "single"]
        cap = benefit["perPerson"] * eligible
        return max(0.0, cap - benefit["reductionPerDollar"] * max(0.0, afagi - limit))

    def _ny_pension_exclusion(
        self, benefit: dict, age: int, government_pension: float,
        private_pension: float, tax_deferred: float
    ) -> float:
        """New York: government pensions are fully exempt (no cap, no age test — Tax Law
        §612(c)(3)); private pension/annuity/IRA income instead gets a $20,000-per-qualifying-
        person exclusion (§612(c)(3-a), age 59½, modeled as 60 — the engine has no fractional
        age). Not poolable across spouses, same family of simplification as Georgia's exclusion
        (docs/5-state-tax-model.md §4.5, §6)."""
        eligible_people = self._count_at_least_age(age, benefit["minAge"])
        private_eligible = private_pension + tax_deferred
        private_excluded = min(eligible_people * benefit["privateExclusionPerPerson"], private_eligible)
        return government_pension + private_excluded

    def _personal_exemptions(self, rules: dict, age: int) -> float:
        """Virginia's personal exemptions: per filer, plus an addition per filer aged 65+."""
        exemption = rules.get("personalExemption")
        if exemption is None:
            return 0.0
        filers = 2 if self.filing == "married_joint" else 1
        return (exemption["perFiler"] * filers
                + exemption["age65Addition"] * self._count_at_least_age(age, 65))

    def _apply_rate(self, rate: dict, taxable: float) -> float:
        """Flat rate (GA), one bracket schedule (VA), or brackets by filing status (CA).
        `upTo: null` marks the top bracket."""
        if rate["kind"] == "flat":
            return taxable * rate["rate"]

        brackets = (
            rate["married" if self.filing == "married_joint" else "single"]
            if rate["kind"] == "graduated_by_status"
            else rate["brackets"]
        )

        tax = 0.0
        floor = 0.0
        for bracket in brackets:
            if taxable <= floor:
                break
            ceiling = bracket["upTo"] if bracket["upTo"] is not None else float("inf")
            tax += (min(taxable, ceiling) - floor) * bracket["rate"]
            floor = ceiling
        return tax

    def _ga_exclusion(self, rules: dict, row: dict, gains: float) -> float:
        """Georgia's retirement-income exclusion: per person, age-tiered, capped by that
        person's eligible income. Pooled accounts cannot attribute a withdrawal to a spouse,
        so the combined cap is applied to combined income (docs/5-state-tax-model.md §6)."""
        benefit = rules["retirementBenefit"]
        tiers = pick_for_year(benefit["tiers"], int(row["year"]))

        def tier(age: int) -> float:
            if age >= 65:
                return tiers["age65"]
            return tiers["age62"] if age >= 62 else 0.0

        age = int(row["age"])
        sp_age = self.spouse_age(age)
        cap = tier(age) + (tier(sp_age) if sp_age is not None else 0.0)

        # Enumerated categories only. A non-medical HSA distribution is federal "other
        # income" and matches none of them, so it gets no exclusion.
        inc = row["income"]
        eligible = (inc["pensions"] + inc["rentalIncome"] + gains
                    + row["portfolio"]["withdrawals"]["taxDeferred"]
                    + min(inc["partTimeWork"], benefit["earnedIncomeSublimit"]))
        return min(cap, eligible)

    def _ca_exemption_credit(self, credit: dict, age: int, agi: float) -> float:
        """California's personal/senior exemption CREDIT — subtracted from computed tax, not
        taxable income (the opposite ordering from Virginia's `personalExemption`). Phased out
        $6 (single/MFS) or $12 (married) per $2,500 increment of state AGI over the threshold,
        floored at $0 (R&TC §17054, docs/5-state-tax-model.md §4.4)."""
        married = self.filing == "married_joint"
        filers = 2 if married else 1
        base = credit["perFiler"] * filers + credit["age65Addition"] * self._count_at_least_age(age, 65)

        phase_out = credit["phaseOut"]
        threshold = phase_out["threshold"]["married" if married else "single"]
        per_increment = phase_out["reductionPerIncrement"]["married" if married else "single"]
        increments = math.ceil(max(0.0, agi - threshold) / phase_out["increment"])
        return max(0.0, base - increments * per_increment)

    def expected_state_tax(self, row: dict) -> float:
        """Expected state income tax for one projection row.

        Unmodeled states report $0 (their burden is folded into the user's marginal rate) and the
        nine no-income-tax states owe a real $0. Georgia, Virginia, California, and New York are
        re-derived here. Any other income-taxing state raises rather than silently returning 0 —
        a deliberate tripwire so adding a state to the JSON without a formula here cannot pass
        unnoticed.
        """
        if self.state_mode != "modeled":
            return 0.0
        rules = STATE_TAX_RULES.get(self.state)
        if rules is None or not rules.get("taxesIncome", False):
            return 0.0
        if self.state not in ("GA", "VA", "CA", "NY"):
            raise NotImplementedError(f"No state-tax formula for {self.state}")

        inc = row["income"]
        wd = row["portfolio"]["withdrawals"]
        hsa_nonmed = max(0.0, wd["hsa"] - row["portfolio"]["hsaForHealthcare"])
        gains = wd["taxable"] * (1 - self.cost_basis)
        age = int(row["age"])

        # State AGI = federal AGI − federally taxable SS. Every modeled income-tax state exempts
        # Social Security, so it is simply never added; state deductions are not inflated (they
        # are not indexed) — except California's, whose entry is itself a snapshot of TY2025.
        agi = (inc["pensions"] + inc["partTimeWork"] + inc["rentalIncome"]
               + wd["taxDeferred"] + gains + hsa_nonmed)

        # Virginia imposes no tax below the filing threshold (§ 58.1-321). Georgia and California
        # have no such floor, so the key is absent there.
        threshold = rules.get("filingThreshold")
        if threshold is not None:
            limit = threshold["married" if self.filing == "married_joint" else "single"]
            if agi < limit:
                return 0.0

        benefit_rules = rules.get("retirementBenefit")
        if benefit_rules is None:
            benefit = 0.0
        elif benefit_rules["kind"] == "ga_exclusion":
            benefit = self._ga_exclusion(rules, row, gains)
        elif benefit_rules["kind"] == "va_age_deduction":
            benefit = self._va_age_deduction(benefit_rules, age, agi)
        else:
            government_pension = self.exp_government_pensions(age)
            private_pension = inc["pensions"] - government_pension
            benefit = self._ny_pension_exclusion(
                benefit_rules, age, government_pension, private_pension, wd["taxDeferred"]
            )

        deduction = self._state_standard_deduction(rules, int(row["year"]))
        exemptions = self._personal_exemptions(rules, age)
        taxable = max(0.0, agi - benefit - deduction - exemptions)

        bracket_tax = self._apply_rate(rules["rate"], taxable)

        credit_rules = rules.get("exemptionCredit")
        credit = self._ca_exemption_credit(credit_rules, age, agi) if credit_rules is not None else 0.0
        regular_tax = max(0.0, bracket_tax - credit)

        surtax_rules = rules.get("surtax")
        surtax = (
            surtax_rules["rate"] * max(0.0, taxable - surtax_rules["threshold"])
            if surtax_rules is not None
            else 0.0
        )

        return regular_tax + surtax


# ─── CHECK HELPERS ──────────────────────────────────────────────────────────────
def within_tol(actual: float, expected: float, tol: float) -> bool:
    if abs(expected) < 1e-9:
        return abs(actual) <= 1.0
    return abs(actual - expected) / abs(expected) <= tol


def fmt_diff(actual: float, expected: float) -> str:
    if abs(expected) < 1e-9:
        return f"expected $0  got ${actual:,.0f}"
    d = (actual - expected) / abs(expected) * 100
    sign = "+" if d >= 0 else ""
    return f"{sign}{d:.1f}%   actual ${actual:,.0f}   expected ~${expected:,.0f}"


# ─── MAIN VERIFICATION ──────────────────────────────────────────────────────────
def verify(bundle: dict, percentile: str, tol: float) -> int:
    PASS, FAIL, WARN = "[PASS]", "[FAIL]", "[WARN]"

    plan = Plan(bundle["inputs"])
    projections = bundle["projections"][percentile]

    total = 0
    n_fail = 0

    def chk(label, actual, expected, issues):
        nonlocal total, n_fail
        total += 1
        if not within_tol(actual, expected, tol):
            n_fail += 1
            issues.append(f"    {FAIL} {label}: {fmt_diff(actual, expected)}")

    # Starting balances for the implied-return check.
    acc = bundle["inputs"]["accounts"]
    prev_bal = {
        "taxDeferred": acc["taxDeferred"]["balanceAtRetirement"],
        "roth": acc["roth"]["balanceAtRetirement"],
        "taxable": acc["taxable"]["balanceAtRetirement"],
        "hsa": acc["hsa"]["balanceAtRetirement"],
    }

    res = bundle["results"]
    print(f"\n{'=' * 68}")
    print(f"  RETIREMENT PLAN VERIFICATION  ({percentile}, tolerance ±{tol * 100:.0f}%)")
    print(f"{'=' * 68}")
    print(f"  Generated : {bundle.get('generatedAt', '?')}")
    print(f"  Runs      : {res['numberOfRuns']:,}   "
          f"Success rate: {res['successRate'] * 100:.1f}%")
    print(f"  Percentile final balances: "
          f"p10 ${res['percentiles']['p10']:,.0f}  "
          f"p50 ${res['percentiles']['p50']:,.0f}  "
          f"p90 ${res['percentiles']['p90']:,.0f}")
    print(f"{'=' * 68}\n")

    for p in projections:
        age = int(p["age"])
        phase = plan.get_phase(age)
        issues: list[str] = []

        inc = p["income"]
        exp = p["expenses"]
        tax = p["taxes"]
        wd = p["portfolio"]["withdrawals"]
        bal = p["portfolio"]["balances"]

        # Income
        chk("Social Security", inc["socialSecurity"], plan.exp_ss(age), issues)
        chk("Pensions", inc["pensions"], plan.exp_pensions(age), issues)
        chk("Rental Income", inc["rentalIncome"], plan.exp_rental(age), issues)

        # Expenses
        chk("Living Expenses", exp["living"], plan.exp_living(age), issues)
        chk("Healthcare Premiums", exp["healthcarePremiums"], plan.exp_hc_premiums(age), issues)
        chk("Healthcare Out-of-Pocket", exp["healthcareOutOfPocket"], plan.exp_hc_oop(age), issues)

        # Component sums
        chk("Total Income = SS + Pensions + Work + Rental",
            inc["totalBeforeWithdrawals"],
            inc["socialSecurity"] + inc["pensions"] + inc["partTimeWork"] + inc["rentalIncome"],
            issues)

        chk("Total Expenses = Living + Premiums + OOP + One-Time",
            exp["total"],
            exp["living"] + exp["healthcarePremiums"] + exp["healthcareOutOfPocket"] + exp["oneTimeExpenses"],
            issues)

        # `stateTax` is absent from bundles exported before state tax was modeled.
        state_tax = tax.get("stateTax", 0.0)

        chk("Total Tax = Fixed-income + Payroll + Withdrawal + State",
            tax["total"],
            tax["onFixedIncome"] + tax["payrollTax"] + tax["onWithdrawals"] + state_tax,
            issues)

        chk("State Tax", state_tax, plan.expected_state_tax(p), issues)

        # Independent recomputation of the tax model (provisional-income SS +
        # standard-deduction floor + flat marginal rate).
        chk("Income Tax (SS provisional + deduction floor + rate)",
            tax["onFixedIncome"] + tax["onWithdrawals"],
            plan.expected_income_tax(p),
            issues)

        chk("Payroll Tax = 7.65% of part-time work",
            tax["payrollTax"],
            inc["partTimeWork"] * 0.0765,
            issues)

        chk("Total WD = TaxDeferred + Roth + Taxable + HSA",
            wd["total"],
            wd["taxDeferred"] + wd["roth"] + wd["taxable"] + wd["hsa"],
            issues)

        # Cash-flow identity
        lhs = inc["totalBeforeWithdrawals"] + wd["total"]
        rhs = exp["total"] + tax["total"] + p["netCashFlow"]
        chk("Cash Flow: Income + WD = Expenses + Tax + NCF", lhs, rhs, issues)

        # RMD, from the START-of-year tax-deferred balance (returns are applied after
        # withdrawals, so that is the previous year's closing balance).
        chk("RMD = start-of-year tax-deferred / Uniform Lifetime divisor",
            p["portfolio"]["rmdAmount"],
            plan.expected_rmd(age, prev_bal["taxDeferred"]),
            issues)

        # Funding: the year's withdrawals must actually cover it. A negative netCashFlow outside
        # a genuine shortfall means the gross-up under-withdrew and the plan spent money it never
        # took out — understating depletion risk. This is an absolute-dollar check, not a
        # relative one, because the correct value is 0 and `within_tol` cannot express that.
        total += 1
        if p["shortfall"] <= 0.5 and p["netCashFlow"] < -FUNDING_TOLERANCE:
            n_fail += 1
            issues.append(
                f"    {FAIL} Withdrawals do not cover the year: "
                f"netCashFlow ${p['netCashFlow']:,.2f} with no reported shortfall "
                f"(state tax ${state_tax:,.2f})")

        # Implied-return plausibility (informational)
        for key, wkey in (("taxDeferred", "taxDeferred"), ("roth", "roth"),
                          ("taxable", "taxable"), ("hsa", "hsa")):
            start = prev_bal[key]
            end = bal[key]
            w = wd[wkey]
            if start > 0:
                r = (end + w - start) / start
                if r < PLAUSIBLE_RETURN_MIN or r > PLAUSIBLE_RETURN_MAX:
                    issues.append(
                        f"    {WARN} {key} implied return {r * 100:.1f}%  "
                        f"(start=${start:,.0f} wd=${w:,.0f} end=${end:,.0f})")
            prev_bal[key] = end

        if issues:
            print(f"  Age {age}  [{phase['name']}]")
            for line in issues:
                print(line)
            print()

    passed = total - n_fail
    print(f"{'=' * 68}")
    print(f"  SUMMARY")
    print(f"{'=' * 68}")
    print(f"  Years checked : {len(projections)}")
    print(f"  Total checks  : {total}")
    print(f"  {PASS} Passed : {passed}  ({passed / total * 100:.0f}%)")
    print(f"  {FAIL} Failed : {n_fail}")
    print()
    if n_fail == 0:
        print(f"  All deterministic checks passed within ±{tol * 100:.0f}% tolerance.")
        print("  The numbers are consistent with the plan inputs.")
    else:
        print(f"  {n_fail} check(s) failed — review the output above.")
    print("  Note: portfolio balance checks are informational (stochastic returns).")
    print(f"{'=' * 68}\n")

    return 1 if n_fail else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Verify a retirement-verification JSON bundle")
    ap.add_argument("--json", default=None,
                    help="Path to the verification bundle (default: newest in scripts/)")
    ap.add_argument("--percentile", default="p50", choices=["p10", "p50", "p90"],
                    help="Which projection to verify (default: p50)")
    ap.add_argument("--tolerance", default=DEFAULT_TOLERANCE, type=float, metavar="T",
                    help="Relative tolerance, e.g. 0.02 = ±2%% (default: %(default)s)")
    args = ap.parse_args()

    path = args.json or find_newest_bundle()
    if not path:
        print("No verification bundle found in the scripts/ folder. Export one from "
              "the app (Annual Breakdown → 'Export Verification JSON'), save it into "
              "scripts/, or pass --json <file>.")
        sys.exit(1)
    if not os.path.exists(path):
        print(f"Bundle not found: {path}")
        sys.exit(1)

    print(f"Bundle    : {path}")
    print(f"Percentile: {args.percentile}")
    print(f"Tolerance : ±{args.tolerance * 100:.0f}%")

    bundle = load_bundle(path)
    if bundle.get("schema") != "retirement-verification/v1":
        print(f"Warning: unexpected schema '{bundle.get('schema')}' — proceeding anyway.")

    sys.exit(verify(bundle, args.percentile, args.tolerance))
