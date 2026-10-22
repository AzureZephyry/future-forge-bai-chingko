# Gap-to-Go release and engineering handoff

Authoritative branch: `integration/bidbridge`. Starting integrated AI baseline:
`f9e0dfca9fa7a5384f478d4490973eb31dc5ce4f`. The verified non-AI P0 was committed
and pushed first as `6413cf1664e091af5e2f01bce12f5448bc475484`, before scenario and
brief work. Obtain the current complete release hash with `git rev-parse HEAD`
and compare it with `git ls-remote origin refs/heads/integration/bidbridge`.

## Architecture and scope

The repository-root React/Vite/TypeScript application now runs one deterministic
procurement workspace at `/`. No API requests, credentials, Python process or
AI inference are required for this journey. No dependency was added for the
pivot. Existing palette, typography, cards and controls in `index.css` are reused
and extended by `workspace.css`.

- `lib/workspace.ts`: strict `TenderWorkspace`, `BidRequirement`, status meanings,
  runtime validation and calendar-day helpers. `fictional: boolean` records demo
  provenance. Dates are `YYYY-MM-DD`; `updatedAt` is a UTC ISO timestamp.
- `lib/readiness.ts`: `assessWorkspace(workspace, today)` returns counts,
  `remainingDays`, `readyPercentage`, blockers, actions, outcome and explanations.
  `today` is an explicit local date. The module has no React/network dependency
  and does not mutate input. Do not duplicate these rules in Python.
- `lib/demo.ts`: `createDemo(today, id, updatedAt)` creates six fictional items
  with a rolling deadline five calendar days ahead.
- `lib/storage.ts`: version 1 envelope `{ version: 1, workspace }` under
  `bidbridge.workspace.v1`. Valid changes save automatically. Invalid drafts
  retain the last valid save. Malformed/future data is rejected without automatic
  replacement. Quota/access failures are displayed and retain in-memory editing.
- `App.tsx`: workspace editing, local-save state and an independent scenario copy.
  The save effect observes only the baseline, never scenario state. Discard
  restores baseline; Apply requires confirmation and validation, then uses the
  same normal save path. Navigation warnings protect unsaved/scenario edits.
- `components/ScenarioComparison.tsx`: compares assessments from the same engine;
  reports counts and removed/introduced critical or estimated deadline risks.
- `components/DecisionBrief.tsx`: prints the currently displayed workspace with
  baseline/scenario and fictional labels. References are user-entered page
  numbers; they are not retrieved citations or inspected evidence.

Original frontend `App.tsx` was preserved as `legacy/LegacyAssessment.tsx`,
loaded only at `/legacy`. The original `api.ts`, `types.ts`, `validation.ts`,
AI result/citation components, FastAPI code, AI package and PDF infrastructure
remain. Legacy browser tests were moved, with their import/URL adjusted, to
`tests/legacy/frontend.spec.ts`; none were disabled. Only a historical-scope
notice was added to `backend/README.md`. No FastAPI routes or schemas changed.

## Exact business rules

Ready means the user reports preparation and supporting evidence available;
it is not independent or official verification. Claimed lacks confirmed
documentation and does not count as Ready. Missing is explicitly unavailable;
Unknown lacks information; Conflict records incompatible information.

The engine validates the full workspace first. Invalid fields and zero recorded
requirements produce **Setup Required**. Otherwise precedence is:

1. **Critical Blocker:** passed submission date, a mandatory Conflict, or an
   unresolved mandatory item with estimated days greater than remaining days.
2. **Action Required:** any mandatory item still Missing, Unknown or Claimed.
3. **Ready for Review:** all recorded mandatory items Ready and date not past.
   Optional gaps stay visible. With no designated mandatory items, the advisory
   explicitly asks the user to check tender completeness.

Recorded progress is rounded `ready / total * 100`, or not assessed for zero
items. It never overrides blockers. Deadline risk count is unresolved items
with an estimated overrun or a passed deadline; the global passed-date blocker
remains even when all items are Ready.

