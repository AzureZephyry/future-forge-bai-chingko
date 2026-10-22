# BidBridge frontend and full-stack integration

> Historical AI-flow integration guide. The current primary product is the
> deterministic workspace described in [README.md](README.md). This earlier
> flow is now isolated at `/legacy`; run its preserved browser suite with
> `npm run test:legacy`. It is not a dependency of the new workspace.

The React + Vite + TypeScript frontend lives at the **repository root**, alongside
`backend/`. Preserve that layout when synchronizing Ali's branch. Frontend source
was merged from `d2ce262842960f643d5ea3a1c5b712c4754e448e` onto integration
baseline `5512899212b0da69a0f7ccb8738ef82c9cd9135f`. The only merge conflict was
the add/add `.gitignore`; both sets of exclusions were retained.

## Run the application

Use Node 24 and npm with the committed `package-lock.json`. This integration was
tested with Node 24.18.0 and npm 12.2.0. Python setup and backend dependencies are
in [backend/README.md](backend/README.md).

From the repository root, in separate terminals:

```powershell
.\.venv\Scripts\python.exe -B -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. `/api/health` reports process health only. The normal
application deliberately returns 503 for analysis until retrieval and ALMA are
configured. A successful build or fixture demonstration does not establish live
RAG readiness. No frontend code generates fallback assessment results.

Optional local configuration: copy `.env.example` to `.env.local`, edit the
public connection settings, then restart Vite:

- `VITE_API_BASE_URL`: blank by default, using same-origin `/api/analyze`. Set a
  backend origin such as `http://127.0.0.1:8000` for direct API requests; avoid
  duplicating `/api` in this value. Configure matching backend CORS origins.
- `VITE_BACKEND_PROXY_TARGET`: Vite development proxy destination, defaulting to
  `http://127.0.0.1:8000`. Its matcher is `^/api/`; a plain `/api` prefix also
  matches the frontend's `/api.ts` module and breaks page startup.
- `VITE_DEMO_MODE=true`: **development UI label only**, showing "Fixture demo ·
  No live AI". It never chooses a provider or changes a request. Normal use is
  false. The flag is disabled in production builds.

