# BidBridge AI assessment — Phase 1

An isolated Python 3.10+ module using only the standard library. It has no routes,
FastAPI schemas, retrieval implementation, network requests, or frontend changes.
These are AI-local contracts; Christan retains ownership of shared API schemas
and orchestration. ALMA integration is pending official organizer documentation.

## Call interface for Christan

From the repository root (or with the repository root on the Python import path):

```python
from backend.ai_assessment import AssessmentService, MockProvider

service = AssessmentService(provider=MockProvider())  # explicitly development only
result = await service.assess(
    supplier_profile={
        "name": "Example Supplier",
        "qualifications": ["Reports holding a business permit"],
    },
    evidence_chunks=[
        {
            "chunk_id": "tender-1",
            "document": "tender.pdf",
            "page": 2,
            "text": "The supplier must submit a current business permit.",
        }
    ],
)
payload = result.to_dict()
```

The default mock returns no findings with an explicit mock uncertainty message.
It does not parse tender text or simulate actual assessment reasoning. Pass a
reviewed raw JSON response to `MockProvider(response=...)` for deterministic UI
or orchestration fixtures. Fixtures use the same validation path as real output.
The tests contain a complete response example.

Supply `AlmaProvider()` to represent real inference: it always raises
`InferenceUnavailableError` until implemented from official specifications.
There is no provider default, implicit environment selection, or mock fallback.

## Local contract and assumptions requiring Christan's agreement

- `assess` is async. A provider implements `async generate(prompt: str) -> str`.
  The string is provider-neutral prompting, not an ALMA HTTP payload. The future
  adapter converts the documented model response into raw JSON text.
- The profile is a JSON object with string keys and finite JSON values; its field
  names are currently unconstrained because no shared supplier schema exists.
  Profile claims are self-reported, not documentary verification. Christan must
  agree how his profile schema maps into this object.
- Evidence is a sequence of objects containing exactly `chunk_id`, `document`,
  `page`, and `text`. IDs must be unique; IDs, document names, and text must be
  nonempty strings. Page is a positive **one-based** integer, or `None` when
  unavailable. The adapter must normalize retrieval metadata to this contract.
- Retrieved chunks may include tender and supplier documents. Their purpose and
  supplier identity must be clear in the supplied text; the model must use
  `unknown` if unclear. With tender-only retrieval, supplier claims alone cannot
  establish `documented_match`. Agree on any future explicit source-role metadata
  with Christan and Lawrence before extending this local contract.
- Result: `AssessmentResult(requirements, uncertainty)`; `to_dict()` returns a
  JSON-ready object. Each requirement contains exactly `requirement_description`,
  `status`, `reasoning`, `recommended_next_action`, and `evidence_chunk_ids`.
- Status is exactly one of `documented_match`, `self_reported_match`, `missing`,
  `unknown`, or `conflict`. Each requirement must cite at least one supplied chunk
  supporting its tender requirement. IDs within a requirement cannot repeat.
  An empty assessment must contain a nonempty uncertainty explanation.
- Document names and page numbers are never generated in the result. Christan
  should resolve citations against the original chunk metadata by ID, preserving
  null pages. This module does not invent, recover, or enrich citation metadata.
- Errors raise, rather than returning assessments: `InputValidationError` for
  caller input, `AssessmentValidationError` for invalid model JSON/contracts or
  unknown citations, `InferenceUnavailableError` for unavailable real inference,
  and `InferenceError` for other provider failures. All inherit `AssessmentError`;
  unavailable inference is also an `InferenceError`. Christan owns mapping these
  to HTTP responses. Errors must not be presented as successful empty assessments.

Validation checks structure and citation membership. It cannot establish that a
cited passage entails a claim, detect every invented statement, or guarantee
resistance to prompt injection. Grounding and uncertainty rules are prepared in
the prompt; semantic quality still requires real-model evaluation and review.
No real inference or eligibility determination is performed in Phase 1.

## Tests

Run from the repository root, without installing dependencies:

```powershell
python -B -m unittest discover -s backend/ai_assessment/tests -v
```

## Pending ALMA details

Obtain official base URL and inference endpoint, authentication and credential
delivery, available Gemma model identifiers, request schema and prompt/chat
format, response schema and text extraction, structured-output capabilities,
context/output limits, timeout behavior, rate limits, error codes and retry
guidance, and streaming versus non-streaming support. Confirm supplier-document
data handling requirements. Then implement the adapter and evaluate grounded
behavior using the actual model. No OpenAI compatibility is assumed.