Calendar calculations compare validated Gregorian day ordinals using the user's
local current date, independent of time-of-day/DST. Today is zero days and not
automatically passed; the UI tells users to check the actual closing time. Dates
update on window focus and every 30 seconds. A null estimate is unknown, zero
is zero estimated additional days, equal days means no buffer, fewer days means
positive buffer, and greater days means overrun. Ready items need no further
estimated preparation, but do not override a passed submission date. Estimates
are individual user assumptions, never agency turnaround times or a summed
project schedule. Dependencies and completion dates are not inferred.

Actions sort by mandatory Conflict, mandatory overrun, other mandatory Missing,
mandatory Unknown, mandatory Claimed, then optional unresolved items. Ties keep
recorded order. Each action includes status, designation, recommendation, reason
and feasibility. Optional overrun is visible as a risk without becoming a
mandatory blocker. Shortening an estimate never changes an item's status.

Scenario results remain hypothetical until explicitly applied. A removed risk
means it no longer appears under the new inputs, not that real preparation is
complete. Print includes the same disclaimer and scenario context.

Validation: titles/organization up to 240 characters, notes/description 4,000,
up to 100 requirements, unique stable IDs, valid enums/booleans, finite
nonnegative preparation days or null, positive safe-integer pages or null.
Invalid values are not converted into valid conclusions. No binary files or
personal documents are stored.

## Run and verify (Windows PowerShell, repository root)

```powershell
npm ci
npm run dev
# http://127.0.0.1:5173
```

```powershell
npm run typecheck
npm run build
npm run test:unit
$env:PLAYWRIGHT_CHANNEL='msedge'
npm run test:browser
```

Use `npx playwright install chromium` and omit the channel variable if Edge is
not installed. `npm test` runs the unit and primary browser suites. Browser
tests start Vite automatically on 4173; unit tests need no browser or server.

Preserved legacy verification requires the existing Python development setup
documented in `backend/README.md`:

```powershell
npm run test:legacy
.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider backend/tests backend/ai_assessment/tests -q
```

Legacy browser tests start FastAPI fixture/default servers on 8766/8767 and
Vite on 4173. Do not run the two browser suites at the same time because they
use the same port. Unit, primary and legacy Playwright artifacts use distinct
directories under ignored `test-results/`.

P0 verification: 65 unit tests, 17 new browser tests, 19 preserved legacy browser
tests and 72 Python backend/AI tests passed; TypeScript and build passed.
Final `npm test`: **65 unit tests and 27 primary browser tests passed**. The added
checks cover scenario isolation, refresh, discard, confirmed apply, invalid
input, introduced risks, a full rescue, baseline print, draft replacement
protection and a mobile scenario/brief. Final TypeScript and production build
passed. A headless Edge check against `npm run preview -- --host 127.0.0.1
--port 4174 --strictPort` exercised the real built bundle: demo, scenario, brief,
offline edits and mobile width, with zero page errors or `/api/` requests.
The generated two-page A4 PDF contains the context, requirement and disclaimer
text; print-media checks hide editing controls and preserve the brief.
Final preserved checks also passed: 19 legacy browser tests and 72 Python tests
(plus 58 subtests). Python reports one existing Starlette/httpx deprecation
warning; no dependency change was made for it.

Early check failures were corrected and rerun: ambiguous text selectors; shared
Playwright artifact cleanup during concurrent unit/browser runs (now isolated);
an incorrectly forwarded npm reporter flag (rerun with the documented `npm test`);
and a PDF text assertion that needed whitespace normalization. No test was
disabled. These were check/harness failures, not accepted product exceptions.

Deploy the `dist/` produced by `npm run build` to a static host. Root hosting is
the tested setup. `/legacy` needs an SPA fallback and a separately running
FastAPI backend/proxy for that historical flow. No real ALMA implementation is
claimed; its documentation remains pending and is outside this release.

