"""Text chunking and lightweight BM25 retrieval for extracted PDF pages.

The service accepts the page dictionaries returned by ``extract_pdf_text``.
Chunks and retrieval results use ``chunk_id``, ``document``, ``page``, and
``text`` fields; retrieval results also include a BM25 ``score``. This is an
internal service interface and does not define an HTTP/API contract.
"""

from collections import Counter
import hashlib
import math
import re


_TOKEN_PATTERN = re.compile(r"\w+", flags=re.UNICODE)


def chunk_pages(pages, chunk_size=180, overlap=30):
    """Split extracted page records into overlapping word-based passages.

    ``text`` is sliced directly from the source page, preserving its original
    whitespace and wording. Chunk IDs are deterministic for the same document,
    page, chunk position, and source text.
    """
    if isinstance(chunk_size, bool) or not isinstance(chunk_size, int) or chunk_size <= 0:
        raise ValueError("chunk_size must be a positive integer.")
    if isinstance(overlap, bool) or not isinstance(overlap, int) or overlap < 0:
        raise ValueError("overlap must be a non-negative integer.")
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size.")

    chunks = []
    for page_record in pages:
        try:
            document = page_record["document"]
            page = page_record["page"]
            text = page_record["text"]
        except (KeyError, TypeError) as error:
            raise ValueError("Each page must include document, page, and text fields.") from error

        if not isinstance(document, str) or not document:
            raise ValueError("Each page document must be a non-empty string.")
        if isinstance(page, bool) or not isinstance(page, int) or page < 1:
            raise ValueError("Each page number must be a positive integer.")
        if not isinstance(text, str):
            raise ValueError("Each page text must be a string.")

        words = list(re.finditer(r"\S+", text))
        step = chunk_size - overlap
        for start in range(0, len(words), step):
            end = min(start + chunk_size, len(words))
            excerpt = text[words[start].start():words[end - 1].end()]
            identity = f"{document}\0{page}\0{start}\0{excerpt}".encode("utf-8")
            chunk_id = hashlib.sha256(identity).hexdigest()[:16]
            chunks.append({
                "chunk_id": chunk_id,
                "document": document,
                "page": page,
                "text": excerpt,
            })
            if end == len(words):
                break

    return chunks


def retrieve_relevant_passages(query, chunks, top_k=5):
    """Rank chunks with BM25 and return up to ``top_k`` matching passages.

    Only chunks with a positive lexical BM25 score are returned. Results retain
    the chunk's original source text and metadata. A non-positive ``top_k`` or
    a blank query returns an empty list.
    """
    if not isinstance(query, str) or not query.strip():
        return []
    if isinstance(top_k, bool) or not isinstance(top_k, int):
        raise ValueError("top_k must be a non-negative integer.")
    if top_k <= 0:
        return []

    query_terms = _tokenize(query)
    if not query_terms:
        return []

    indexed_chunks = []
    document_frequency = Counter()
    total_length = 0
    for chunk in chunks:
        try:
            text = chunk["text"]
            chunk_id = chunk["chunk_id"]
            document = chunk["document"]
            page = chunk["page"]
        except (KeyError, TypeError) as error:
            raise ValueError("Each chunk must include chunk_id, document, page, and text fields.") from error
        if not isinstance(text, str):
            raise ValueError("Each chunk text must be a string.")

        tokens = _tokenize(text)
        frequencies = Counter(tokens)
        indexed_chunks.append((chunk_id, document, page, text, frequencies, len(tokens)))
        document_frequency.update(frequencies.keys())
        total_length += len(tokens)

    if not indexed_chunks:
        return []

    corpus_size = len(indexed_chunks)
    average_length = total_length / corpus_size if total_length else 0
    k1 = 1.5
    b = 0.75
    ranked = []
    for index, (chunk_id, document, page, text, frequencies, length) in enumerate(indexed_chunks):
        score = 0.0
        for term in query_terms:
            frequency = frequencies.get(term, 0)
            if not frequency:
                continue
            df = document_frequency[term]
            inverse_document_frequency = math.log1p(
                (corpus_size - df + 0.5) / (df + 0.5)
            )
            normalization = (
                frequency + k1 * (1 - b + b * length / average_length)
                if average_length
                else frequency + k1
            )
            score += inverse_document_frequency * frequency * (k1 + 1) / normalization
        if score > 0:
            ranked.append((score, index, {
                "chunk_id": chunk_id,
                "document": document,
                "page": page,
                "text": text,
                "score": score,
            }))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    return [result for _, _, result in ranked[:top_k]]


def _tokenize(text):
    return [match.group(0).casefold() for match in _TOKEN_PATTERN.finditer(text)]
