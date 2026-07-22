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
  - Healthcare premiums   (pre-Medicare and Medicare, inflated correctly)
  - Healthcare out-of-pocket (pre-Medicare and Medicare, inflated correctly)
  - Income tax       (provisional-income SS formula + standard-deduction floor +
                      marginal rate) and payroll tax (7.65% of part-time work)
  - Component sums: Total Income / Expenses / Tax / Withdrawals
  - Cash-flow identity: Income + Withdrawals = Expenses + Taxes + Net Cash Flow

The TAX_RULES table below MUST stay in sync with TAX_RULES in
src/lib/calculations/taxes.ts. See docs/2-tax-model.md for the model and sources.

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
        self.ss_cap = self.ss.get("taxablePercentage", TAX_RULES["ss_max_taxable_fraction"])
        self.cost_basis = inputs["accounts"]["taxable"].get("costBasisPercentage", 0.70)

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

    def exp_ss(self, age: int) -> float:
        s = self.ss
        claiming = s["claimingAge"]
        if age < claiming:
            return 0.0
        factor = SS_ADJUSTMENT_FACTORS.get(claiming, 1.0)
        full = s["monthlyBenefitAtFRA"] * 12 * factor * (1 + s["colaRate"]) ** (age - claiming)

        # Earnings test (only before FRA, only if working).
        earnings = self.part_time_income(age)
        if age >= FULL_RETIREMENT_AGE or earnings == 0:
            return full
        if age == FULL_RETIREMENT_AGE:
            over = max(0.0, earnings - EARNINGS_TEST_IN_FRA_YEAR)
            return max(0.0, full - over / 3)
        over = max(0.0, earnings - EARNINGS_TEST_BEFORE_FRA)
        return max(0.0, full - over / 2)

    def exp_pensions(self, age: int) -> float:
        total = 0.0
        for p in self.pensions:
            if age >= p["startAge"]:
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

    def exp_hc_premiums(self, age: int) -> float:
        if age < self.retirement_age:
            return 0.0
        if age < MEDICARE_AGE:
            yrs = age - self.retirement_age
            return self.pre_med["monthlyPremium"] * 12 * (1 + self.hc_infl) ** yrs
        yrs = age - MEDICARE_AGE
        monthly = (
            self.med["partBStandardPremium"]
            + self.med["partDPremium"]
            + self.med["medigapPremium"]
            + (self.med["irmaaSurcharge"] if self.med.get("expectIRMAA") else 0)
        )
        return monthly * 12 * (1 + self.hc_infl) ** yrs

    def exp_hc_oop(self, age: int) -> float:
        if age < self.retirement_age:
            return 0.0
        if age < MEDICARE_AGE:
            yrs = age - self.retirement_age
            return self.pre_med["annualOutOfPocket"] * (1 + self.hc_infl) ** yrs
        yrs = age - MEDICARE_AGE
        phase = self.get_phase(age)["name"]
        oop_by_phase = self.med["outOfPocketByPhase"]
        base = {"go_go": oop_by_phase["phase1"],
                "slow_go": oop_by_phase["phase2"],
                "no_go": oop_by_phase["phase3"]}.get(phase, 0)
        return base * (1 + self.hc_infl) ** yrs

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
        seniors = 1 if age >= 65 else 0
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

        chk("Total Tax = Fixed-income + Payroll + Withdrawal",
            tax["total"],
            tax["onFixedIncome"] + tax["payrollTax"] + tax["onWithdrawals"],
            issues)

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
