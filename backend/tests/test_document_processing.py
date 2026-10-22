import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pymupdf as fitz

from backend.app.services.document_parser import extract_pdf_text, extract_pdf_text_from_bytes
from backend.app.services.retrieval import (
    REQUIREMENT_QUERIES,
    chunk_pages,
    retrieve_relevant_passages,
    retrieve_tender_evidence,
)


class ChunkPagesTests(unittest.TestCase):
    def test_chunks_keep_source_metadata_and_exact_text(self):
        source = "Alpha  beta\ngamma delta"
        pages = [{"document": "source.pdf", "page": 2, "text": source}]

        chunks = chunk_pages(pages, chunk_size=2, overlap=0)

        self.assertEqual(len(chunks), 2)
        self.assertEqual(chunks[0]["text"], "Alpha  beta")
        self.assertEqual(chunks[1]["text"], "gamma delta")
        self.assertTrue(all(c["document"] == "source.pdf" and c["page"] == 2 for c in chunks))
        self.assertTrue(all(c["chunk_id"] for c in chunks))
        self.assertEqual(chunks, chunk_pages(pages, chunk_size=2, overlap=0))

    def test_overlap_repeats_words_between_chunks(self):
        chunks = chunk_pages(
            [{"document": "source.pdf", "page": 1, "text": "one two three four five"}],
            chunk_size=3,
            overlap=1,
        )

        self.assertEqual([chunk["text"] for chunk in chunks], ["one two three", "three four five"])

    def test_validates_chunk_size_and_overlap(self):
        cases = [(0, 0), (-1, 0), (2, -1), (2, 2), (True, 0)]
        for chunk_size, overlap in cases:
            with self.subTest(chunk_size=chunk_size, overlap=overlap):
                with self.assertRaises(ValueError):
                    chunk_pages([], chunk_size=chunk_size, overlap=overlap)

    def test_chunk_ids_are_unique_for_repeated_page_records(self):
        duplicate_pages = [
            {"document": "source.pdf", "page": 1, "text": "same source passage"},
            {"document": "source.pdf", "page": 1, "text": "same source passage"},
        ]

        chunks = chunk_pages(duplicate_pages, chunk_size=20, overlap=0)

        self.assertEqual(len(chunks), 2)
        self.assertEqual(len({chunk["chunk_id"] for chunk in chunks}), 2)


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.chunks = [
            {"chunk_id": "a", "document": "bid.pdf", "page": 1,
             "text": "Eligibility requires three years of relevant experience."},
            {"chunk_id": "b", "document": "other.pdf", "page": 4,
             "text": "Office hours are Monday through Friday."},
            {"chunk_id": "c", "document": "bid.pdf", "page": 2,
             "text": "Relevant experience must include completed projects."},
        ]

    def test_relevant_results_rank_first_with_source_fields(self):
        results = retrieve_relevant_passages("relevant experience", self.chunks)

        self.assertEqual({result["chunk_id"] for result in results[:2]}, {"a", "c"})
        self.assertNotIn("b", [result["chunk_id"] for result in results])
        self.assertTrue(all(result["score"] > 0 for result in results))
        self.assertEqual(
            set(results[0]), {"chunk_id", "document", "page", "text", "score"}
        )

    def test_blank_query_and_empty_chunks_return_empty_list(self):
        self.assertEqual(retrieve_relevant_passages("  ", self.chunks), [])
        self.assertEqual(retrieve_relevant_passages("experience", []), [])

    def test_no_matching_terms_returns_empty_and_text_is_source(self):
        results = retrieve_relevant_passages("unmatchedword", self.chunks)
        self.assertEqual(results, [])

        results = retrieve_relevant_passages("eligibility", self.chunks)
        self.assertEqual(results[0]["text"], self.chunks[0]["text"])
        self.assertEqual(results[0]["document"], "bid.pdf")
        self.assertEqual(results[0]["page"], 1)


class PdfParserTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(dir=Path.cwd())
        self.addCleanup(self.temp_dir.cleanup)
        self.directory = Path(self.temp_dir.name)

    def test_missing_file_and_non_pdf(self):
        with self.assertRaises(FileNotFoundError):
            extract_pdf_text(self.directory / "missing.pdf")

        text_file = self.directory / "document.txt"
        text_file.write_text("not a PDF", encoding="utf-8")
        with self.assertRaises(ValueError):
            extract_pdf_text(text_file)

    def test_pdf_without_extractable_text(self):
        pdf_path = self.directory / "blank.pdf"
        with fitz.open() as pdf:
            pdf.new_page()
            pdf.save(pdf_path)

        with self.assertRaisesRegex(ValueError, "No extractable text"):
            extract_pdf_text(pdf_path)

    def test_invalid_pdf(self):
        pdf_path = self.directory / "damaged.pdf"
        pdf_path.write_bytes(b"not a valid PDF")

        with self.assertRaisesRegex(ValueError, "invalid or damaged"):
            extract_pdf_text(pdf_path)

    def test_extracts_document_name_and_one_based_page(self):
        pdf_path = self.directory / "actual-source.pdf"
        with fitz.open() as pdf:
            first = pdf.new_page()
            first.insert_text((72, 72), "Source passage for retrieval.")
            pdf.new_page()
            pdf.save(pdf_path)

        pages = extract_pdf_text(pdf_path)

        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["document"], "actual-source.pdf")
        self.assertEqual(pages[0]["page"], 1)
        self.assertEqual(pages[0]["text"], "Source passage for retrieval.")

    def test_path_interface_still_accepts_path_objects(self):
        pdf_path = self.directory / "path-interface.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page()
            page.insert_text((72, 72), "Path parser source.")
            pdf.save(pdf_path)

        self.assertEqual(extract_pdf_text(pdf_path)[0]["document"], "path-interface.pdf")

    def test_byte_parser_preserves_filename_and_original_page_numbers(self):
        pdf_path = self.directory / "uploaded.pdf"
        with fitz.open() as pdf:
            first = pdf.new_page()
            first.insert_text((72, 72), "First source passage.")
            pdf.new_page()
            third = pdf.new_page()
            third.insert_text((72, 72), "Third source passage.")
            pdf.save(pdf_path)

        pages = extract_pdf_text_from_bytes(pdf_path.read_bytes(), "caller-name.pdf")

        self.assertEqual([page["document"] for page in pages], ["caller-name.pdf"] * 2)
        self.assertEqual([page["page"] for page in pages], [1, 3])
        self.assertEqual([page["text"] for page in pages], [
            "First source passage.", "Third source passage."
        ])

    def test_byte_parser_rejects_empty_malformed_encrypted_and_textless_pdfs(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            extract_pdf_text_from_bytes(b"", "empty.pdf")
        with self.assertRaisesRegex(ValueError, "invalid or damaged"):
            extract_pdf_text_from_bytes(b"not a PDF", "broken.pdf")

        blank_path = self.directory / "blank-bytes.pdf"
        with fitz.open() as pdf:
            pdf.new_page()
            pdf.save(blank_path)
        with self.assertRaisesRegex(ValueError, "No extractable text"):
            extract_pdf_text_from_bytes(blank_path.read_bytes(), "blank-bytes.pdf")

        encrypted_path = self.directory / "encrypted.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page()
            page.insert_text((72, 72), "Encrypted source passage.")
            pdf.save(
                encrypted_path,
                encryption=fitz.PDF_ENCRYPT_AES_256,
                owner_pw="owner-password",
                user_pw="user-password",
            )
        with self.assertRaisesRegex(ValueError, "Encrypted"):
            extract_pdf_text_from_bytes(encrypted_path.read_bytes(), "encrypted.pdf")


class TenderEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(dir=Path.cwd())
        self.addCleanup(self.temp_dir.cleanup)
        self.directory = Path(self.temp_dir.name)

    def _prepared_retrieval(self, results):
        pages = [{"document": "tender.pdf", "page": 1, "text": "Source evidence."}]
        chunks = [{
            "chunk_id": "stable-id",
            "document": "tender.pdf",
            "page": 1,
            "text": "Source evidence.",
        }]
        return (
            patch("backend.app.services.retrieval.extract_pdf_text_from_bytes", return_value=pages),
            patch("backend.app.services.retrieval.chunk_pages", return_value=chunks),
            patch("backend.app.services.retrieval.retrieve_relevant_passages", side_effect=results),
        )

    def test_runs_all_six_categories_and_deduplicates_normalized_evidence(self):
        result = {
            "chunk_id": "stable-id",
            "document": "tender.pdf",
            "page": 1,
            "text": "Source evidence.",
            "score": 0.75,
        }
        parser_patch, chunk_patch, retrieve_patch = self._prepared_retrieval(
            [[result]] * len(REQUIREMENT_QUERIES)
        )
        with parser_patch as parse_pdf, chunk_patch as make_chunks, retrieve_patch as retrieve:
            evidence = retrieve_tender_evidence(b"pdf bytes", "tender.pdf", top_k_per_query=2)

        parse_pdf.assert_called_once_with(b"pdf bytes", "tender.pdf")
        make_chunks.assert_called_once_with(parse_pdf.return_value)
        self.assertEqual(retrieve.call_count, 6)
        self.assertEqual([call.args[0] for call in retrieve.call_args_list], [
            query for _, query in REQUIREMENT_QUERIES
        ])
        self.assertTrue(all(call.kwargs["top_k"] == 2 for call in retrieve.call_args_list))
        self.assertEqual(evidence, [{
            "chunk_id": "stable-id",
            "document": "tender.pdf",
            "page": 1,
            "text": "Source evidence.",
        }])
        self.assertEqual(set(evidence[0]), {"chunk_id", "document", "page", "text"})
        self.assertIsInstance(evidence[0]["page"], int)
        self.assertGreater(evidence[0]["page"], 0)

    def test_top_k_is_passed_to_each_query_and_no_matches_return_empty(self):
        parser_patch, chunk_patch, retrieve_patch = self._prepared_retrieval([[]] * 6)
        with parser_patch, chunk_patch, retrieve_patch as retrieve:
            evidence = retrieve_tender_evidence(b"pdf bytes", "tender.pdf", top_k_per_query=1)

        self.assertEqual(evidence, [])
        self.assertTrue(all(call.kwargs["top_k"] == 1 for call in retrieve.call_args_list))

    def test_actual_tender_evidence_is_returned_without_bm25_score(self):
        source_text = (
            "Bidders must submit an audited financial statement before the closing date."
        )
        pdf_path = self.directory / "actual-tender.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page()
            page.insert_text((72, 72), source_text)
            pdf.save(pdf_path)

        evidence = retrieve_tender_evidence(pdf_path.read_bytes(), "actual-tender.pdf")

        self.assertTrue(evidence)
        self.assertTrue(all(item["text"] == source_text for item in evidence))
        self.assertTrue(all(item["document"] == "actual-tender.pdf" for item in evidence))
        self.assertTrue(all(item["page"] == 1 for item in evidence))
        self.assertTrue(all(set(item) == {"chunk_id", "document", "page", "text"} for item in evidence))
        self.assertEqual(len({item["chunk_id"] for item in evidence}), len(evidence))

    def test_validates_top_k_and_filename(self):
        with self.assertRaises(ValueError):
            retrieve_tender_evidence(b"pdf bytes", "tender.pdf", top_k_per_query=0)
        with self.assertRaises(ValueError):
            retrieve_tender_evidence(b"pdf bytes", "tender.txt")
        with self.assertRaises(TypeError):
            retrieve_tender_evidence("not bytes", "tender.pdf")


if __name__ == "__main__":
    unittest.main()
