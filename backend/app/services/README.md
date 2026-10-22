# Document processing and retrieval

`document_parser.extract_pdf_text(path)` returns one record per page containing
`document` (the PDF filename), `page` (1-based), and `text` (extracted text).
It retains its filesystem-path interface. `extract_pdf_text_from_bytes(data,
filename)` provides the corresponding upload-bytes interface and preserves the
caller-provided filename. Both use PyMuPDF without OCR; empty, unreadable,
encrypted, and textless byte uploads raise `ValueError`. Scanned PDFs without
an extractable text layer are not supported.

`retrieval.chunk_pages(pages, chunk_size=180, overlap=30)` returns source
passages with `chunk_id`, `document`, `page`, and `text`. Chunk sizes and
overlap are measured in whitespace-separated words. Text is taken directly
from each extracted page. IDs are deterministic for unchanged input and chunk
settings.

`retrieval.retrieve_relevant_passages(query, chunks, top_k=5)` ranks the chunks
with BM25 and returns matching passages in descending score order. Each result
contains `chunk_id`, `document`, `page`, `text`, and `score`. Blank queries,
nonmatching queries, or empty input produce an empty list.

`retrieval.retrieve_tender_evidence(pdf_bytes, filename,
top_k_per_query=5)` is the backend-facing service entry point. It parses the
uploaded bytes, chunks extracted pages, and runs the fixed category queries
below. It returns evidence dictionaries with exactly `chunk_id`, `document`,
`page`, and `text`; BM25 scores are omitted. Empty, unreadable, encrypted, or
textless documents raise a clear processing error. A valid document with no
matching passages returns an empty list.

The six requirement query categories run in this order:

1. **Eligibility:** bidder eligibility, qualifications, legal registration,
   licenses, permits, and mandatory conditions.
2. **Required documents:** documentary requirements, forms, certificates,
   affidavits, declarations, and checklists.
3. **Financial qualifications:** minimum turnover, revenue, financial
   capacity, credit lines, and audited financial statements.
4. **Technical qualifications:** relevant experience, similar contracts,
   personnel, equipment, technical capability, and certifications.
5. **Delivery conditions:** delivery timelines, locations, schedules,
   warranties, installation, inspection, and acceptance.
6. **Submission instructions:** deadlines, closing dates, submission methods,
   required formats, copies, envelopes, and bid opening.

Within each category, matching passages follow BM25 rank order. Categories are
concatenated in the order above, and duplicate chunk IDs are retained only at
their first occurrence. The maximum result count before deduplication is six
times `top_k_per_query`; fewer results may be returned when categories have
fewer matches or share passages. Chunk IDs are deterministic and collision
duplicates within a chunk set receive a stable numeric suffix.

`TenderRetrievalService.retrieve(pdf_bytes, filename, supplier_profile)`
implements `backend.app.services.interfaces.RetrievalService`. It accepts the
backend's `SupplierProfile` for protocol compatibility; current tender-only
queries do not use supplier profile values. It returns the same four-field
evidence dictionaries expected by `RetrievedEvidence`, with no BM25 score.
Pass this adapter as `retrieval_service` to `create_app()` to wire it into the
FastAPI flow. The default app and factory remain unconfigured unless a service
is explicitly supplied, preserving the backend's fail-closed behavior.

Run the retrieval, backend, and AI assessment tests from the repository root:

```powershell
python -m pytest backend/tests backend/ai_assessment/tests -q
```
