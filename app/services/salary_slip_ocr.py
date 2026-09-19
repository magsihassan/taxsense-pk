import os
import json
from pathlib import Path
from dotenv import load_dotenv
import pytesseract
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from pdf2image import convert_from_path
from pypdf import PdfReader
from langchain_groq import ChatGroq

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

import platform
import shutil

# --- Cross-platform Tesseract & Poppler setup ---
if platform.system() == "Windows":
    win_tesseract = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.exists(win_tesseract):
        pytesseract.pytesseract.tesseract_cmd = win_tesseract
    POPPLER_PATH = os.getenv("POPPLER_PATH", r"C:\path\to\poppler-xx\Library\bin")
else:
    # Linux (Railway / Docker / Cloud): uses system binaries in PATH
    pytesseract.pytesseract.tesseract_cmd = shutil.which("tesseract") or "tesseract"
    POPPLER_PATH = os.getenv("POPPLER_PATH", None)

LLM_MODEL = "openai/gpt-oss-120b"
CONFIDENCE_LEVELS = {"high": 3, "medium": 2, "low": 1}



def normalize_and_preprocess_image(image: Image.Image, retry_mode: bool = False) -> Image.Image:
    """
    Preprocess image for high OCR accuracy on smartphone camera photos, screen captures, and scans:
    1. EXIF auto-rotation (ensures phone photo isn't sideways).
    2. Auto-crop dark borders / desk backgrounds if document is centered on a surface.
    3. Rescale to optimal OCR resolution (1800px standard, or 1250px bilinear for screen photos).
    4. Grayscale conversion and balanced contrast boost (without sharpen, which causes moiré grid hangs).
    """
    try:
        image = ImageOps.exif_transpose(image) or image
    except Exception:
        pass

    # 1. Detect and crop dark desk background around a lighter page if present
    w, h = image.size
    try:
        gray_arr = np.array(image.convert("L"))
        corner_sample = float(np.mean([
            gray_arr[:max(1, int(h * 0.05)), :max(1, int(w * 0.05))],
            gray_arr[:max(1, int(h * 0.05)), -max(1, int(w * 0.05)):],
            gray_arr[-max(1, int(h * 0.05)):, :max(1, int(w * 0.05))],
            gray_arr[-max(1, int(h * 0.05)):, -max(1, int(w * 0.05)):],
        ]))
        center_sample = float(np.mean(gray_arr[int(h * 0.25):int(h * 0.75), int(w * 0.25):int(w * 0.75)]))

        cropped = image
        # If corners are dark (< 100) and center is bright (> 140), crop the desk background
        if corner_sample < 100 and center_sample > 140:
            mask = gray_arr > 90
            rows = np.any(mask, axis=1)
            cols = np.any(mask, axis=0)
            if np.any(rows) and np.any(cols):
                rmin, rmax = np.where(rows)[0][[0, -1]]
                cmin, cmax = np.where(cols)[0][[0, -1]]
                cropped = image.crop((cmin, rmin, cmax, rmax))
    except Exception:
        cropped = image

    # 2. Rescale: standard paper slips use ~1800px; retry / screen moiré uses ~1200px
    cw, ch = cropped.size
    target_w = 1200 if retry_mode else 1800
    resample_method = Image.Resampling.BILINEAR if retry_mode else Image.Resampling.LANCZOS

    scale = target_w / cw
    resized = cropped.resize((target_w, int(ch * scale)), resample_method)

    # 3. Grayscale and moderate contrast (avoid ImageFilter.SHARPEN which blows up screen moiré lines)
    gray = resized.convert("L")
    contrast_factor = 1.2 if retry_mode else 1.35
    enhanced = ImageEnhance.Contrast(gray).enhance(contrast_factor)

    return enhanced


def preprocess_image(image: Image.Image) -> Image.Image:
    """Wrapper for image preprocessing in retry pass."""
    return normalize_and_preprocess_image(image, retry_mode=True)


