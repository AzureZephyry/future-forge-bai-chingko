import type { Requirement } from "../types";
import { StatusBadge } from "./StatusBadge";

interface Props {
  item: Requirement;
  changed: boolean;
}

export function RequirementCard({ item, changed }: Props) {
  const { source } = item;
  return (
    <article className="card">
      <header className="card__header">
        <h3 className="card__title">
          <span className="card__id">{item.id}</span> {item.requirement}
        </h3>
        <div className="card__tags">
          {changed && <span className="tag-changed">Changed</span>}
          <StatusBadge status={item.status} />
        </div>
      </header>

      <p className="card__reason">{item.reason}</p>

      <blockquote className="evidence">
        <p className="evidence__text">{source.excerpt}</p>
        <footer className="evidence__meta">
          {source.document} &middot; page {source.page} &middot; {source.chunk_id}
        </footer>
      </blockquote>

      <p className="card__action">
        <strong>Next action:</strong> {item.next_action}
      </p>
    </article>
  );
}
