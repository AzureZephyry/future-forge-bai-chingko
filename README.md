# BidBridge

**Know Before You Bid.**

A procurement readiness and decision-support platform helping small businesses,
suppliers, and contractors organize procurement requirements, identify
preparation risks, and explore corrective actions before bidding.

Built by **Team Bai-chingko** for **FUTURE FORGE — The ALMA Hackathon**.
The official submission branch is **`main`**.

## Project overview

BidBridge gives smaller suppliers and procurement assistants a practical place
to prepare for an opportunity: record requirements, organize supporting files,
check deadline risks, and decide what needs attention next. Its assessments
explain the recorded preparation position; they do not certify eligibility or
predict whether a bid will win.

The commercial application runs locally in the browser. No account, Python
server, AI provider, or API key is required.

## The problem

Procurement preparation can mean scattered requirements, missing documents,
unconfirmed qualifications, and a deadline that leaves little room for recovery.
A nearly complete checklist can still conceal a mandatory gap or an unrealistic
preparation estimate. Suppliers need to see those conditions before investing
more effort in a bid.

## Our solution

1. Create an opportunity or load the clearly fictional demonstration.
2. Enter the tender's requirements and identify mandatory items.
3. Record each item's preparation status and estimated preparation days.
4. Attach supporting documents and associate them with requirements.
5. Review mandatory blockers, deadline risks, and prioritized next actions.
6. Explore hypothetical corrective actions in an independent scenario.
7. Review and print a decision brief for an internal preparation discussion.

## Core features

- **Opportunity management:** edit the title, organization, submission date,
  description, and up to 100 requirements in one browser-local workspace.
- **Five preparation statuses:** Ready, Claimed, Missing, Unknown, and Conflict;
  mandatory and optional requirements remain distinct.
- **Transparent readiness:** a deterministic engine derives counts, progress,
  blockers, advisory outcomes, and prioritized Gap-to-Go actions from inputs.
- **Deadline awareness:** compare individual user-estimated preparation times
  with remaining local calendar days, including unknown estimates and no buffer.
- **Scenario comparisons:** see baseline and hypothetical outcomes, changes in
  unresolved items, and risks removed or introduced under the entered assumptions.
- **Local persistence:** valid workspace changes save automatically; invalid
  drafts cannot overwrite the last valid save.
- **Evidence library:** store actual file blobs in IndexedDB; associate,
  preview supported formats, download, and remove files.
- **Multipage interface:** separate dashboard, requirements, documents,
  simulator, report, pricing, and plan-management views.
- **Light and dark themes:** a persistent preference, initially following the
  operating system, with responsive layouts.
- **Printable reporting:** a decision brief with blockers, requirements, actions,
  and explicit baseline or hypothetical context.

Ready means the user reports preparation complete and supporting evidence
available. Claimed means supporting documentation remains unconfirmed; it does
not count as Ready. **Attaching a file never automatically marks a requirement
Ready or proves procurement compliance.**

An empty or invalid checklist needs setup. Mandatory conflicts, a passed
submission date, and unresolved mandatory estimates exceeding the remaining
window take precedence over completion percentage. Optional gaps remain visible
without becoming mandatory blockers. Ready for Review is an internal preparation
advisory, not official approval.

## Gap-to-Go — our signature feature

Gap-to-Go connects preparation tracking with interactive what-if decision
support. The fictional example starts five calendar days before submission,
with a missing mandatory specification estimated to take seven days. BidBridge
shows a critical estimated deadline overrun.

In a scenario, changing the estimate from **seven days to three** removes that
overrun under the new assumption. The requirement remains **Missing**. Marking
it Ready still leaves other unresolved mandatory items to address. This makes
the consequence of each change visible without treating a shorter estimate as
completed work.

Scenarios use a separate in-memory copy. They survive navigation between app
pages and never silently overwrite the saved baseline. Users explicitly confirm
**Apply** or **Discard**; refreshing restores the baseline. Documents and plan
allowances remain real local actions, outside the procurement simulation.

## Business model

Exactly two plans demonstrate the proposed freemium model:

| | Free | Pro Weekly |
|---|---|---|
| Price | **₱0** | **Illustrative ₱99 / 7 days** |
| Upload allowance | 3 accepted files per local calendar day | No daily numerical upload-count cap while active |
| Access period | Daily allowance resets at local midnight | 168 consecutive hours from demo activation |
| Readiness and Gap-to-Go | Included | Included |
| Scenario simulation and decision brief | Included | Included |

