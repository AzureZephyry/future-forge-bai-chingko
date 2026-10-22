"""Explicit fixture server for browser tests, never production inference."""

import io
import json
import os
import sys

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from backend.ai_assessment import AssessmentService, MockProvider
from backend.ai_assessment.demo import load_demo_fixture
from backend.app.main import create_app


class FixtureRetrieval:
    """Returns fictional excerpts; does not retrieve from arbitrary uploaded PDFs."""

    def __init__(self, chunks):
        self.chunks = chunks

    def retrieve(self, pdf_bytes, filename, supplier_profile):
        return self.chunks


def create_fixture_app():
    if os.environ.get("BIDBRIDGE_TEST_MODE") != "1":
        raise RuntimeError("Fixture server requires explicit BIDBRIDGE_TEST_MODE=1")
    fixture = load_demo_fixture()
    return create_app(
        retrieval_service=FixtureRetrieval(fixture["evidence_chunks"]),
        assessment_service=AssessmentService(MockProvider(json.dumps(fixture["mock_response"]))),
        cors_origins=["http://127.0.0.1:4173", "http://localhost:5173", "http://127.0.0.1:5173"],
    )


def create_fixture_pdf():
    """Generate real text PDF bytes from the same fictional evidence fixture."""
    writer = PdfWriter()
    for chunk in load_demo_fixture()["evidence_chunks"]:
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({
                NameObject("/F1"): DictionaryObject({
                    NameObject("/Type"): NameObject("/Font"),
                    NameObject("/Subtype"): NameObject("/Type1"),
                    NameObject("/BaseFont"): NameObject("/Helvetica"),
                })
            })
        })
        text = chunk["text"].replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 36 750 Td ({text}) Tj ET".encode("ascii"))
        page[NameObject("/Contents")] = stream
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


if __name__ == "__main__":
    sys.stdout.buffer.write(create_fixture_pdf())
