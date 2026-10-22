import json

from fastapi.testclient import TestClient

from backend.ai_assessment import AssessmentService, MockProvider
from backend.ai_assessment.demo import load_demo_fixture
from backend.app.main import create_app
from backend.app.routes import analysis as analysis_route


def allow_text_pdf(monkeypatch) -> None:
    class Page:
        def extract_text(self):
            return "Tender text"

    class Reader:
        is_encrypted = False
        pages = [Page()]

        def __init__(self, *_args, **_kwargs):
            pass

    monkeypatch.setattr(analysis_route, "PdfReader", Reader)


PROFILE = {
    "business_name": "Acme Supply",
    "industry": "Office supplies",
    "business_permit": "BP-001",
    "registration": "REG-001",
    "delivery_capacity": "Nationwide delivery",
}


def test_health_reports_api_only() -> None:
    response = TestClient(create_app()).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_invalid_supplier_json_is_rejected() -> None:
    response = TestClient(create_app()).post(
        "/api/analyze",
        data={"supplier_profile": "not-json"},
        files={"tender_file": ("tender.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 422


def test_non_pdf_is_rejected() -> None:
    response = TestClient(create_app()).post(
        "/api/analyze",
        data={"supplier_profile": json.dumps(PROFILE)},
        files={"tender_file": ("tender.pdf", b"not a pdf", "application/pdf")},
    )
    assert response.status_code == 415


def test_unconfigured_services_fail_closed(monkeypatch) -> None:
    allow_text_pdf(monkeypatch)
    response = TestClient(create_app()).post(
        "/api/analyze",
        data={"supplier_profile": json.dumps(PROFILE)},
        files={"tender_file": ("tender.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 503


def test_mock_fixture_flows_through_assessment_and_api_mapping(monkeypatch) -> None:
    allow_text_pdf(monkeypatch)
    fixture = load_demo_fixture()
    observed = {}

    class Retrieval:
        def retrieve(self, data, filename, profile):
            assert data.startswith(b"%PDF-")
            assert filename == "tender.pdf"
            assert profile.business_name == "Acme Supply"
            return fixture["evidence_chunks"]

    class RecordingMockProvider(MockProvider):
        async def generate(self, prompt):
            observed["prompt"] = prompt
            return await super().generate(prompt)

    class RecordingAssessmentService(AssessmentService):
        async def assess(self, supplier_profile, evidence_chunks):
            observed["supplier_profile"] = supplier_profile
            observed["evidence_chunks"] = evidence_chunks
            return await super().assess(supplier_profile, evidence_chunks)

    assessment_service = RecordingAssessmentService(
        provider=RecordingMockProvider(response=json.dumps(fixture["mock_response"]))
    )
    response = TestClient(
        create_app(retrieval_service=Retrieval(), assessment_service=assessment_service)
    ).post(
        "/api/analyze",
        data={"supplier_profile": json.dumps(PROFILE)},
        files={"tender_file": ("tender.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["overall"] == "needs_review"
    assert result["tender"] == {"title": None, "deadline": None}
    assert len(result["requirements"]) == 3
    assert result["requirements"][0]["status"] == "self_reported_match"
    assert result["requirements"][0]["source"]["chunk_id"] == "demo-tender-stock"
    assert result["requirements"][0]["source"]["excerpt"] == fixture["evidence_chunks"][0]["text"]
    assert observed["supplier_profile"] == PROFILE
    assert observed["evidence_chunks"] == fixture["evidence_chunks"]


def test_rejects_unverifiable_source_reference(monkeypatch) -> None:
    allow_text_pdf(monkeypatch)
    fixture = load_demo_fixture()
    bad_response = json.loads(json.dumps(fixture["mock_response"]))
    bad_response["requirements"][0]["evidence_chunk_ids"] = ["fabricated"]
    service = AssessmentService(
        provider=MockProvider(response=json.dumps(bad_response))
    )
    class Retrieval:
        def retrieve(self, *_args):
            return fixture["evidence_chunks"]

    response = TestClient(
        create_app(
            retrieval_service=Retrieval(),
            assessment_service=service,
        )
    ).post(
        "/api/analyze",
        data={"supplier_profile": json.dumps(PROFILE)},
        files={"tender_file": ("tender.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert response.status_code == 502
