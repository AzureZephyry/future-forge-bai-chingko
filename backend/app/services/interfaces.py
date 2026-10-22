from typing import Any, Protocol

from ..schemas.assessment import RetrievedEvidence, SupplierProfile


class RetrievalService(Protocol):
    def retrieve(
        self, pdf_bytes: bytes, filename: str, supplier_profile: SupplierProfile
    ) -> list[RetrievedEvidence]: ...


class AssessmentService(Protocol):
    async def assess(
        self, supplier_profile: dict[str, Any], evidence: list[dict[str, Any]]
    ) -> Any: ...
