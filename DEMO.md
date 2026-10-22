# BidBridge judge demo and presentation copy

## Current commercial checkpoint: quick demo

Run `npm ci`, then `npm run dev`; open **http://127.0.0.1:5173**.
The homepage, Features and Pricing pages lead into the multipage workspace.
Free includes three accepted uploads per local day. Pro Weekly is an
illustrative ₱99 per 168-hour period, activated locally with no payment.

1. Open `/pricing` and explain the two plans and demo-only activation.
2. Open `/app/opportunity`; select **Load fictional demo**.
3. Prepare four small `.txt` files in a temporary folder, each containing
   `Fictional supporting evidence — user review required.` For example:

   ```powershell
   $bidbridgeDemoFolder = Join-Path $env:TEMP 'bidbridge-demo-files'
   New-Item -ItemType Directory -Force -Path $bidbridgeDemoFolder
   1..4 | ForEach-Object {
     Set-Content -LiteralPath (Join-Path $bidbridgeDemoFolder "evidence-$_.txt") -Value 'Fictional supporting evidence - user review required.'
   }
   ```

4. Open **Documents** and select three files. Show allowance **3 → 0** and
   the real evidence library. A fourth file is rejected without consuming more.
5. Select **View Pro Weekly**, then **Preview Pro Weekly** and **Activate Demo
   Pro**. No card, account or payment is involved. Show expiry in **Plan & Pricing**.
6. Return to Documents and accept the fourth file. Pro removes the daily count
   cap; the 10 MB per-file limit and browser storage capacity still apply.
7. Open **Gap-to-Go**, start a scenario, and change the specification estimate
   **7 → 3**. Risk clears, but Missing remains. Mark the specification,
   registration and delivery Ready: **Ready for Review** appears hypothetically.
8. Open **Decision brief** to show the hypothetical label and print controls.
   Return to Gap-to-Go and discard to restore the baseline.

Use a fresh browser profile for a fresh upload demonstration. Loading the
fictional tender does **not** reset usage or delete files. **End demo Pro**
returns to the day's previously consumed Free allowance. Expiry does the same
automatically, without deleting accepted files. Do not clear real user data to
reset a presentation. The app uses local storage only and has no billing server.

Motion animations and further visual expansion were deferred to preserve the
stable commercial workflow. The earlier standalone presentation copy below
remains useful; its original single-page instructions are historical. Use the
routes and steps above for the current build.

**Product:** BidBridge — Know Before You Bid. A local procurement-preparation
workspace for small suppliers, contractors and procurement assistants.

**One-sentence value proposition:** Know which preparation gaps and deadline
risks need attention before investing more effort in a bid.

**Problem:** Small suppliers can spend time pursuing an opportunity before
recognizing an unresolved mandatory requirement or an unrealistic preparation
window. A checklist completion percentage alone can conceal that risk.

**Solution:** Record the opportunity and its actual requirements, distinguish
prepared items from unsupported claims, review prioritized actions, and test
how different preparation assumptions change the advisory.

**Three strongest differentiators:**

1. Mandatory blockers take precedence over recorded completion percentage.
2. Gap-to-Go explains each priority and its deadline implications transparently.
3. An isolated what-if comparison turns a static checklist into an interactive
   preparation decision, with a printable, clearly qualified brief.

This is a focused, accessible combination of existing procurement-readiness
practices. We do not claim to have invented checklists or bid/no-bid assessment.

## Repeatable 2-minute demonstration

1. Open `http://127.0.0.1:5173` after `npm run dev`. Select **Load fictional
   demo**, confirming replacement if another workspace exists. The example is
   visibly fictional, with a fresh deadline five calendar days from today.
2. Explain the six items: two Ready; registration Claimed; specification Missing;
   delivery Unknown; an optional supporting record Missing. Ready is the user's
   statement about supporting evidence, not official verification.
3. Show **Critical Blocker**, three unresolved mandatory items, one deadline
   risk and 33% recorded ready. Gap-to-Go puts the mandatory specification first:
   its seven-day estimate exceeds five days remaining by two days.
4. Select **Start what-if scenario**. Change the signed specification estimate
   from **7 to 3**. The advisory becomes **Action Required**, deadline risks
   change **1 → 0**, and the risk appears as removed under the entered assumptions.
   The item remains Missing. The baseline still shows Critical Blocker.
5. Mark the specification **Ready**. There are still two unresolved mandatory
   items; the advisory remains Action Required. A shorter estimate did not
   establish completion, and a hypothetical status does not verify evidence.
6. Mark **Supplier registration** and **Delivery commitment** Ready. The scenario
   becomes **Ready for Review**, with the optional missing record still visible.
   Unresolved items change **4 → 1**; the baseline remains unchanged.
7. Select **View decision brief**, then **Print decision brief** if useful. It
   clearly says HYPOTHETICAL SCENARIO and includes the preparation disclaimer.
   Cancel the native print dialog to return to the app.
8. Select **Discard scenario** and confirm. The original seven-day estimate and
   Critical Blocker return. Refresh to show the saved baseline survives.
   Alternatively, Apply requires explicit confirmation before replacing baseline.

To reset between demonstrations, discard any scenario, then **Load fictional
demo** and confirm. A fresh five-day window and the original six statuses return.
The sample date is rolling only when loaded; a saved real deadline does not move.

If internet connectivity is lost after frontend resources load, the workflow
continues locally. Launch/load resources before disconnecting; this is not a PWA.
No API key or Python server is needed. Use the same origin/port for persistence.

## Commercial framing and next validation

**Primary customer:** resource-constrained small suppliers and procurement
assistants. Contractors, consultants and bid-preparation services are adjacent
segments.

**Value:** clearer priorities and better-informed early preparation decisions.
No measured time-saving, market size, revenue, eligibility or winning probability
is claimed.

**Revenue hypotheses:** pay per workspace, subscriptions, or licensing to
preparation services. These require validation and are not implemented payments
or demonstrated revenue.

**Questions for supplier interviews:** When do teams discover preparation gaps?
Which evidence and deadline decisions cause the most rework? Does the scenario
change which opportunity they pursue or how they prepare? What would they pay
for dependable storage, collaboration or document import?

**Known limitations:** manual entry, one workspace per browser, no cloud recovery,
unverified status/estimate/page inputs, calendar dates without exact closing
times, no task dependencies or official rules, and no real tender discovery or
automatic submission. Scenarios are lost on refresh unless intentionally applied.

**Roadmap hypotheses, not shipped features:** reviewed tender-document imports,
bid-bulletin change tracking, collaborative preparation, cloud synchronization,
supporting-document management and official procurement information integrations.

**Closing line:** “BidBridge makes preparation gaps visible and lets suppliers
see what would have to change before they are ready to review a bid.”
