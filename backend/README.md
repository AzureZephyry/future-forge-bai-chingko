# BidBridge backend integration

> Preserved legacy backend. The current Gap-to-Go workspace runs locally without
> FastAPI, retrieval, or model services. These routes and tests remain available
> for historical compatibility; they are not release prerequisites for the core
> product. Do not implement obsolete AI work to unblock the new workspace.

Integration branch: `integration/bidbridge`. Christan's recovered backend source
is `e3214c10fbd5c6762eac2b3a1accfa45fe1aee10`; the preserved AI baseline is
`d44e3e72f03e59b927a674abe76701d75abdbbb9`. The integration branch did not exist
when backend integration began. Christan's files merged without conflicts. The
AI implementation and retrieval implementation were preserved. The subsequent
frontend integration is documented in [FRONTEND.md](../FRONTEND.md).

## Install and run from the repository root

Use a local virtual environment. The integration was tested on Windows with
CPython 3.15.1. The lock includes both runtime and test dependencies; direct
dependency ranges remain in `requirements.txt` and `requirements-dev.txt`.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

`GET /api/health` returns `{"status":"ok"}` for process health only. OpenAPI is
at `/openapi.json`, and interactive API documentation is at `/docs`. The default
app has no retrieval service and uses the unconfigured `AlmaProvider`; analysis
deliberately returns 503 until dependencies are supplied. Health success does
not assert RAG or model readiness.

For dependency updates, install `backend/requirements-dev.txt` in a clean venv,
run the tests, and regenerate `requirements-lock.txt` from `pip freeze`. The
base Uvicorn package is sufficient; optional standard extras were removed.
Virtual environments, bytecode, test caches, and `.env` files are ignored.

## Request and response contract

`POST /api/analyze` accepts `multipart/form-data` with:

- `tender_file`: a text-based PDF, up to 15 MiB. Empty, malformed, encrypted,
  page-less, and textless/scanned PDFs are rejected. There is no OCR.
- `supplier_profile`: a JSON string containing exactly these five required,
  nonblank **string** fields: `business_name`, `industry`, `business_permit`,
  `registration`, `delivery_capacity`. Values are self-reported. Use explicit
  statements such as "not available" or "unknown" for missing information;
  booleans, null values, and extra profile fields are rejected. Maximum lengths
  are 200, 200, 2000, 2000, and 4000 characters respectively.

The backend calls the existing service, without changing its contract:

```python
result = await assessment_service.assess(
    supplier_profile=profile.model_dump(mode="json"),
    evidence_chunks=[item.model_dump(mode="json") for item in evidence],
)
payload = result.to_dict()
```

Public response mappings preserve Christan's initial fields:

| AI result | Public API |
| --- | --- |
| `requirements[].requirement_description` | `requirements[].requirement` |
| `requirements[].status` | `requirements[].status` |
| `requirements[].reasoning` | `requirements[].reason` |
| `requirements[].recommended_next_action` | `requirements[].next_action` |
| `requirements[].evidence_chunk_ids` | `requirements[].sources` (all canonical citations) |
| `uncertainty` | `uncertainty` |

Each requirement also has a generated display `id` and the existing `source`
field, equal to the first entry in `sources`. Each source contains `document`,
`page`, `chunk_id`, and `excerpt`, resolved exclusively from retrieved evidence.
Null pages remain null; no metadata is supplied by the model. All five AI status
values are retained. `tender.title` and `tender.deadline` remain null, and
`overall` is `needs_review`; the AI result does not establish these facts or an
official eligibility decision. Ali should display uncertainty and the complete
source list while retaining compatibility with the original response fields.

## Dependency injection and explicit testing

`create_app(retrieval_service=..., assessment_service=..., cors_origins=...)`
accepts injected dependencies. No environment variable or request field enables
mock inference, and there is no mock fallback. Production selection never
automatically imports the fictional demo fixture.

The synchronous retrieval interface is:

```python
retrieve(pdf_bytes: bytes, filename: str, supplier_profile: SupplierProfile)
```

It returns mappings or validated `RetrievedEvidence` objects containing exactly
`chunk_id`, `document`, `page`, and `text`. IDs are unique nonblank strings;
document/text are nonblank strings. Page must be present and be a positive
one-based integer or `None`. No coercion of strings, floats, or booleans to page
numbers occurs. Extra fields (including BM25 scores) must be removed by the
retrieval adapter. Canonical source text and IDs are preserved without trimming.
PDF validation and synchronous retrieval run in a worker thread, while the
assessment call is awaited.

