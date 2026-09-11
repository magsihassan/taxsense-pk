from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.services.tax_calculator import calculate_tax, TAX_SLABS, SURCHARGE_THRESHOLD, SURCHARGE_RATE

router = APIRouter(prefix="/api/tax", tags=["tax"])


class TaxCalculationRequest(BaseModel):
    annual_taxable_income: float = Field(..., ge=0, description="Annual taxable income in PKR")
    tax_year: str = Field(default="2025-26", description="Tax year e.g. 2025-26 or 2026-27")


class TaxCalculationResponse(BaseModel):
    tax_year: str
    annual_taxable_income: float
    slab_range: str
    base_tax: float
    marginal_rate: str
    tax_before_surcharge: float
    surcharge: float
    total_tax: float
    effective_rate: str
    monthly_withholding_estimate: float


@router.post("/calculate", response_model=TaxCalculationResponse)
async def calculate(req: TaxCalculationRequest):
    if req.tax_year not in TAX_SLABS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tax_year '{req.tax_year}'. Supported years: {list(TAX_SLABS.keys())}"
        )
    try:
        result = calculate_tax(req.annual_taxable_income, req.tax_year)
        return TaxCalculationResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.get("/slabs")
async def get_slabs():
    formatted_slabs = {}
    for year, slabs in TAX_SLABS.items():
        formatted_slabs[year] = [
            {
                "lower": s.lower,
                "upper": s.upper,
                "base_tax": s.base_tax,
                "rate": s.rate,
                "rate_display": f"{s.rate * 100:.0f}%",
                "label": f"PKR {s.lower:,.0f} to {f'PKR {s.upper:,.0f}' if s.upper else 'Above'}"
            }
            for s in slabs
        ]
    return {
        "slabs": formatted_slabs,
        "surcharge_threshold": SURCHARGE_THRESHOLD,
        "surcharge_rates": SURCHARGE_RATE
    }