**Subscriptions are demonstrated locally in the frontend. No money is collected,
and no real payment processing is implemented.** Pricing is illustrative and
subject to customer validation. The configuration is in
[`lib/subscription.ts`](lib/subscription.ts).

Only successfully stored Free uploads consume allowance. Cancelled selection,
unsupported or oversized files, quota rejection, and failed storage do not.
Batch selection cannot exceed the remaining allowance. Duplicate filenames are
allowed and count separately; deleting an accepted file does not refund a slot.
Allowance applies across the local application, including when the opportunity
is replaced.

Pro activation is explicit. At the exact expiration timestamp, Free limits
return using any Free uploads already consumed that day. Pro uploads do not
consume Free slots, and previously accepted files remain available after expiry.
There is no automatic renewal. An explicit demo restart begins a new 168-hour
period from now rather than adding unused time.

Both plans support **PDF, DOCX, TXT, PNG, and JPG/JPEG**, with a **10 MB per-file
limit** and finite browser storage. Pro does not provide unlimited storage.
PDF/image/text previews are local; DOCX is downloadable without inline rendering.
File validation checks format, MIME, size, and basic headers, not document
correctness or malware. Uploading does not extract requirements or run AI analysis.

## Revenue and sustainability

Free access is intended to encourage adoption and serve smaller workloads.
Higher-volume document use creates a possible reason to choose weekly Pro
access. Future subscription revenue could support hosting, secure storage,
maintenance, security, and customer support.

This is a business hypothesis. Customer willingness to pay, conversion,
retention, storage costs, payment fees, and support costs require validation;
the prototype does not demonstrate collected revenue or proven profitability.

## Technology stack

| Area | Implementation |
|---|---|
| Interface | React 19, TypeScript, Vite |
| Navigation | React Router 8.5, declarative browser routing |
| Business logic | Pure TypeScript readiness, calendar, and entitlement functions |
| Workspace and theme | Browser localStorage |
| Documents, quota, demo subscription | IndexedDB |
| Unit and browser tests | Playwright Test; unit tests need no browser/server |
| Styling | CSS custom properties, shared warm light/dark palettes |

The original FastAPI backend, Python AI assessment package, and frontend at
`/legacy` are preserved historical work. They are not dependencies of the
commercial application. Motion animation enhancements were deferred.

## Architecture

```text
App.tsx                       Route definitions and marketing/application layouts
routes/                       Marketing, workspace, documents, simulator, report views
components/                   Forms, readiness, scenarios, brief, and plan controls
state/                        Shared workspace, commerce, and theme state
lib/readiness.ts              Pure deterministic assessment and action priorities
lib/workspace.ts              Domain types, validation, and calendar helpers
lib/storage.ts                Validated localStorage workspace persistence
lib/subscription.ts           Pricing, quota, activation, and exact expiry calculations
lib/documents.ts              IndexedDB files, metadata, and atomic acceptance accounting
lib/demo.ts                   Fictional opportunity with a rolling five-day deadline
commercial.css                Commercial layouts and light/dark design tokens
tests/unit/                   Readiness, persistence, subscription, and validation tests
tests/commercial.spec.ts      Commercial flows, time boundaries, storage, and routes
tests/workspace.spec.ts       Procurement and scenario regression coverage
legacy/                       Preserved original AI frontend
backend/                      Preserved FastAPI and Python assessment packages
```

The interface derives assessments through `assessWorkspace(workspace, today)`;
it does not store a second readiness score. Workspace and scenario state live
above routes so navigation preserves ongoing work. Accepted file metadata,
blob storage, and Free usage commit together in one IndexedDB transaction;
failed writes roll back together, and concurrent tabs serialize quota updates.

Date-keyed Free usage follows local midnight rather than a rolling 24 hours.
The UI refreshes at midnight/expiry, on focus/visibility changes, and on relevant
cross-tab events. Every file acceptance checks the actual current date and plan.
Suspended browser tabs may delay callbacks; resuming recalculates current access.

## Getting started

Use **Node.js 24** and npm with the committed lockfile. Development was verified
with Node **24.18.0** and npm **12.2.0**; the installed routing dependency requires
Node **22.22.0 or newer**. Use a modern browser with IndexedDB enabled.

From Windows PowerShell, clone the official default `main` branch:

