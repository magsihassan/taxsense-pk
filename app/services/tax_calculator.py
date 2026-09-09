"""
Deterministic salaried-individual income tax calculator for Pakistan.

Rates are hardcoded from official FBR/Finance Act sources rather than
retrieved and computed by the LLM, to guarantee arithmetic accuracy.

Sources:
- TY2025-26 (July 2025 - June 2026): FBR Circular No. 01 of 2025-26,
  Finance Act 2025 amendments.
- TY2026-27 (July 2026 - June 2027): Finance Act 2026 (Budget FY2026-27,
  presented June 12, 2026).

IMPORTANT: Verify these against the actual Finance Act 2026 PDF in your
knowledge base before relying on this for the live project. Slab data
below reflects rates reported by multiple tax-calculator sources as of
September 2026 — cross-check against your own primary-source document.
"""

from dataclasses import dataclass


@dataclass
class Slab:
    lower: float
    upper: float | None  # None = no upper bound
    base_tax: float
    rate: float  # marginal rate applied to amount exceeding `lower`


TAX_SLABS = {
    "2025-26": [
        Slab(0, 600_000, 0, 0.0),
        Slab(600_000, 1_200_000, 0, 0.01),
        Slab(1_200_000, 2_200_000, 6_000, 0.11),
        Slab(2_200_000, 3_200_000, 116_000, 0.23),
        Slab(3_200_000, 4_100_000, 346_000, 0.30),
        Slab(4_100_000, None, 616_000, 0.35),
    ],
    "2026-27": [
        Slab(0, 600_000, 0, 0.0),
        Slab(600_000, 1_200_000, 0, 0.01),
        Slab(1_200_000, 2_200_000, 6_000, 0.11),
        Slab(2_200_000, 3_200_000, 116_000, 0.20),
        Slab(3_200_000, 4_100_000, 316_000, 0.25),
        Slab(4_100_000, 5_600_000, 541_000, 0.29),
        Slab(5_600_000, 7_000_000, 976_000, 0.32),
        Slab(7_000_000, None, 1_424_000, 0.35),
    ],
}

# 9% surcharge on computed tax if taxable income > 10,000,000.
# Applies to TY2025-26. Abolished for salaried individuals from TY2026-27.
SURCHARGE_THRESHOLD = 10_000_000
SURCHARGE_RATE = {
    "2025-26": 0.09,
    "2026-27": 0.0,
}


def calculate_tax(annual_taxable_income: float, tax_year: str = "2025-26") -> dict:
    """
    Calculate income tax for a salaried individual in Pakistan.

    Args:
        annual_taxable_income: Total annual taxable salary income in PKR.
        tax_year: "2025-26" or "2026-27".

    Returns:
        dict with slab used, base tax, marginal tax, surcharge, and total.
    """
    if tax_year not in TAX_SLABS:
        raise ValueError(f"Unsupported tax_year '{tax_year}'. Use one of {list(TAX_SLABS)}")

    if annual_taxable_income < 0:
        raise ValueError("Income cannot be negative")

    slabs = TAX_SLABS[tax_year]
    matched_slab = None
    for slab in slabs:
        if slab.upper is None or annual_taxable_income <= slab.upper:
            if annual_taxable_income > slab.lower or slab.lower == 0:
                matched_slab = slab
                break

    if matched_slab is None:
        matched_slab = slabs[-1]

    excess = max(0, annual_taxable_income - matched_slab.lower)
    marginal_tax = excess * matched_slab.rate
    base_tax = matched_slab.base_tax if annual_taxable_income > matched_slab.lower else 0
    tax_before_surcharge = base_tax + marginal_tax if annual_taxable_income > matched_slab.lower else marginal_tax

    # Recompute cleanly: total tax = base_tax + rate * (income - lower_bound)
    total_before_surcharge = matched_slab.base_tax + (annual_taxable_income - matched_slab.lower) * matched_slab.rate
    total_before_surcharge = max(0, total_before_surcharge)

    surcharge = 0.0
    if annual_taxable_income > SURCHARGE_THRESHOLD:
        surcharge = total_before_surcharge * SURCHARGE_RATE.get(tax_year, 0.0)

    total_tax = total_before_surcharge + surcharge

    return {
        "tax_year": tax_year,
        "annual_taxable_income": annual_taxable_income,
        "slab_range": f"{matched_slab.lower:,.0f} - {matched_slab.upper:,.0f}" if matched_slab.upper else f"Above {matched_slab.lower:,.0f}",
        "base_tax": round(matched_slab.base_tax, 2),
        "marginal_rate": f"{matched_slab.rate * 100:.0f}%",
        "tax_before_surcharge": round(total_before_surcharge, 2),
        "surcharge": round(surcharge, 2),
        "total_tax": round(total_tax, 2),
        "effective_rate": f"{(total_tax / annual_taxable_income * 100):.2f}%" if annual_taxable_income > 0 else "0%",
        "monthly_withholding_estimate": round(total_tax / 12, 2),
    }


if __name__ == "__main__":
    # Quick manual test
    test_incomes = [500_000, 1_200_000, 2_760_000, 5_000_000, 12_000_000]
    for income in test_incomes:
        for year in ["2025-26", "2026-27"]:
            result = calculate_tax(income, year)
            print(f"\nIncome: {income:,} | Tax Year: {year}")
            print(f"  Slab: {result['slab_range']} @ {result['marginal_rate']}")
            print(f"  Tax before surcharge: {result['tax_before_surcharge']:,.0f}")
            print(f"  Surcharge: {result['surcharge']:,.0f}")
            print(f"  Total tax: {result['total_tax']:,.0f}")
            print(f"  Effective rate: {result['effective_rate']}")