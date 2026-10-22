import tempfile
import unittest
from pathlib import Path

import fitz

from app.services.document_parser import extract_pdf_text
from app.services.retrieval import chunk_pages, retrieve_relevant_passages


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


if __name__ == "__main__":
    unittest.main()
