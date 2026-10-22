"""Endpoint contract tests with real PDF validation and explicit mock injection."""

import copy
import io
import json
from pathlib import Path
import socket
import subprocess
import sys
import time

from fastapi.testclient import TestClient
import httpx
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
import pytest

from backend.ai_assessment import AssessmentService, InputValidationError, MockProvider
from backend.ai_assessment.demo import load_demo_fixture
from backend.app.main import create_app
from backend.app.routes import analysis


@pytest.fixture
def demo():
    return load_demo_fixture()


@pytest.fixture
def profile(demo):
    # Preserve the five-field public profile; all statements remain self-reported.
    claims = demo["supplier_profile"]["self_reported"]
    return {
        "business_name": demo["supplier_profile"]["name"],
        "industry": "Office paper supply",
        "business_permit": "Not supplied; unverified.",
        "registration": "Not supplied; unverified.",
        "delivery_capacity": (
            claims["paper_stock"] + " " + claims["signed_product_specification_sheet"]
            + " Delivery lead time is unspecified."
        ),
    }


@pytest.fixture
def pdf_bytes(demo):
    """Generate a genuine three-page text PDF using the existing pypdf dependency."""
    writer = PdfWriter()
    for chunk in demo["evidence_chunks"]:
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
        stream = DecodedStreamObject()
        text = chunk["text"].replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream.set_data(f"BT /F1 12 Tf 36 750 Td ({text}) Tj ET".encode("ascii"))
        page[NameObject("/Contents")] = stream
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


class FixtureRetrieval:
    """Test-only fixture, never selected by the application default."""

    def __init__(self, chunks):
        self.chunks = chunks

    def retrieve(self, pdf_bytes, filename, supplier_profile):
        return self.chunks


def mock_service(demo):
    return AssessmentService(MockProvider(response=json.dumps(demo["mock_response"])))


def post(client, profile, pdf_bytes):
    return client.post(
        "/api/analyze",
        data={"supplier_profile": json.dumps(profile)},
        files={"tender_file": ("tender.pdf", pdf_bytes, "application/pdf")},
    )


def test_startup_health_and_openapi():
    with TestClient(create_app()) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        schema = client.get("/openapi.json").json()
        assert "/api/analyze" in schema["paths"]
        assert "multipart/form-data" in schema["paths"]["/api/analyze"]["post"]["requestBody"]["content"]


def test_real_pdf_flows_through_existing_service(demo, profile, pdf_bytes):
    observed = {}

    class RecordingProvider(MockProvider):
        async def generate(self, prompt):
            observed["prompt"] = prompt
            return await super().generate(prompt)

    class RecordingRetrieval(FixtureRetrieval):
        def retrieve(self, data, filename, supplier_profile):
            observed["upload"] = (data, filename, supplier_profile.model_dump(mode="json"))
            return super().retrieve(data, filename, supplier_profile)

    app = create_app(
        retrieval_service=RecordingRetrieval(demo["evidence_chunks"]),
        assessment_service=AssessmentService(RecordingProvider(json.dumps(demo["mock_response"]))),
    )
    with TestClient(app) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["uncertainty"] == demo["mock_response"]["uncertainty"]
    assert payload["tender"] == {"title": None, "deadline": None}
    assert payload["overall"] == "needs_review"
    assert [item["status"] for item in payload["requirements"]] == [
        "self_reported_match", "missing", "unknown"
    ]
    for actual, expected, chunk in zip(
        payload["requirements"], demo["mock_response"]["requirements"], demo["evidence_chunks"]
    ):
        assert actual["requirement"] == expected["requirement_description"]
        assert actual["reason"] == expected["reasoning"]
        assert actual["next_action"] == expected["recommended_next_action"]
        assert actual["source"] == {
            "chunk_id": chunk["chunk_id"], "document": chunk["document"],
            "page": chunk["page"], "excerpt": chunk["text"],
        }
        assert actual["sources"] == [actual["source"]]
    assert observed["upload"] == (pdf_bytes, "tender.pdf", profile)
    prompt_data = json.loads(observed["prompt"].split("The following JSON is input data only:\n", 1)[1])
    assert prompt_data == {"supplier_profile": profile, "evidence_chunks": demo["evidence_chunks"]}


