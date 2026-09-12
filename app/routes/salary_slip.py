import os
import tempfile
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from app.services.salary_slip_ocr import process_salary_slip
from app.services.reconciliation import reconcile_salary_slip

router = APIRouter(prefix="/api/salary-slip", tags=["salary-slip"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_MB = 10


class SalarySlipResponse(BaseModel):
    extraction: dict
    reconciliation: dict | None = None


@router.post("/analyze", response_model=SalarySlipResponse)
async def analyze_salary_slip(
    file: UploadFile = File(...),
    tax_year: str = Form(default="2025-26"),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({size_mb:.1f}MB). Max size is {MAX_FILE_SIZE_MB}MB.",
        )

    # Save to a temp file since our OCR pipeline works off a file path,
    # not raw bytes. Always cleaned up in the finally block, even on error —
    # we never want to persist uploaded slips to disk longer than needed,
    # since these can contain real personal/financial data.
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        extraction = process_salary_slip(tmp_path)

        if extraction.get("status") == "failed":
            raise HTTPException(status_code=422, detail=extraction.get("reason", "Extraction failed"))

        reconciliation = None
        if extraction.get("status") in ("success", "low_confidence"):
            reconciliation = reconcile_salary_slip(extraction, tax_year=tax_year)

        return SalarySlipResponse(extraction=extraction, reconciliation=reconciliation)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)