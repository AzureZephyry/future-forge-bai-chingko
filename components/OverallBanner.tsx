import type { OverallOutcome } from "../types";

const COPY: Record<OverallOutcome, { title: string; text: string }> = {
  consider: {
    title: "Consider bidding",
    text: "No blocking gaps found in the evidence reviewed.",
  },
  needs_review: {
    title: "Needs review",
    text: "Some requirements are unverified or unclear. Check them before investing in a bid.",
  },
  pause: {
    title: "Pause and resolve gaps",
    text: "Required items look missing or in conflict. Resolve them first.",
  },
};

export function OverallBanner({ overall }: { overall: OverallOutcome }) {
  const { title, text } = COPY[overall];
  return (
    <section className={`banner banner--${overall}`}>
      <h2 className="banner__title">{title}</h2>
      <p className="banner__text">{text}</p>
      <p className="banner__note">Advisory only. Not an official eligibility decision.</p>
    </section>
  );
}
