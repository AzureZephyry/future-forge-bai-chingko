# BidBridge — Know Before You Bid.

FUTURE FORGE — The ALMA Hackathon

Team Bai-chingko · React + Vite + TypeScript. The original FastAPI and AI
assessment implementation is preserved separately.

## Current release: Gap-to-Go workspace

The hackathon scope has changed. BidBridge is now a local procurement-readiness
and deadline-risk workspace, with no required backend, AI keys, or RAG service.
The older document-based assessment is preserved separately at `/legacy`.

From the repository root in Windows PowerShell (Node 24 + npm):

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Create an opportunity or choose **Load fictional
demo**. Enter requirements, statuses, and your preparation estimates; the
advisory and actions update immediately. Valid changes save to this browser's
localStorage. This is user-reported preparation guidance, not official
eligibility or a guarantee of bid success.

```powershell
npm run typecheck
npm run build
npm run test:unit
npx playwright install chromium
npm run test:browser
```

On Windows with Edge installed, set `$env:PLAYWRIGHT_CHANNEL='msedge'` before
browser tests instead of downloading Chromium. Python is only needed for the
separately maintained legacy checks (`npm run test:legacy` and the tests in
`backend/`), not the new primary product. Run all commands at repository root.

Local storage is one workspace on one browser/device, without cloud sync or
binary PDF storage. Corrupt/future-version data is rejected without automatic
replacement; unavailable storage is reported honestly. The core works with
network access disabled after resources load, but is not an installable PWA.

**Start what-if scenario** creates an in-memory copy. Compare the baseline and
hypothetical outcome, then discard or explicitly confirm applying the changes.
Refreshing drops the scenario and restores the baseline. **View decision brief**
shows the active workspace with its context and disclaimer; **Print decision
brief** opens the browser print dialog (including its Save as PDF option).

Read [RELEASE.md](RELEASE.md) for rules, verification, deployment limits and safe
team synchronization. [DEMO.md](DEMO.md) contains the exact judge demo and
presentation-ready business narrative.

Historical integration guides: [frontend](FRONTEND.md) and
[backend](backend/README.md). These describe the preserved `/legacy` workflow.
