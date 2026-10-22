"""AI-local contracts and strict validation, not FastAPI request schemas."""

import json
from dataclasses import dataclass
from typing import Any, Literal, Mapping, Sequence, cast

AssessmentStatus = Literal[
    "documented_match", "self_reported_match", "missing", "unknown", "conflict"
]
STATUSES = (
    "documented_match", "self_reported_match", "missing", "unknown", "conflict"
)


class AssessmentError(Exception):
    """Base error for callers to translate at their application boundary."""


class InputValidationError(AssessmentError):
    """The caller supplied invalid profile or evidence data."""


class AssessmentValidationError(AssessmentError):
    """Inference returned malformed or unsupported assessment data."""


class InferenceError(AssessmentError):
    """A provider failed to produce a response."""


class InferenceUnavailableError(InferenceError):
    """Real inference is not configured or implemented."""


@dataclass(frozen=True)
class RequirementAssessment:
    requirement_description: str
    status: AssessmentStatus
    reasoning: str
    recommended_next_action: str
    evidence_chunk_ids: tuple[str, ...]


@dataclass(frozen=True)
class AssessmentResult:
    requirements: tuple[RequirementAssessment, ...]
    uncertainty: str

    def to_dict(self) -> dict[str, Any]:
        """Return JSON-ready values without adding citation metadata."""
        return {
            "requirements": [
                {
                    "requirement_description": item.requirement_description,
                    "status": item.status,
                    "reasoning": item.reasoning,
                    "recommended_next_action": item.recommended_next_action,
                    "evidence_chunk_ids": list(item.evidence_chunk_ids),
                }
                for item in self.requirements
            ],
            "uncertainty": self.uncertainty,
        }


def _is_json_value(value: Any) -> bool:
    if value is None or type(value) in (str, int, float, bool):
        return True
    if isinstance(value, dict):
        return all(type(k) is str and _is_json_value(v) for k, v in value.items())
    return isinstance(value, list) and all(_is_json_value(v) for v in value)


def prepare_inputs(
    supplier_profile: Mapping[str, Any],
    evidence_chunks: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Validate and snapshot caller data before any provider is called."""
    if not isinstance(supplier_profile, Mapping):
        raise InputValidationError("supplier_profile must be a JSON object")
    profile = dict(supplier_profile)
    try:
        valid_profile = _is_json_value(profile)
    except RecursionError as exc:
        raise InputValidationError("supplier_profile must contain acyclic JSON values") from exc
    if not valid_profile:
        raise InputValidationError("supplier_profile must contain only JSON values and string keys")
    if not isinstance(evidence_chunks, Sequence) or isinstance(evidence_chunks, (str, bytes)):
        raise InputValidationError("evidence_chunks must be a sequence of objects")
    chunks = []
    seen = set()
    for chunk in evidence_chunks:
        if not isinstance(chunk, Mapping) or set(chunk) != {"chunk_id", "document", "page", "text"}:
            raise InputValidationError("Each evidence chunk requires exactly chunk_id, document, page, text")
        for field in ("chunk_id", "document", "text"):
            if not isinstance(chunk[field], str) or not chunk[field].strip():
                raise InputValidationError(f"Evidence {field} must be a nonempty string")
        if chunk["chunk_id"] in seen:
            raise InputValidationError("Evidence chunk_id values must be unique")
        seen.add(chunk["chunk_id"])
        page = chunk["page"]
        if page is not None and (type(page) is not int or page < 1):
            raise InputValidationError("Evidence page must be a positive integer or null")
        chunks.append(dict(chunk))
    try:
        return json.loads(json.dumps(
            {"supplier_profile": profile, "evidence_chunks": chunks}, allow_nan=False
        ))
    except (ValueError, TypeError, RecursionError) as exc:
        raise InputValidationError("Inputs must be finite, serializable JSON values") from exc


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise AssessmentValidationError("Model JSON contains duplicate keys")
        result[key] = value
    return result


def _reject_constant(value: str) -> None:
    raise AssessmentValidationError("Model JSON contains a nonstandard numeric constant")


def validate_response(raw: str, known_chunk_ids: set[str]) -> AssessmentResult:
    if not isinstance(raw, str):
        raise AssessmentValidationError("Provider response must be a JSON string")
    try:
        data = json.loads(raw, object_pairs_hook=_unique_object, parse_constant=_reject_constant)
    except (ValueError, RecursionError) as exc:
        raise AssessmentValidationError("Provider response is not valid JSON") from exc
    if not isinstance(data, dict) or set(data) != {"requirements", "uncertainty"}:
        raise AssessmentValidationError("Response requires exactly requirements and uncertainty")
    if not isinstance(data["requirements"], list) or not isinstance(data["uncertainty"], str):
        raise AssessmentValidationError("requirements must be a list and uncertainty must be a string")
    if not data["requirements"] and not data["uncertainty"].strip():
        raise AssessmentValidationError("An empty assessment must explain its uncertainty")
    fields = {
        "requirement_description", "status", "reasoning",
        "recommended_next_action", "evidence_chunk_ids",
    }
    items = []
    for row in data["requirements"]:
        if not isinstance(row, dict) or set(row) != fields:
            raise AssessmentValidationError("Requirement fields do not match the assessment contract")
        for field in fields - {"evidence_chunk_ids"}:
            if not isinstance(row[field], str) or not row[field].strip():
                raise AssessmentValidationError(f"Requirement {field} must be a nonempty string")
        if row["status"] not in STATUSES:
            raise AssessmentValidationError("Unsupported assessment status")
        ids = row["evidence_chunk_ids"]
        if not isinstance(ids, list) or not ids or any(not isinstance(cid, str) for cid in ids):
            raise AssessmentValidationError("Each requirement needs a nonempty list of evidence chunk IDs")
        if len(set(ids)) != len(ids):
            raise AssessmentValidationError("Requirement evidence chunk IDs must be unique")
        if not set(ids) <= known_chunk_ids:
            raise AssessmentValidationError("Requirement references unknown evidence chunk IDs")
        items.append(RequirementAssessment(
            requirement_description=row["requirement_description"],
            status=cast(AssessmentStatus, row["status"]),
            reasoning=row["reasoning"],
            recommended_next_action=row["recommended_next_action"],
            evidence_chunk_ids=tuple(ids),
        ))
    return AssessmentResult(tuple(items), data["uncertainty"])