`backend/tests/test_integration.py` provides a **test-only** fixture retrieval
component and explicitly injects `AssessmentService(MockProvider(...))`. It
generates a genuine text PDF, exercises multipart upload validation, calls the
unchanged AI service, and checks the three demo statuses/actions and citation
metadata. The five-field API profile carries the fixture supplier's statements
as descriptive strings. These tests verify integration plumbing, not retrieval
quality or actual model reasoning. The stock/specification/delivery fixture is
never selected by the default application.

```powershell
.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider backend/tests backend/ai_assessment/tests -q
.\.venv\Scripts\python.exe -B -m unittest discover -s backend/ai_assessment/tests -v
.\.venv\Scripts\python.exe -m pip check
```

The suite includes a subprocess startup smoke test using the documented Uvicorn
import path and localhost HTTP, plus a successful fixture-backed endpoint test.
HTTPX's integration with the installed Starlette TestClient emits a deprecation
warning; it currently passes and requires no additional dependency for this demo.

## Controlled errors

Errors use `{"detail": "controlled message"}`, never provider exception text.

| Condition | HTTP |
| --- | --- |
| Invalid profile, empty/invalid/encrypted/textless PDF, or no retrieved evidence | 422 |
| Upload above 15 MiB | 413 |
| Non-PDF bytes | 415 |
| Missing services or `InferenceUnavailableError` | 503 |
| `InferenceError`, invalid model output, unknown model citations, or incompatible assessment result | 502 |
| Retrieval failure, invalid/duplicate evidence metadata, post-validation `InputValidationError`, or unexpected internal failure | 500 |

`InferenceUnavailableError` is handled before its parent `InferenceError`.
Backend `InputValidationError` is internal because public input and canonical
evidence have already been validated. All four classes are imported from
`backend.ai_assessment`. Christan retains responsibility for further HTTP policy.

## CORS

The factory permits `http://localhost:5173` and `http://127.0.0.1:5173` for local
Vite development, without credentials or wildcard origins. Pass an explicit
origin list for other deployments, or `cors_origins=[]` to disable CORS.
This follows the [FastAPI CORS configuration](https://fastapi.tiangolo.com/tutorial/cors/).
Evidence schemas use [Pydantic strict validation](https://docs.pydantic.dev/latest/concepts/strict_mode/).

## Outstanding integration and team handoff

- **ALMA:** credentials, endpoints, model identifiers, payload/response formats,
  limits, timeouts, errors, and retry guidance remain undocumented. The adapter
  is intentionally unavailable. No Gemma inference has been tested.
- **Lawrence:** the latest inspected `origin/feat/retrieval` is
  `63ed83266a026e258ffa019d13d5b7ffee7e06f3`. It now includes the
  `TenderRetrievalService` adapter and corrected relative imports after merging
  this backend baseline. Retrieval remains intentionally unmerged here. Review
  its tests, PyMuPDF dependency, and dependency lock when integrating it next;
  use the published adapter instead of recreating it. Parser duplication can
  be revisited during that separate integration.
- **Ali:** the root-level React/Vite frontend now sends the multipart request
  above and renders uncertainty and every source. See [FRONTEND.md](../FRONTEND.md)
  for browser tests and synchronization. Production retrieval and ALMA remain
  unconfigured; the browser fixture server is separate and explicitly guarded.

Christan's implementation was present: no replacement backend was invented.
Repairs touched `app/main.py`, `app/routes/analysis.py`, `app/schemas/assessment.py`,
and `app/services/interfaces.py`; integration tests, development/locked
dependencies, this guide, and repository ignores were added. His original
`backend/tests/test_api.py` remains unchanged. The assessment Protocol is named
`AssessmentServiceProtocol`, uses the correct `evidence_chunks` argument, and
returns the existing AI `AssessmentResult`.

Before synchronizing, preserve any uncommitted work. Christan can inspect the
shared branch without altering his feature branch:

```powershell
git fetch origin --prune
git log --oneline feat/backend..origin/integration/bidbridge
git diff feat/backend...origin/integration/bidbridge -- backend
```

When his working tree is clean, if his branch has not diverged from the original
backend commit, use `git switch feat/backend` followed by
`git merge --ff-only origin/integration/bidbridge`. If it has new commits, merge
`origin/integration/bidbridge` normally and reconcile the four repaired files;
do not reset, rebase shared history, or force-push. Continue backend orchestration,
API/schema maintenance, error policy, and future retrieval/frontend coordination
from this integrated baseline. No teammate messages were sent.