def extract_text_from_image(image_path: str, preprocess: bool = False) -> str:
    """
    OCR a single image file with fast dual-pass strategy:
    Pass 1: PSM 6 at 1800px Lanczos (ideal for standard paper slips).
    Pass 2: PSM 4 at 1250px Bilinear (ideal for monitor/screen photos with moiré patterns).
    """
    image = Image.open(image_path)
    processed = normalize_and_preprocess_image(image, retry_mode=preprocess)
    
    psm_mode = 4 if preprocess else 6
    text = pytesseract.image_to_string(processed, config=f"--psm {psm_mode}").strip()
    
    digits_count = sum(c.isdigit() for c in text)
    # If text is long AND has enough digits to contain salary figures, return it
    if len(text) > 300 and digits_count >= 8:
        return text

    # If first pass extracted sparse text or missed numbers, try alternate mode (1250px Bilinear PSM 4)
    alt_mode = 6 if psm_mode == 4 else 4
    alt_processed = normalize_and_preprocess_image(image, retry_mode=True)
    alt_text = pytesseract.image_to_string(alt_processed, config=f"--psm {alt_mode}").strip()

    alt_digits = sum(c.isdigit() for c in alt_text)
    # Prefer the output that actually found numbers
    score_orig = len(text) + 20 * digits_count
    score_alt = len(alt_text) + 20 * alt_digits

    if score_alt > score_orig:
        return alt_text

    return text


def extract_text_from_pdf(pdf_path: str, preprocess: bool = False) -> str:
    """
    Extract text from a PDF salary slip. Tries direct text extraction first
    (fast, works for digitally-generated PDFs). Falls back to OCR if the PDF
    is a scanned image with no embedded text layer.
    """
    reader = PdfReader(pdf_path)
    direct_text = "\n".join(page.extract_text() or "" for page in reader.pages)

    if len(direct_text.strip()) > 50 and not preprocess:
        return direct_text

    poppler_kwargs = {}
    if POPPLER_PATH and os.path.exists(POPPLER_PATH):
        poppler_kwargs["poppler_path"] = POPPLER_PATH

    images = convert_from_path(pdf_path, **poppler_kwargs)
    if preprocess:
        images = [preprocess_image(img) for img in images]
    ocr_text = "\n".join(pytesseract.image_to_string(img) for img in images)
    return ocr_text



def extract_raw_text(file_path: str, preprocess: bool = False) -> str:
    """Dispatch to the right extractor based on file extension."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in [".jpg", ".jpeg", ".png"]:
        return extract_text_from_image(file_path, preprocess=preprocess)
    elif ext == ".pdf":
        return extract_text_from_pdf(file_path, preprocess=preprocess)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


FIELD_EXTRACTION_PROMPT = """You are extracting structured data from OCR'd text of a Pakistani salary slip.
The OCR text may contain errors, misaligned spacing, or garbled characters — do your best to
interpret it despite noise.

Key Pakistani Payroll & Tax Conventions:
- Gross Salary / Gross Pay = Basic Pay + Allowances (House Rent, Medical, Utilities, Conveyance, etc.)
- Deductions: Includes statutory Withholding Tax / Income Tax, Provident Fund (PF), and EOBI.
- Net Salary / Net Take-Home Pay = Gross Salary minus Total Deductions.
- If deduction and net pay numbers appear under or after Gross Pay (for example: `25,000`, `18,000`, `239,000` after `Gross Pay 282,000` where 282,000 - 25,000 - 18,000 = 239,000), interpret them:
  * The statutory tax deduction is income_tax_deducted (e.g. 25000).
  * Voluntary or pension deductions (such as Provident Fund, EOBI) are other_deductions (e.g. 18000).
  * The bottom net take-home figure is net_salary (e.g. 239000).

Extract the following fields. If a field is not present or cannot be inferred, use null.

Return ONLY valid JSON in this exact structure, nothing else:
{{
  "employee_name": string or null,
  "employer_name": string or null,
  "pay_period": string or null,
  "gross_salary": number or null,
  "basic_salary": number or null,
  "allowances_total": number or null,
  "income_tax_deducted": number or null,
  "other_deductions": number or null,
  "net_salary": number or null,
  "extraction_confidence": "high" | "medium" | "low"
}}

Set extraction_confidence to "low" if key salary figures (gross salary, tax) are missing or completely unreadable. Set "medium" if core figures are present even if minor fields are omitted. Set "high" only if the document is clear and unambiguous.

