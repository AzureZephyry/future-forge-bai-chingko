import io
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from pydantic import ValidationError
from pypdf import PdfReader
from backend.ai_assessment import AssessmentError, AssessmentValidationError, InferenceUnavailableError

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


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    request: Request,
    tender_file: Annotated[UploadFile, File(description="Text-based procurement PDF")],
    supplier_profile: Annotated[str, Form(description="JSON supplier profile")],
) -> AnalysisResponse:
    try:
        profile = SupplierProfile.model_validate_json(supplier_profile)
    except (ValidationError, ValueError) as exc:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid supplier_profile JSON or fields.") from exc

    contents = await tender_file.read(MAX_UPLOAD_BYTES + 1)
    await tender_file.close()
    if not contents:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "The uploaded PDF is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise _error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "PDF exceeds the 15 MiB upload limit.")
    # Check file bytes rather than trusting the submitted MIME type or filename.
    if not contents.startswith(b"%PDF-"):
        raise _error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "The uploaded file is not a PDF.")
    try:
        reader = PdfReader(io.BytesIO(contents), strict=True)
        if reader.is_encrypted or len(reader.pages) == 0:
            raise ValueError("Encrypted or page-less PDF")
        if not any((page.extract_text() or "").strip() for page in reader.pages):
            raise ValueError("PDF contains no extractable text")
    except Exception as exc:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "The PDF is malformed, encrypted, or has no extractable text.") from exc

    retrieval = getattr(request.app.state, "retrieval_service", None)
    assessment = getattr(request.app.state, "assessment_service", None)
    if retrieval is None or assessment is None:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "Retrieval and assessment services are not configured.")
    try:
        passages = retrieval.retrieve(contents, tender_file.filename or "tender.pdf", profile)
    except Exception as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Retrieval service failed.") from exc
    try:
        evidence = [RetrievedEvidence.model_validate(item) for item in passages]
    except (ValidationError, TypeError) as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Retrieval service returned invalid evidence metadata.") from exc
    if not evidence:
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "No relevant evidence was retrieved from the PDF.")
    evidence_by_id = {item.chunk_id: item for item in evidence}
    if len(evidence_by_id) != len(evidence):
        raise _error(status.HTTP_502_BAD_GATEWAY, "Retrieval service returned duplicate chunk IDs.")

    try:
        result = await assessment.assess(
            supplier_profile=profile.model_dump(mode="json"),
            evidence_chunks=[item.model_dump(mode="json") for item in evidence],
        )
        payload = result.to_dict()
    except InferenceUnavailableError as exc:
        raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "ALMA inference is unavailable.") from exc
    except AssessmentValidationError as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Assessment service returned an invalid assessment.") from exc
    except AssessmentError as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Assessment service failed.") from exc
    except Exception as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Assessment service failed.") from exc

    try:
        # The AI contract can cite multiple chunks while the existing API schema
        # exposes one source per requirement. Validate every ID; use the first
        # canonical citation in that existing field.
        requirements = []
        for index, item in enumerate(payload["requirements"], start=1):
            cited_ids = item["evidence_chunk_ids"]
            if not cited_ids or any(chunk_id not in evidence_by_id for chunk_id in cited_ids):
                raise ValueError("Assessment cited a chunk outside retrieved evidence")
            passage = evidence_by_id[cited_ids[0]]
            requirements.append(
                {
                    "id": f"requirement-{index}",
                    "requirement": item["requirement_description"],
                    "status": item["status"],
                    "reason": item["reasoning"],
                    "next_action": item["recommended_next_action"],
                    "source": EvidenceSource(
                        document=passage.document,
                        page=passage.page,
                        chunk_id=passage.chunk_id,
                        excerpt=passage.text,
                    ),
                }
            )
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise _error(status.HTTP_502_BAD_GATEWAY, "Assessment service returned an incompatible or unverifiable result.") from exc

    # AssessmentResult has no title, deadline, or overall decision. Keep tender
    # metadata empty and request review instead of inventing procurement facts.
    return AnalysisResponse(
        tender={"title": None, "deadline": None},
        requirements=requirements,
        overall="needs_review",
    )
