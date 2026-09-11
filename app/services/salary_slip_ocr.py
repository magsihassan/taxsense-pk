import os
import json
from pathlib import Path
from dotenv import load_dotenv
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
from pdf2image import convert_from_path
from pypdf import PdfReader
from langchain_groq import ChatGroq

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()

# --- Windows-specific paths — update these to match your install locations ---
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
POPPLER_PATH = r"C:\path\to\poppler-xx\Library\bin"  # update this

LLM_MODEL = "openai/gpt-oss-120b"
CONFIDENCE_LEVELS = {"high": 3, "medium": 2, "low": 1}


def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Basic image enhancement to improve OCR accuracy on the retry pass:
    grayscale, contrast boost, and slight sharpening. Cheap to run, often
    meaningfully improves results on photographed (not scanned) documents.
    """
    gray = image.convert("L")
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(2.0)
    sharpened = enhanced.filter(ImageFilter.SHARPEN)
    return sharpened


def extract_text_from_image(image_path: str, preprocess: bool = False) -> str:
    """OCR a single image file. If preprocess=True, applies enhancement first
    (used on the retry pass after a low-confidence first attempt)."""
    image = Image.open(image_path)
    if preprocess:
        image = preprocess_image(image)
    text = pytesseract.image_to_string(image)
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

    images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
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

Extract the following fields. If a field is not present or unclear, use null.

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

Set extraction_confidence to "low" if the OCR text looks garbled, mostly nonsensical,
or key fields were ambiguous/unreadable. Set "medium" if some fields are unclear but
most are readable. Set "high" only if the text is clean and fields are unambiguous.
Do not guess numbers you cannot find — use null instead.

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
        return json.loads(content.strip())
    except json.JSONDecodeError:
        return {
            "error": "Failed to parse LLM response as JSON",
            "raw_response": content,
            "extraction_confidence": "low",
        }


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
    confidence = fields.get("extraction_confidence", "low")

    if confidence == "low":
        print("Low confidence on first pass — retrying with image preprocessing...")
        raw_text_retry = extract_raw_text(file_path, preprocess=True)
        fields_retry = extract_fields(raw_text_retry)
        retry_confidence = fields_retry.get("extraction_confidence", "low")

        if CONFIDENCE_LEVELS.get(retry_confidence, 1) > CONFIDENCE_LEVELS.get(confidence, 1):
            fields = fields_retry
            confidence = retry_confidence
            fields["_ocr_pass"] = "preprocessed_retry"
        else:
            fields["_ocr_pass"] = "original_failed_retry"

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