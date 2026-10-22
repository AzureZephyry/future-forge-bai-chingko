"""Assessment orchestration within the AI boundary only."""

from typing import Any, Mapping, Sequence

from .models import AssessmentResult, InferenceError, prepare_inputs, validate_response
from .prompting import build_prompt
from .providers import ModelProvider


class AssessmentService:
    def __init__(self, provider: ModelProvider) -> None:
        self._provider = provider

    async def assess(
        self,
        supplier_profile: Mapping[str, Any],
        evidence_chunks: Sequence[Mapping[str, Any]],
    ) -> AssessmentResult:
        inputs = prepare_inputs(supplier_profile, evidence_chunks)
        prompt = build_prompt(inputs)
        try:
            raw = await self._provider.generate(prompt)
        except InferenceError:
            raise
        except Exception as exc:
            # Do not echo provider details (potential credentials or response data).
            raise InferenceError("Model inference failed; no assessment was produced") from exc
        return validate_response(raw, {chunk["chunk_id"] for chunk in inputs["evidence_chunks"]})
