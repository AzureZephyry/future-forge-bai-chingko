# BidBridge — Know Before You Bid.

Team Bai-chingko · FUTURE FORGE. A procurement-preparation workspace and
commercial SaaS demonstration built with React, Vite and TypeScript.

**This is a browser-local business model prototype. No payment is processed.**
The core requires no account, Python server, AI provider or API key.

## Run locally

From the repository root in Windows PowerShell (verified with Node 24 and npm):

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Start Free or visit the pricing page to preview
Pro Weekly. The fictional opportunity is available from the application header.

| Route | Purpose |
|---|---|
| `/` | Marketing homepage and interactive fictional product preview |
| `/features` | Preparation workflow and product explanations |
| `/pricing` | Exactly two plans: Free and Pro Weekly; demo activation |
| `/app` | Dashboard with real workspace metrics |
| `/app/opportunity` | Opportunity details and requirement management |
| `/app/documents` | Local evidence library and upload allowance |
| `/app/simulator` | Isolated Gap-to-Go scenario and comparison |
| `/app/report` | Printable baseline or hypothetical decision brief |
| `/app/plan` | Demo activation, explicit restart/end, usage and expiry |
| `/legacy` | Preserved original AI assessment frontend |

## Plans and documents

Free allows **3 successfully stored files per local calendar day**, across the
whole local application. Allowance resets at local midnight, not after a rolling
24 hours. Invalid/rejected files, picker cancellation and failed storage consume
no allowance. Removing a stored file does not refund its slot. Batch selection
cannot exceed the remaining allowance. Duplicate filenames are allowed and each
accepted file counts separately.

Pro Weekly uses an **illustrative ₱99 per 7-day period** price from
`lib/subscription.ts`. Confirming demo activation starts exactly **168 hours** of
access with no daily numerical upload cap. There is no transaction or automatic
renewal. At expiry, Free limits return using that day's existing Free usage.
Pro uploads do not consume Free slots. Existing files remain available. An
explicit demo restart starts a new 168-hour period from now, without adding
unused time.

PDF, DOCX, TXT, PNG and JPG/JPEG files are supported, up to **10 MB per file** on
both plans. Metadata, file blobs and accepted Free usage commit atomically in
IndexedDB. Failed writes roll back together. Files can be associated with
baseline requirements, previewed (PDF/image/text), downloaded and removed. DOCX
is downloadable without a document renderer. Uploading never changes readiness
status automatically or performs AI analysis.

The UI refreshes at local midnight/Pro expiry, on focus, visibility and relevant
cross-tab messages. Every acceptance rechecks the current plan/date inside its
transaction. Concurrent tabs serialize quota changes. Browser suspension can
delay timers; resuming re-evaluates actual time. Clearing browser data or changing
device time can bypass this prototype. It is not production entitlement security.

## Preparation, persistence and appearance

The existing `assessWorkspace(workspace, today)` engine remains deterministic.
Mandatory blockers take priority over completion percentage. All preparation
tools remain available on both plans. A file attachment does not prove a match.

Validated opportunity data remains in localStorage; files, daily usage and demo
entitlements use IndexedDB. Scenarios are in memory and survive app navigation,
but a full refresh restores the baseline. Apply requires confirmation. Theme is
a separate local preference; the initial default follows the operating system.

Local data belongs to one browser profile and origin. There is no cloud backup,
cross-device sync, authentication, real billing or automatic bid submission.
The app works locally after its resources load, but is not an installable PWA.

## Verification and production preview

```powershell
npm run typecheck
npm run build
$env:PLAYWRIGHT_CHANNEL='msedge'
npm test
```

If Edge is unavailable, use `npx playwright install chromium` and omit the channel
variable. `npm test` runs domain tests and the primary browser suites. Tests
start Vite automatically on 4173 and require no Python.

```powershell
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
```

Preview: **http://127.0.0.1:4174**. Deploy `dist/` with an SPA history fallback to
`index.html` for direct nested URLs. Root hosting is the tested configuration.

Preserved legacy checks require the Python environment from
[backend/README.md](backend/README.md):

```powershell
npm run test:legacy
.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider backend/tests backend/ai_assessment/tests -q
```

Run primary and legacy browser suites separately; both use port 4173. The legacy
backend, schemas, AI module and retrieval branch are preserved. They are not
dependencies of the commercial workspace.
