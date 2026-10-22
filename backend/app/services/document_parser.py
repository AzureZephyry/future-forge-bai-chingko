
from pathlib import Path
import fitz


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
