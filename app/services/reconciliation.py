"""
Salary slip reconciliation: compares the tax actually withheld (from an
uploaded slip) against the correct tax owed (from our deterministic
calculator), and flags meaningful mismatches.
"""

from app.services.tax_calculator import calculate_tax

# If withholding differs from correct tax by more than this percentage,
# flag it as a mismatch worth the user's attention. Small differences are
# normal (rounding, mid-year adjustments) and shouldn't trigger false alarms.
MISMATCH_THRESHOLD_PCT = 5.0


def reconcile_salary_slip(extracted_fields: dict, tax_year: str = "2025-26") -> dict:
    """
    Compare a salary slip's withheld tax against the correct calculated tax.

    Args:
        extracted_fields: Output from salary_slip_ocr.process_salary_slip()
        tax_year: "2025-26" or "2026-27"

    Returns:
        dict with the comparison, mismatch flag, and a plain-language explanation.
    """
    gross_salary = extracted_fields.get("gross_salary")
    monthly_tax_withheld = extracted_fields.get("income_tax_deducted")

    if gross_salary is None or monthly_tax_withheld is None:
        return {
            "status": "incomplete",
            "message": (
                "Couldn't run reconciliation — the slip is missing gross salary "
                "or tax deducted figures. Please verify these fields manually."
            ),
        }

    # Assumption: this month's salary is representative of the full year.
    # Won't be accurate for someone with a mid-year raise, bonus month, or
    # irregular income — acceptable simplification for a single-slip check.
    estimated_annual_income = gross_salary * 12
    estimated_annual_withheld = monthly_tax_withheld * 12

    correct = calculate_tax(estimated_annual_income, tax_year)
    correct_annual_tax = correct["total_tax"]
    correct_monthly_tax = correct["monthly_withholding_estimate"]

    difference = estimated_annual_withheld - correct_annual_tax
    pct_difference = (
        abs(difference) / correct_annual_tax * 100 if correct_annual_tax > 0 else 0
    )

    is_mismatch = pct_difference > MISMATCH_THRESHOLD_PCT

    if is_mismatch:
        direction = "under-withheld" if difference < 0 else "over-withheld"
        message = (
            f"Based on your monthly salary of PKR {gross_salary:,.0f} (estimated "
            f"annual: PKR {estimated_annual_income:,.0f}), the correct monthly tax "
            f"withholding should be approximately PKR {correct_monthly_tax:,.0f}, but "
            f"your slip shows PKR {monthly_tax_withheld:,.0f} withheld — you appear "
            f"to be {direction} by about PKR {abs(difference) / 12:,.0f} per month "
            f"(PKR {abs(difference):,.0f} annually). This is worth raising with your "
            f"employer's payroll department, as it could mean an unexpected tax bill "
            f"or refund at filing time."
        )
    else:
        message = (
            f"Your withholding looks correct — based on an estimated annual income "
            f"of PKR {estimated_annual_income:,.0f}, your monthly tax deduction of "
            f"PKR {monthly_tax_withheld:,.0f} is close to the expected "
            f"PKR {correct_monthly_tax:,.0f}."
        )

    return {
        "status": "reconciled",
        "tax_year": tax_year,
        "estimated_annual_income": estimated_annual_income,
        "slip_monthly_tax_withheld": monthly_tax_withheld,
        "slip_estimated_annual_withheld": estimated_annual_withheld,
        "correct_annual_tax": correct_annual_tax,
        "correct_monthly_tax": correct_monthly_tax,
        "difference_annual": round(difference, 2),
        "pct_difference": round(pct_difference, 2),
        "is_mismatch": is_mismatch,
        "message": message,
        "disclaimer": (
            "This is an estimate based on a single month's salary slip and assumes "
            "consistent monthly income. Bonuses, raises, or other income sources "
            "are not accounted for. Verify with a tax consultant or FBR."
        ),
    }


if __name__ == "__main__":
    # Quick manual tests using the three synthetic slips' known values
    test_cases = [
        {"name": "Sample 1 (Ahmed - correct withholding)", "gross_salary": 235000, "income_tax_deducted": 21550},
        {"name": "Sample 2 (Sana - under-withheld)", "gross_salary": 282000, "income_tax_deducted": 25000},
        {"name": "Sample 3 (Bilal - correct withholding)", "gross_salary": 100000, "income_tax_deducted": 500},
    ]

    for case in test_cases:
        print(f"\n{'=' * 60}")
        print(case["name"])
        result = reconcile_salary_slip(case, tax_year="2025-26")
        print(f"Mismatch: {result['is_mismatch']}")
        print(f"Correct monthly tax: PKR {result['correct_monthly_tax']:,.0f}")
        print(f"Slip shows: PKR {result['slip_monthly_tax_withheld']:,.0f}")
        print(f"\n{result['message']}")