```powershell
git clone https://github.com/AzureZephyry/future-forge-bai-chingko.git
cd future-forge-bai-chingko
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**, or the URL Vite reports. The configured development
server binds to `127.0.0.1` on port 5173 and reports an error if that port is busy.
Select **Start Free** to open the workspace, or compare plans at `/pricing`.

### Routes

| Route | Purpose |
|---|---|
| `/` | Marketing homepage and interactive fictional product preview |
| `/features` | Product capabilities and preparation workflow |
| `/pricing` | Free/Pro comparison and demo activation |
| `/app` | Dashboard with actual workspace metrics |
| `/app/opportunity` | Opportunity and requirement management |
| `/app/documents` | Supporting files and upload allowance |
| `/app/simulator` | Gap-to-Go what-if comparison, apply, and discard |
| `/app/report` | Printable baseline or scenario decision brief |
| `/app/plan` | Demo plan status, usage, expiration, restart, and end |
| `/legacy` | Preserved original AI assessment frontend |

### Production build and preview

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
```

Open **http://127.0.0.1:4174**. The build command includes TypeScript checking.
Deploy `dist/` to a static host with an SPA history fallback to `index.html`
for direct nested URLs. Root hosting is the tested configuration. The legacy
flow additionally needs its separate backend; the commercial routes do not.

## Testing

From the repository root:

```powershell
npm run typecheck
npm run build
npm run test:unit
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:browser
```

Use installed Microsoft Edge on Windows as shown. Alternatively, install the
matching Chromium browser with `npx playwright install chromium` and omit the
channel variable. `npm test` runs the unit and primary browser suites together.
Browser tests start Vite on port 4173; unit tests need no browser or Python.

The commercial checkpoint `0f2737a` passed **104 unit tests**, **64 primary browser
tests**, **19 legacy browser tests**, **72 backend/AI tests** plus 58 subtests,
TypeScript checking, a production build, and a built-bundle smoke test. These
are recorded results for that checkpoint, not a guarantee for every environment.
See [RELEASE.md](RELEASE.md) for release context and verification notes.

Legacy checks require the Python development environment described in
[backend/README.md](backend/README.md):

```powershell
npm run test:legacy
.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider backend/tests backend/ai_assessment/tests -q
```

Run primary and legacy browser suites separately because both use port 4173.
The legacy fixtures are explicit test configurations, not live AI integration.

## Demo guide

1. Open Pricing to explain Free's daily allowance and the simulated Pro period.
2. Open the application and select **Load fictional demo**. It starts with six
   requirements and a deadline five local calendar days ahead.
3. In Documents, accept three small supporting files; attempt a fourth to show
   the Free limit. Preview Pro, confirm activation, and accept another file.
4. In Gap-to-Go, start a scenario and change the missing specification's estimate
   from seven days to three. The deadline overrun clears; Missing remains.
5. Record the remaining mandatory items as Ready in the scenario to show
   **Ready for Review**, while the optional gap remains visible.
6. Open the decision brief, explain its hypothetical label, and print if useful.
   Discard the scenario to restore the original baseline.

See [DEMO.md](DEMO.md) for sample-file preparation and the presentation script.
Loading the fictional opportunity does not reset upload usage or delete files.
Use a fresh browser profile for a fresh allowance demonstration; preserve real
user data. The sample requirements and estimates are not official tender rules.

## Limitations

- No real payments, production billing, authentication, or automatic renewal.
- No cloud document storage, cross-device sync, or account-based recovery.
- Data belongs to one browser profile and origin; clearing site data removes it.
- Frontend quotas and subscriptions can be bypassed by changing local data or
  device time. They are not production-grade entitlement enforcement.
- Preparation statuses, reference pages, and estimates are user supplied and
  are not independently verified. File presence does not establish compliance.
- Calendar-day estimates do not model exact closing times, working-day calendars,
  dependencies, or a guaranteed overall completion date.
- No automatic official eligibility verification or guaranteed bidding outcome.
- No live tender discovery, automatic document extraction, or bid submission.
- Scenarios and invalid drafts are not persisted across a full refresh.
- Local resources work after loading; no installable PWA or service-worker
  caching is claimed. Browser-storage availability and capacity still apply.

## Future development

Proposed extensions include authentication, secure cloud workspaces, team
collaboration, real subscription billing, server-side quota enforcement, and
optional reviewed tender-document extraction. These are not implemented features.

## Team

**Team Bai-chingko**

- Prince Mark Barcelon
- Ali Xander Paclibar
- Christan Jade Barnayha
- Lawrence

## License

No project license file is currently included in this repository.