These are public build-time settings; never put ALMA credentials in `VITE_*`
variables. See [Vite environment documentation](https://vite.dev/guide/env-and-mode).
Production hosting must route `/api/` to FastAPI, or build with an explicit
`VITE_API_BASE_URL`; Vite's development proxy is not production hosting.

## Implemented HTTP contract

The frontend sends `FormData` with exactly `tender_file` (the selected PDF) and
`supplier_profile` (`JSON.stringify` of the normalized five-field object).
The browser supplies the multipart boundary; no Content-Type header is set by
the client. Profile keys are `business_name`, `industry`, `business_permit`,
`registration`, and `delivery_capacity`, all nonblank strings. Inputs follow
the backend limits of 200, 200, 2000, 2000, and 4000 characters respectively.
The permit and registration selectors are self-reported strings, not proof.

The public response uses `tender`, `requirements`, `overall`, and `uncertainty`.
Each requirement uses `requirement`, `status`, `reason`, `next_action`, `source`,
and `sources`. These names intentionally differ from the internal AI dataclasses.
Tender title/deadline and citation pages can be null. All citations are rendered
from `sources`, with `source` as a first-citation fallback. Null pages display as
"Page unavailable", without inventing a number. Excerpts render as plain text.

All five status values are supported; `self_reported_match` explicitly says
"not verified", and `missing` and `unknown` use distinct labels and colors.
Top-level uncertainty and the advisory-only notice remain visible. No response
is interpreted as official procurement eligibility or guaranteed bid success.

The client checks the response shape before rendering. HTTP 422, 503, 502, and
500 have readable messages; 413/415 and network failures are also handled.
Internal error objects are not printed. Errors retain the user's inputs and do
not create assessment findings. After a failed reassessment, any retained result
is explicitly labelled as the last successful assessment, not a new result.

Selected PDF/profile data remains in memory during the current page session.
The form validates required fields, extension, nonempty files, and the 15 MiB
limit; FastAPI remains responsible for inspecting actual PDF contents. Files can
be removed/replaced, including selecting the same file again. Inputs and repeat
submission are locked while analyzing. Edits mark previous findings as stale;
reassessment does not mark supplier claims as documentary verification. Status
comparison uses requirement text on the same uploaded File, not unstable ordinal
IDs. Reloading the page clears the active session; nothing is stored locally.

## Repeatable browser and full-stack tests

Install the Python backend/test lock and npm dependencies first. Then install
only the Chromium browser needed by Playwright, if not already available:

```powershell
npx playwright install chromium
npm run typecheck
npm run build
npm test
.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider backend/tests backend/ai_assessment/tests -q
```

On a Windows machine with Microsoft Edge already installed, the same browser
tests can use it without downloading a browser:

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
npm test
```

Playwright starts three isolated processes and stops them after testing:

1. Explicit fixture FastAPI server on 8766, requiring `BIDBRIDGE_TEST_MODE=1`.
2. Unmodified default FastAPI app on 8767, exercising its honest 503 response.
3. Vite on 4173, proxying to the fixture server with the development demo label.

Ports must be free; existing servers are never silently reused. The test fixture
is in `tests/fixture_backend.py`. It injects the existing `AssessmentService` and
`MockProvider` using `backend/ai_assessment/demo_fixture.json`. It returns fixed,
fictional evidence rather than retrieving from an arbitrary uploaded document.
The normal backend factory never imports or selects it. The environment guard
also has a Python regression test.

The browser suite generates a real text PDF, uploads it through the UI and Vite
proxy, and checks the actual API result, all three demo statuses, next actions,
canonical citations, uncertainty, and reassessment. Render-only variants and
HTTP/network failure cases use explicitly intercepted test responses. Multipart
contents are observed from the real browser's FormData; browsers can omit binary
multipart bodies from the automation protocol's postData field.

The suite also checks every status, multiple sources, null pages/sources/title,
empty results, loading/duplicate prevention, file validation/removal, and a
390px mobile layout without horizontal overflow. Screenshots and failure traces
are ignored under `test-results/`; no generated PDF or build artifacts are
committed. The project has no ESLint configuration/script; lint is not claimed
as a passing check. TypeScript strict/unused checks and the production build run.

For a manual **fictional** fixture demonstration, start the test factory instead
of the default backend, and set the frontend development demo label:

```powershell
$env:BIDBRIDGE_TEST_MODE='1'
.\.venv\Scripts\python.exe -B -m uvicorn tests.fixture_backend:create_fixture_app --factory --host 127.0.0.1 --port 8000
```

This is not real retrieval or Gemma inference, and its findings do not change
based on uploaded content. Use it only to demonstrate integration plumbing.

## Ali handoff and changed files

Ali supplied the upload/profile UI, status and advisory banners, responsive warm
palette, React components, Vite setup, and a lockfile. These were retained.
His multipart field names, JSON profile encoding, and browser-managed content
type were already correct. Repairs relative to his source are:

| File | Purpose |
| --- | --- |
| `App.tsx` | Required-input flow, file removal, no invented prefilled business, pending lock, stale/reassessment state, Gap-to-Go summary and uncertainty |
| `api.ts` | Configurable origin, exact profile payload, human errors, response guard, no client-generated mock fallback |
| `types.ts` | Actual public response, nullable fields, full citations and uncertainty |
| `validation.ts` | Shared profile/file limits matching FastAPI |
| `components/ProfileForm.tsx` | Required/length-limited accessible controls and multiline capacity |
| `components/RequirementCard.tsx` | All canonical citations, null handling, collapsible evidence, explicit status changes |
| `components/StatusBadge.tsx` | Shared labels for cards and status summary |
| `index.css` | Responsive summary, evidence/notice styles, readable card text, stable form placement; no remote font dependency |
| `vite.config.ts` | API-only proxy matcher, explicit loopback target, configurable proxy, predictable port |
| `.env.example` | Public connection settings and label-only demo flag |
| `.gitignore` | Preserved Python/Node exclusions and browser test artifacts |
| `package.json`, `package-lock.json` | Typecheck/test scripts, pinned Playwright and Node type test dependencies |
| `playwright.config.ts`, `tests/frontend.spec.ts` | Actual browser/full-stack tests and controlled render/error cases |
| `tests/__init__.py`, `tests/fixture_backend.py` | Isolated, guarded backend fixture factory and generated text PDF |
| `backend/tests/test_browser_fixture.py` | Guard against unconfigured fixture startup |
| `README.md`, `backend/README.md`, `FRONTEND.md` | Current setup, API decisions, and synchronization documentation |

The separate client-generated `mockData.ts` and mock-enabled
`env.local.example` were removed. Their mock logic ignored the uploaded PDF and
could treat unknown permit status as missing. The existing backend fixture is
now the single deterministic assessment demonstration. `OverallBanner.tsx`,
`index.html`, `main.tsx`, `tsconfig.json`, and `vite-env.d.ts` were merged without
changes to Ali's content. The existing backend/AI production code is unchanged.

With a clean working tree, Ali can synchronize safely:

```powershell
git fetch origin --prune
git switch feat/frontend
git merge --ff-only origin/integration/bidbridge
```

If his branch has additional commits, inspect the diff and perform a normal
merge instead. Reconcile `App.tsx`, `api.ts`, `types.ts`, component updates,
Vite configuration, `.gitignore`, and package/lockfile changes. Do not reset,
rebase shared history, or force-push. Only the shared integration branch is
pushed by this integration. No teammate messages are sent automatically.

## Remaining work

- Integrate Lawrence's latest `63ed832` retrieval branch. It now includes the
  `TenderRetrievalService` adapter and corrected relative imports after merging
  the backend baseline. Verify its tests/dependency lock when integrating; do
  not recreate the adapter or rebuild retrieval. It was inspected, not merged
  or tested as part of this frontend change.
- Build an evidence-review regression corpus using representative synthetic
  tenders, including contradictory and insufficient supplier information.
- Improve field-level correction guidance and keyboard/screen-reader testing
  based on actual supplier use; keep self-reported claims distinct from evidence.

Real retrieval is not merged into this baseline. ALMA credentials and request/
response specifications remain pending. No real model endpoint, credentials,
or API compatibility is assumed, and no live Gemma evaluation has been run.
