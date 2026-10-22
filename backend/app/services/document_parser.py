
from pathlib import Path
import pymupdf as fitz


def extract_pdf_text(file_path):
    file_path = Path(file_path)

    if not file_path.is_file():
        raise FileNotFoundError("PDF file was not found.")

    if file_path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported.")

    pages = []

    try:
        with fitz.open(file_path) as document:
            if document.is_encrypted:
                raise ValueError("Encrypted PDFs are not supported.")

            if len(document) == 0:
                raise ValueError("The PDF has no pages.")

            for page_number, page in enumerate(document, start=1):
                text = page.get_text("text").strip()

                if text:
                    pages.append({
                        "document": file_path.name,
                        "page": page_number,
                        "text": text
                    })

    except fitz.FileDataError as error:
        raise ValueError("The PDF file is invalid or damaged.") from error

    if not pages:
        raise ValueError(
            "No extractable text was found in the PDF."
        )

    return pages


def extract_pdf_text_from_bytes(pdf_bytes, filename):
    """Extract page text from uploaded PDF bytes, preserving ``filename``.

    Raises ``ValueError`` for empty, malformed, encrypted, or textless PDFs and
    ``TypeError`` when the bytes or filename have an unsupported type.
    Scanned pages are not OCR-processed.
    """
    if not isinstance(pdf_bytes, bytes):
        raise TypeError("PDF content must be provided as bytes.")
    if not pdf_bytes:
        raise ValueError("PDF content is empty.")
    if not isinstance(filename, str):
        raise TypeError("PDF filename must be a string.")
    if not filename.strip():
        raise ValueError("PDF filename must not be empty.")
    if Path(filename).suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported.")

    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            if document.is_encrypted:
                raise ValueError("Encrypted PDFs are not supported.")

            if len(document) == 0:
                raise ValueError("The PDF has no pages.")

            pages = []
            for page_number, page in enumerate(document, start=1):
                text = page.get_text("text").strip()
                if text:
                    pages.append({
                        "document": filename,
                        "page": page_number,
                        "text": text,
                    })
    except (fitz.EmptyFileError, fitz.FileDataError) as error:
        raise ValueError("The PDF bytes are invalid or damaged.") from error

    if not pages:
        raise ValueError("No extractable text was found in the PDF.")

    return pages
