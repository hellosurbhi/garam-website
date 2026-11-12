import { SHOWS_ACTIONS, SHOWS_LIST } from "@/data/adminShows";
import type { EventEntry } from "@/data/eventsSnapshot";
import type { ShowPreview } from "./showsView";
import styles from "./ShowsTab.module.css";

interface ShowsListProps {
  /** Draft shows, already sorted. */
  shows: EventEntry[];
  previews: Map<string, ShowPreview>;
  /** Slugs with unpublished changes. */
  pendingSlugs: ReadonlySet<string>;
  todayIso: string;
  /** True while a draft write is in flight (see useShowsDialog). */
  disabled: boolean;
  onEdit: (slug: string) => void;
  onCancel: (slug: string) => void;
}

function isActive(e: EventEntry, todayIso: string): boolean {
  return Boolean(
    e.isoDate && e.isoDate >= todayIso && e.status !== "canceled" && !e.hidden,
  );
}

/** Every draft show as a card; past, hidden and canceled ones folded away. */
export default function ShowsList({
  shows,
  previews,
  pendingSlugs,
  todayIso,
  disabled,
  onEdit,
  onCancel,
}: ShowsListProps) {
  const active = shows.filter((e) => isActive(e, todayIso));
  const rest = shows.filter((e) => !isActive(e, todayIso));
  const card = (e: EventEntry) => {
    const preview = previews.get(e.slug);
    const where = e.venue
      ? `${e.venue.name}, ${e.venue.addressLocality}`
      : SHOWS_LIST.noVenue;
    return (
      <li key={e.slug} className={styles.card}>
        <span className={styles.cardDate}>{e.date}</span>
        <span className={styles.cardCity}>{`${e.city}, ${e.stateAbbr}`}</span>
        <span className={styles.cardMeta}>{where}</span>
        <span className={styles.pills}>
          {preview && (
            <span className={styles.pill} data-tone={preview.tone}>
              {preview.label}
            </span>
          )}
          {pendingSlugs.has(e.slug) && (
            <span className={styles.pill} data-tone="new">
              {SHOWS_LIST.unpublished}
            </span>
          )}
        </span>
        <span className={styles.cardActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={disabled}
            onClick={() => onEdit(e.slug)}
            aria-label={`${SHOWS_ACTIONS.edit} ${e.city}, ${e.date}`}
          >
            {SHOWS_ACTIONS.edit}
          </button>
          {e.status !== "canceled" && (
            <button
              type="button"
              className={styles.ghostButton}
              disabled={disabled}
              onClick={() => onCancel(e.slug)}
              aria-label={`${SHOWS_ACTIONS.cancelShow} ${e.city}, ${e.date}`}
            >
              {SHOWS_ACTIONS.cancelShow}
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <section className={styles.section} aria-labelledby="shows-list-heading">
      <h2 id="shows-list-heading" className={styles.sectionHeading}>
        {SHOWS_LIST.heading}
      </h2>
      <h3 className={styles.subHeading}>{SHOWS_LIST.upcoming}</h3>
      {active.length > 0 ? (
        <ul className={styles.grid}>{active.map(card)}</ul>
      ) : (
        <p className={styles.emptyHint}>{SHOWS_LIST.empty}</p>
      )}
      {rest.length > 0 && (
        <details className={styles.details}>
          <summary className={styles.summary}>
            {SHOWS_LIST.older(rest.length)}
          </summary>
          <ul className={styles.grid}>{rest.map(card)}</ul>
        </details>
      )}
    </section>
  );
}