OCR TEXT:
{ocr_text}
"""


def extract_fields(ocr_text: str) -> dict:
    """Use an LLM to parse structured fields out of noisy OCR text."""
    llm = ChatGroq(model=LLM_MODEL, temperature=0)
    prompt = FIELD_EXTRACTION_PROMPT.format(ocr_text=ocr_text)
    response = llm.invoke(prompt)

    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]

    try:
        data = json.loads(content.strip())
        if isinstance(data, dict):
            # Compute allowances total if not explicitly provided
            if data.get("allowances_total") is None and data.get("gross_salary") is not None and data.get("basic_salary") is not None:
                diff = data["gross_salary"] - data["basic_salary"]
                if diff > 0:
                    data["allowances_total"] = diff

            # Compute net salary if not explicitly provided or extracted
            if data.get("net_salary") is None and data.get("gross_salary") is not None and data.get("income_tax_deducted") is not None:
                other = data.get("other_deductions") or 0
                data["net_salary"] = data["gross_salary"] - data["income_tax_deducted"] - other

            # Compute tax deducted if net and other deductions are present
            if data.get("income_tax_deducted") is None and data.get("gross_salary") is not None and data.get("net_salary") is not None:
                tot_ded = data["gross_salary"] - data["net_salary"]
                other = data.get("other_deductions") or 0
                if tot_ded > other:
                    data["income_tax_deducted"] = tot_ded - other

        return data
    except json.JSONDecodeError:
        return {
            "error": "Failed to parse LLM response as JSON",
            "raw_response": content,
            "extraction_confidence": "low",
        }



CRITICAL_FIELDS = ["gross_salary", "income_tax_deducted", "net_salary"]


def validate_confidence(fields: dict) -> str:
    """
    Don't fully trust the LLM's self-reported confidence — verify it against
    how many critical fields actually came back populated. A mostly-empty
    extraction should never be rated above 'low', regardless of what the
    model claims.
    """
    llm_confidence = fields.get("extraction_confidence", "low")
    missing_critical = sum(1 for f in CRITICAL_FIELDS if fields.get(f) is None)

    if missing_critical >= 2:
        return "low"
    elif missing_critical == 1:
        return "medium" if llm_confidence == "high" else llm_confidence
    return llm_confidence


def process_salary_slip(file_path: str) -> dict:
    """
    Full pipeline with confidence-based fallback:
    1. Run OCR + field extraction normally.
    2. If confidence is "low", retry with image preprocessing (contrast/sharpen).
    3. If still "low" after retry, flag clearly for manual entry rather than
       silently returning unreliable numbers — this matters a lot for a tax
       tool, where a wrong silent guess is worse than an honest "couldn't read this."
    """
    raw_text = extract_raw_text(file_path, preprocess=False)
    if not raw_text.strip():
        return {
            "status": "failed",
            "reason": "No text could be extracted from this file.",
            "suggestion": "manual_entry",
        }

    fields = extract_fields(raw_text)
    fields["extraction_confidence"] = validate_confidence(fields)
    confidence = fields["extraction_confidence"]

    if confidence == "low":
        print("Low confidence on first pass — retrying with image preprocessing...")
        raw_text_retry = extract_raw_text(file_path, preprocess=True)
        fields_retry = extract_fields(raw_text_retry)
        fields_retry["extraction_confidence"] = validate_confidence(fields_retry)
        retry_confidence = fields_retry["extraction_confidence"]

        orig_fields_count = sum(1 for k, v in fields.items() if v is not None and not k.startswith("_"))
        retry_fields_count = sum(1 for k, v in fields_retry.items() if v is not None and not k.startswith("_"))

        # Prefer retry pass if confidence improved OR if retry recovered more valid fields
        if (
            CONFIDENCE_LEVELS.get(retry_confidence, 1) > CONFIDENCE_LEVELS.get(confidence, 1)
            or retry_fields_count > orig_fields_count
        ):
            fields = fields_retry
            confidence = retry_confidence
            fields["_ocr_pass"] = "preprocessed_retry"
            fields["_raw_ocr_text"] = raw_text_retry
        else:
            fields["_ocr_pass"] = "original_failed_retry"

    if "_raw_ocr_text" not in fields:
        fields["_raw_ocr_text"] = raw_text
    fields["status"] = "success" if confidence != "low" else "low_confidence"

    if confidence == "low":
        fields["suggestion"] = "manual_entry"
        fields["message"] = (
            "This document couldn't be read reliably. Please verify the extracted "
            "figures carefully, or enter your salary details manually instead."
        )

    return fields


if __name__ == "__main__":
    test_file = "data/test_salary_slips/s3.pdf"
    if os.path.exists(test_file):
        result = process_salary_slip(test_file)
        print(json.dumps(result, indent=2, default=str))
    else:
        print(f"Test file not found: {test_file}")
        print("Create a synthetic test salary slip first, then update test_file path above.")