## Team handoff

**Ali:** synchronize this branch before UI work. Primary flow/state is in
`App.tsx`; domain types are in `lib/workspace.ts`, distinct from preserved AI API
types in `types.ts`. UI components are OpportunityForm, RequirementEditor,
ReadinessDashboard, ScenarioComparison and DecisionBrief. Existing controls and
visual foundation remain in `index.css`; additions are `workspace.css`. Use
`assessWorkspace(workspace, localDate(new Date()))`; keep assessment derived.
Review small-screen ease of editing without rebuilding these features.

**Christan:** no FastAPI production source changed and the new product requires
no backend. Preserved routes are GET `/api/health` and POST `/api/analyze` with
their original schemas/explicit provider behavior. 72 backend/AI tests and 19
legacy browser tests passed at P0. Leave unavailable inference explicit in the
legacy flow. Cloud persistence/collaboration are future decisions; do not build
a second readiness engine or unblock obsolete AI work for the demo.

**Lawrence:** no retrieval work was deleted or overwritten. Existing retrieval
code at `origin/feat/retrieval` was not merged into this pivot; its branch and
history remain intact, and backend PDF infrastructure remains unchanged.
Retrieval/RAG is outside MVP. Future document import may help users draft a
checklist, but must preserve evidence provenance and require user review. Useful
current work is reviewing sample requirement wording and testing manual entry,
boundary dates and the demo, without modifying the engine's rules independently.

## Safe teammate synchronization

Run on each teammate's own feature branch, never blindly reset to integration:

```powershell
git status --short
git branch --show-current
git fetch origin
git log --oneline --left-right HEAD...origin/integration/bidbridge
```

If there are uncommitted changes, first commit intended work on the feature
branch, or preserve it with `git stash push -u -m "before BidBridge pivot sync"`.
Stashing excludes ignored files; preserve any needed ignored local data
separately. Check `git stash list` before restoring work.

```powershell
git merge-base --is-ancestor HEAD origin/integration/bidbridge
# Exit 0: feature branch can fast-forward.
git merge --ff-only origin/integration/bidbridge
```

If ancestry returns 1 (diverged), inspect the log and use a normal
`git merge origin/integration/bidbridge` instead. Resolve conflicts deliberately;
retain local work and the deterministic primary product. A conflicted merge can
be stopped with `git merge --abort`. Restore stashed changes using
`git stash apply` and resolve/retest before dropping that stash. Do not use
hard reset, shared-history rebase, force push, or merge into main.

Run `npm ci`, typecheck, build, unit and browser checks after frontend merges;
also run the Python/legacy checks for backend changes. Inspect the diff and
publish the current feature branch with a normal `git push origin HEAD`.
Fetch first and reconcile any remote advance with a normal merge; never
overwrite another person's commits. Coordinate subsequent integration work
against the verified integration hash shown in the release report.

## Limits and deferred work

One browser workspace, no accounts, shared editing, cloud recovery or multi-tab
conflict resolution. Clearing site data loses the saved workspace; storage is
specific to origin/device, so dev and deployed URLs have separate saves. Invalid
drafts, unsubmitted new-opportunity forms and scenarios are not saved; scenario
refresh restores baseline. Autosave failures are surfaced; keep the tab open.
Calendar dates omit exact closing time, holidays and working-day calendars.
Reference pages are entered manually. No legal rules, real tender discovery,
document analysis, winning prediction or submission are implemented. Print
dialog/pagination depends on the browser; tested through Edge's print media and
PDF output, not a physical printer. No installable PWA/service worker is claimed.

JSON backup, multiple opportunities, collaboration, real document import and
cloud sync are deferred. No critical known defect remains after the checks
reported for release. The next valuable action is a short team rehearsal on the
final shared build, using [DEMO.md](DEMO.md).