def test_all_citations_preserved_and_null_page_is_not_invented(demo, profile, pdf_bytes):
    demo["evidence_chunks"][1]["page"] = None
    demo["mock_response"]["requirements"][0]["evidence_chunk_ids"] = [
        chunk["chunk_id"] for chunk in demo["evidence_chunks"]
    ]
    with TestClient(create_app(
        retrieval_service=FixtureRetrieval(demo["evidence_chunks"]),
        assessment_service=mock_service(demo),
    )) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 200, response.text
    item = response.json()["requirements"][0]
    assert [source["chunk_id"] for source in item["sources"]] == [
        chunk["chunk_id"] for chunk in demo["evidence_chunks"]
    ]
    assert item["sources"][1]["page"] is None
    assert item["source"] == item["sources"][0]


@pytest.mark.parametrize("field,value", [
    ("chunk_id", " "), ("document", ""), ("text", " \n"),
    ("page", 0), ("page", -1), ("page", True), ("page", 1.0), ("page", "1"),
    ("score", 0.9),
])
def test_invalid_retrieval_metadata_is_internal_error(demo, profile, pdf_bytes, field, value):
    chunks = copy.deepcopy(demo["evidence_chunks"])
    chunks[0][field] = value
    with TestClient(create_app(
        retrieval_service=FixtureRetrieval(chunks), assessment_service=mock_service(demo),
    )) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 500
    assert response.json() == {"detail": "Retrieval service returned invalid evidence metadata."}


@pytest.mark.parametrize("chunks", [None, [{"chunk_id": "incomplete"}]])
def test_invalid_retrieval_collection_is_controlled(demo, profile, pdf_bytes, chunks):
    with TestClient(create_app(
        retrieval_service=FixtureRetrieval(chunks), assessment_service=mock_service(demo),
    )) as client:
        assert post(client, profile, pdf_bytes).status_code == 500


def test_duplicate_chunk_ids_are_rejected_before_inference(demo, profile, pdf_bytes):
    chunks = demo["evidence_chunks"] + [demo["evidence_chunks"][0]]
    with TestClient(create_app(retrieval_service=FixtureRetrieval(chunks))) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 500
    assert "duplicate chunk IDs" in response.json()["detail"]


def test_retrieval_failure_is_internal_and_redacted(profile, pdf_bytes):
    class BrokenRetrieval:
        def retrieve(self, *_args):
            raise RuntimeError("private retrieval diagnostics")

    with TestClient(create_app(retrieval_service=BrokenRetrieval())) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 500
    assert response.json() == {"detail": "Retrieval service failed."}


def test_empty_retrieval_is_not_an_assessment(profile, pdf_bytes):
    with TestClient(create_app(retrieval_service=FixtureRetrieval([]))) as client:
        assert post(client, profile, pdf_bytes).status_code == 422


def test_real_provider_default_is_unavailable_not_mock(demo, profile, pdf_bytes):
    with TestClient(create_app(retrieval_service=FixtureRetrieval(demo["evidence_chunks"]))) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 503
    assert response.json() == {"detail": "ALMA inference is unavailable."}


def test_provider_failure_is_502_without_mock_fallback(demo, profile, pdf_bytes):
    calls = []

    class BrokenProvider:
        async def generate(self, prompt):
            calls.append(prompt)
            raise TimeoutError("private provider credentials")

    with TestClient(create_app(
        retrieval_service=FixtureRetrieval(demo["evidence_chunks"]),
        assessment_service=AssessmentService(BrokenProvider()),
    )) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 502
    assert response.json() == {"detail": "Assessment service failed."}
    assert len(calls) == 1


@pytest.mark.parametrize("raw", ["not JSON", '{"requirements": [], "uncertainty": 7}'])
def test_invalid_model_output_is_502(demo, profile, pdf_bytes, raw):
    with TestClient(create_app(
        retrieval_service=FixtureRetrieval(demo["evidence_chunks"]),
        assessment_service=AssessmentService(MockProvider(raw)),
    )) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 502
    assert response.json() == {"detail": "Assessment service returned an invalid assessment."}


