from typing import Any, Protocol

from backend.ai_assessment import AssessmentResult

from ..schemas.assessment import RetrievedEvidence, SupplierProfile


class RetrievalService(Protocol):
    def retrieve(
        self, pdf_bytes: bytes, filename: str, supplier_profile: SupplierProfile
    ) -> list[RetrievedEvidence | dict[str, Any]]: ...


class AssessmentServiceProtocol(Protocol):
    async def assess(
        self, supplier_profile: dict[str, Any], evidence_chunks: list[dict[str, Any]]
    ) -> AssessmentResult: ...
