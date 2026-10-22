# Document processing and retrieval

`document_parser.extract_pdf_text(path)` returns one record per page containing
`document` (the PDF filename), `page` (1-based), and `text` (extracted text).

`retrieval.chunk_pages(pages, chunk_size=180, overlap=30)` returns source
passages with `chunk_id`, `document`, `page`, and `text`. Chunk sizes and
overlap are measured in whitespace-separated words. Text is taken directly
from each extracted page. IDs are deterministic for unchanged input and chunk
settings.

`retrieval.retrieve_relevant_passages(query, chunks, top_k=5)` ranks the chunks
with BM25 and returns matching passages in descending score order. Each result
contains `chunk_id`, `document`, `page`, `text`, and `score`. Blank queries,
nonmatching queries, or empty input produce an empty list. This is an internal
service interface; it does not represent an agreed FastAPI contract.

Run the focused suite from `backend/` with:

```powershell
python -m unittest discover -s tests -v
```
