import type { Requirement } from "../types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  item: Requirement;
  changed: boolean;
}

export function RequirementCard({ item, changed }: Props) {
  const sources = item.sources.length > 0 ? item.sources : item.source ? [item.source] : [];
  return (
    <article className="card">
      <header className="card__header">
        <h3 className="card__title">
          <span className="card__id">{item.id}</span> {item.requirement}
        </h3>
        <div className="card__tags">
          {changed && <span className="tag-changed">Status changed</span>}
          <StatusBadge status={item.status} />
        </div>
      </header>

      <p className="card__reason">{item.reason}</p>

      <details className="evidence-list" open>
        <summary>Source evidence ({sources.length})</summary>
        {sources.map((source) => (
          <blockquote className="evidence" key={source.chunk_id}>
            <p className="evidence__text">{source.excerpt}</p>
            <footer className="evidence__meta">
              {source.document} &middot; {source.page === null ? "Page unavailable" : `Page ${source.page}`} &middot; {source.chunk_id}
            </footer>
          </blockquote>
        ))}
        {sources.length === 0 && <p className="hint">No source passage was supplied.</p>}
      </details>

      <p className="card__action">
        <strong>Next action:</strong> {item.next_action}
      </p>
    </article>
  );
}
