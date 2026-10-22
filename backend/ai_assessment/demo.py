"""Run the fictional fixture through the existing mock and service."""

import asyncio
import json
from pathlib import Path
from typing import Any

from .models import AssessmentResult
from .providers import MockProvider
from .service import AssessmentService


def load_demo_fixture() -> dict[str, Any]:
    """Load fresh fixture data; this is not retrieval or a production input schema."""
    path = Path(__file__).with_name("demo_fixture.json")
    return json.loads(path.read_text(encoding="utf-8"))


async def run_demo() -> AssessmentResult:
    fixture = load_demo_fixture()
    service = AssessmentService(
        provider=MockProvider(response=json.dumps(fixture["mock_response"]))
    )
    return await service.assess(
        supplier_profile=fixture["supplier_profile"],
        evidence_chunks=fixture["evidence_chunks"],
    )


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run_demo()).to_dict(), indent=2))
