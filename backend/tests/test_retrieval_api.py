"""Exercise the real retrieval adapter through the configured FastAPI route."""

import json

from fastapi.testclient import TestClient
import pymupdf

from backend.ai_assessment import AssessmentService, MockProvider
from backend.app.main import create_app
from backend.app.services.retrieval import TenderRetrievalService, retrieve_tender_evidence


PROFILE = {
    "business_name": "Example Supplier",
    "industry": "Office supplies",
    "business_permit": "Not supplied; unverified.",
    "registration": "Not supplied; unverified.",
    "delivery_capacity": "Not supplied; unverified.",
}


def _text_pdf_bytes():
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), "General tender overview.")
    document.new_page()
    document.new_page().insert_text(
        (72, 72),
        "Bidders must submit an audited financial statement before the bid closing date.",
    )
    pdf_bytes = document.tobytes()
    document.close()
    return pdf_bytes


def test_real_pdf_evidence_flows_through_api_with_mock_assessment():
    pdf_bytes = _text_pdf_bytes()
    filename = "fixture-tender.pdf"
    evidence = retrieve_tender_evidence(pdf_bytes, filename)
    assert evidence
    assert all(set(item) == {"chunk_id", "document", "page", "text"} for item in evidence)
    assert all(item["document"] == filename for item in evidence)
    assert all(item["page"] == 3 for item in evidence)
    assert all(
        item["text"] == "Bidders must submit an audited financial statement before the bid closing date."
        for item in evidence
    )

    response_fixture = {
        "requirements": [{
            "requirement_description": "The bidder must submit an audited financial statement.",
            "status": "unknown",
            "reasoning": "A tender requirement was retrieved; supplier evidence is unverified.",
            "recommended_next_action": "Confirm the financial statement is available.",
            "evidence_chunk_ids": [evidence[0]["chunk_id"]],
        }],
        "uncertainty": "Assessment uses a deterministic test provider.",
    }

    class RecordingRetrieval(TenderRetrievalService):
        def retrieve(self, pdf_data, document_name, supplier_profile):
            records = super().retrieve(pdf_data, document_name, supplier_profile)
            assert all(set(item) == {"chunk_id", "document", "page", "text"} for item in records)
            return records

    app = create_app(
        retrieval_service=RecordingRetrieval(),
        assessment_service=AssessmentService(
            MockProvider(response=json.dumps(response_fixture))
        ),
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/analyze",
            data={"supplier_profile": json.dumps(PROFILE)},
            files={"tender_file": (filename, pdf_bytes, "application/pdf")},
        )

    assert response.status_code == 200, response.text
    payload = response.json()
    source = payload["requirements"][0]["source"]
    assert source == {
        "document": filename,
        "page": 3,
        "chunk_id": evidence[0]["chunk_id"],
        "excerpt": evidence[0]["text"],
    }
    assert payload["uncertainty"] == response_fixture["uncertainty"]


def test_text_pdf_with_no_requirement_matches_returns_no_evidence():
    document = pymupdf.open()
    document.new_page().insert_text((72, 72), "A small blue room beside a quiet garden.")
    pdf_bytes = document.tobytes()
    document.close()

    assert retrieve_tender_evidence(pdf_bytes, "unmatched.pdf") == []
