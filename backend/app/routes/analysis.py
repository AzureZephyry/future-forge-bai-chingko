import io
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from pypdf import PdfReader
from starlette.concurrency import run_in_threadpool
from backend.ai_assessment import (
    AssessmentError,
    AssessmentValidationError,
    InferenceError,
    InferenceUnavailableError,
    InputValidationError,
)

from ..schemas.assessment import (
    AnalysisResponse,
    EvidenceSource,
    RetrievedEvidence,
    SupplierProfile,
)

router = APIRouter(prefix="/api", tags=["analysis"])
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


def _error(code: int, detail: str) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


def _validate_pdf(contents: bytes) -> None:
    reader = PdfReader(io.BytesIO(contents), strict=True)
    if reader.is_encrypted or len(reader.pages) == 0:
        raise ValueError("Encrypted or page-less PDF")
    if not any((page.extract_text() or "").strip() for page in reader.pages):
        raise ValueError("PDF contains no extractable text")


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    request: Request,
    tender_file: Annotated[UploadFile, File(description="Text-based procurement PDF")],
    supplier_profile: Annotated[str, Form(description="JSON supplier profile")],
) -> AnalysisResponse:
    try:
        profile = SupplierProfile.model_validate_json(supplier_profile)
    except (ValidationError, ValueError) as exc:
        raise _error(422, "Invalid supplier_profile JSON or fields.") from exc

    contents = await tender_file.read(MAX_UPLOAD_BYTES + 1)
    await tender_file.close()
    if not contents:
        raise _error(422, "The uploaded PDF is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise _error(413, "PDF exceeds the 15 MiB upload limit.")
    # Check file bytes rather than trusting the submitted MIME type or filename.
    if not contents.startswith(b"%PDF-"):
        raise _error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "The uploaded file is not a PDF.")
    try:
        await run_in_threadpool(_validate_pdf, contents)
    except Exception as exc:
        raise _error(422, "The PDF is malformed, encrypted, or has no extractable text.") from exc

    retrieval = getattr(request.app.state, "retrieval_service", None)
    assessment = getattr(request.app.state, "assessment_service", None)
    if retrieval is None or assessment is None:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "Retrieval and assessment services are not configured.")
    try:
        passages = await run_in_threadpool(
            retrieval.retrieve, contents, tender_file.filename or "tender.pdf", profile
        )
    except Exception as exc:
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Retrieval service failed.") from exc
    try:
        evidence = [RetrievedEvidence.model_validate(item) for item in passages]
    except Exception as exc:
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Retrieval service returned invalid evidence metadata.") from exc
    if not evidence:
        raise _error(422, "No relevant evidence was retrieved from the PDF.")
    evidence_by_id = {item.chunk_id: item for item in evidence}
    if len(evidence_by_id) != len(evidence):
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Retrieval service returned duplicate chunk IDs.")

    try:
        result = await assessment.assess(
            supplier_profile=profile.model_dump(mode="json"),
            evidence_chunks=[item.model_dump(mode="json") for item in evidence],
        )
    except InferenceUnavailableError as exc:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "ALMA inference is unavailable.") from exc
    except InputValidationError as exc:
        # Client input and retrieval metadata were validated above. A failure
        # here indicates an internal adapter/contract bug, not client misconduct.
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Assessment input adaptation failed.") from exc
    except AssessmentValidationError as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Assessment service returned an invalid assessment.") from exc
    except (InferenceError, AssessmentError) as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Assessment service failed.") from exc
    except Exception as exc:
        raise _error(status.HTTP_500_INTERNAL_SERVER_ERROR, "Assessment service failed.") from exc

    try:
        payload = result.to_dict()
        # Resolve every citation from validated retrieval metadata. Keep the
        # first source for compatibility and retain all sources for review.
        requirements = []
        for index, item in enumerate(payload["requirements"], start=1):
            cited_ids = item["evidence_chunk_ids"]
            if not cited_ids or any(chunk_id not in evidence_by_id for chunk_id in cited_ids):
                raise ValueError("Assessment cited a chunk outside retrieved evidence")
            sources = [
                EvidenceSource(
                    document=evidence_by_id[chunk_id].document,
                    page=evidence_by_id[chunk_id].page,
                    chunk_id=chunk_id,
                    excerpt=evidence_by_id[chunk_id].text,
                )
                for chunk_id in cited_ids
            ]
            requirements.append(
                {
                    "id": f"requirement-{index}",
                    "requirement": item["requirement_description"],
                    "status": item["status"],
                    "reason": item["reasoning"],
                    "next_action": item["recommended_next_action"],
                    "source": sources[0],
                    "sources": sources,
                }
            )
        # The AI contract has no title, deadline, or overall eligibility decision.
        return AnalysisResponse(
            tender={"title": None, "deadline": None},
            requirements=requirements,
            overall="needs_review",
            uncertainty=payload["uncertainty"],
        )
    except (AttributeError, KeyError, TypeError, ValueError) as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Assessment service returned an incompatible or unverifiable result.") from exc
