from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SupplierProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)

    business_name: str = Field(min_length=1, max_length=200)
    industry: str = Field(min_length=1, max_length=200)
    business_permit: str = Field(min_length=1, max_length=2000)
    registration: str = Field(min_length=1, max_length=2000)
    delivery_capacity: str = Field(min_length=1, max_length=4000)


class EvidenceSource(BaseModel):
    document: str
    page: int | None = Field(default=None, ge=1)
    chunk_id: str
    excerpt: str


class RequirementAssessment(BaseModel):
    id: str
    requirement: str
    status: Literal[
        "documented_match", "self_reported_match", "missing", "unknown", "conflict"
    ]
    reason: str
    next_action: str
    source: EvidenceSource | None = None
    # Preserve every canonical citation; source remains the first for compatibility.
    sources: list[EvidenceSource] = Field(default_factory=list)


class TenderSummary(BaseModel):
    title: str | None = None
    deadline: str | None = None


class AnalysisResponse(BaseModel):
    tender: TenderSummary
    requirements: list[RequirementAssessment]
    overall: Literal["consider", "needs_review", "pause"]
    uncertainty: str


class RetrievedEvidence(BaseModel):
    """Canonical evidence shape shared with the AI assessment service."""

    model_config = ConfigDict(extra="forbid", strict=True)

    chunk_id: str = Field(min_length=1)
    document: str = Field(min_length=1)
    page: int | None = Field(ge=1)
    text: str = Field(min_length=1)

    @field_validator("chunk_id", "document", "text")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Evidence strings must not be blank")
        # Preserve canonical text and IDs rather than silently trimming them.
        return value