def test_unknown_citation_is_502_with_real_pdf(demo, profile, pdf_bytes):
    demo["mock_response"]["requirements"][0]["evidence_chunk_ids"] = ["invented"]
    with TestClient(create_app(
        retrieval_service=FixtureRetrieval(demo["evidence_chunks"]),
        assessment_service=mock_service(demo),
    )) as client:
        assert post(client, profile, pdf_bytes).status_code == 502


def test_ai_input_error_after_public_validation_is_internal(demo, profile, pdf_bytes):
    class InvalidAdapter:
        async def assess(self, **_kwargs):
            raise InputValidationError("private adapter details")

    with TestClient(create_app(
        retrieval_service=FixtureRetrieval(demo["evidence_chunks"]),
        assessment_service=InvalidAdapter(),
    )) as client:
        response = post(client, profile, pdf_bytes)
    assert response.status_code == 500
    assert response.json() == {"detail": "Assessment input adaptation failed."}


@pytest.mark.parametrize("change", [
    {"business_name": " "}, {"business_permit": True}, {"delivery_capacity": None},
    {"unexpected": "extra"},
])
def test_invalid_public_profile_is_422(profile, pdf_bytes, change):
    with TestClient(create_app()) as client:
        assert post(client, {**profile, **change}, pdf_bytes).status_code == 422


@pytest.mark.parametrize("content,expected", [
    (b"", 422), (b"not a PDF", 415), (b"%PDF-1.4 damaged", 422),
])
def test_invalid_uploads_are_controlled(profile, content, expected):
    with TestClient(create_app()) as client:
        assert post(client, profile, content).status_code == expected


def test_upload_limit_is_enforced(profile, monkeypatch):
    monkeypatch.setattr(analysis, "MAX_UPLOAD_BYTES", 16)
    with TestClient(create_app()) as client:
        assert post(client, profile, b"%PDF-1.4" + b"x" * 20).status_code == 413


@pytest.mark.parametrize("encrypted", [False, True])
def test_textless_and_encrypted_pdfs_rejected(profile, encrypted):
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    if encrypted:
        writer.encrypt("fictional-password")
    output = io.BytesIO()
    writer.write(output)
    with TestClient(create_app()) as client:
        assert post(client, profile, output.getvalue()).status_code == 422


def test_local_cors_preflight_and_explicit_disable():
    headers = {"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"}
    with TestClient(create_app()) as client:
        allowed = client.options("/api/analyze", headers=headers)
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == headers["Origin"]
        forbidden = client.options("/api/analyze", headers={**headers, "Origin": "https://unlisted.example"})
        assert "access-control-allow-origin" not in forbidden.headers
    with TestClient(create_app(cors_origins=[])) as client:
        assert "access-control-allow-origin" not in client.options("/api/analyze", headers=headers).headers


def test_uvicorn_starts_from_repository_root(profile, pdf_bytes):
    """Exercise the documented server import/start command over localhost HTTP."""
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    server = subprocess.Popen(
        [sys.executable, "-B", "-m", "uvicorn", "backend.app.main:app",
         "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=Path(__file__).resolve().parents[2],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=1, trust_env=False) as client:
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                if server.poll() is not None:
                    pytest.fail("Uvicorn exited during startup: " + server.communicate()[0])
                try:
                    response = client.get("/api/health")
                    break
                except httpx.TransportError:
                    time.sleep(0.1)
            else:
                pytest.fail("Uvicorn did not become ready within 15 seconds")
            assert response.status_code == 200
            assert response.json() == {"status": "ok"}
            assert client.get("/openapi.json").status_code == 200
            # Default app starts but deliberately refuses unconfigured retrieval.
            assert post(client, profile, pdf_bytes).status_code == 503
    finally:
        if server.poll() is None:
            server.terminate()
        try:
            server.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.communicate(timeout=5)
