import json
from pathlib import Path
import subprocess
import sys
import unittest

from backend.ai_assessment import AssessmentService, AssessmentValidationError, MockProvider
from backend.ai_assessment.demo import load_demo_fixture, run_demo


class DemoTests(unittest.IsolatedAsyncioTestCase):
    async def test_expected_statuses_and_preparation_actions(self):
        result = await run_demo()
        actual = {
            item.requirement_description: (item.status, item.recommended_next_action)
            for item in result.requirements
        }
        self.assertEqual(len(result.requirements), 3)
        self.assertEqual(actual, {
            "Supply 100 boxes of A4 recycled paper.": (
                "self_reported_match",
                "Upload stock records confirming availability of 100 boxes of A4 recycled paper.",
            ),
            "Submit a signed product specification sheet for the offered paper.": (
                "missing",
                "Prepare and sign a product specification sheet for the offered paper.",
            ),
            "Deliver within 14 calendar days of receiving a purchase order.": (
                "unknown",
                "Confirm the delivery lead time and provide a plan showing whether delivery within 14 calendar days of a purchase order is feasible.",
            ),
        })
        fixture = load_demo_fixture()
        claims = fixture["supplier_profile"]["self_reported"]
        self.assertIn("100 boxes of A4 recycled paper", claims["paper_stock"])
        self.assertIn("We do not have", claims["signed_product_specification_sheet"])
        self.assertIsNone(claims["delivery_lead_time_days"])

    async def test_each_requirement_cites_the_corresponding_tender_chunk(self):
        fixture = load_demo_fixture()
        result = await run_demo()
        self.assertEqual(len(fixture["evidence_chunks"]), 3)
        self.assertEqual(len({chunk["document"] for chunk in fixture["evidence_chunks"]}), 1)
        chunks = {chunk["chunk_id"]: chunk for chunk in fixture["evidence_chunks"]}
        expected_ids = {
            "self_reported_match": "demo-tender-stock",
            "missing": "demo-tender-specification",
            "unknown": "demo-tender-delivery",
        }
        for item in result.requirements:
            self.assertEqual(item.evidence_chunk_ids, (expected_ids[item.status],))
            self.assertTrue(set(item.evidence_chunk_ids) <= chunks.keys())

    async def test_demo_is_deterministic_and_identified_as_mock(self):
        first = await run_demo()
        second = await run_demo()
        self.assertEqual(first, second)
        self.assertIn("fixed mock demonstration using fictional data", first.uncertainty)

    async def test_fixture_uses_existing_unknown_citation_validation(self):
        fixture = load_demo_fixture()
        service = AssessmentService(MockProvider(json.dumps(fixture["mock_response"])))
        with self.assertRaisesRegex(AssessmentValidationError, "unknown evidence"):
            await service.assess(
                supplier_profile=fixture["supplier_profile"],
                evidence_chunks=fixture["evidence_chunks"][:-1],
            )


class RootInvocationTests(unittest.TestCase):
    def test_demo_imports_and_calls_service_from_repository_root(self):
        repository_root = Path(__file__).resolve().parents[3]
        completed = subprocess.run(
            [sys.executable, "-B", "-m", "backend.ai_assessment.demo"],
            cwd=repository_root,
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
        )
        self.assertEqual(json.loads(completed.stdout), load_demo_fixture()["mock_response"])
        self.assertEqual(completed.stderr, "")


if __name__ == "__main__":
    unittest.main()
