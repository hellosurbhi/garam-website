import { events } from "../../data/events";
import styles from "./TableOfContents.module.css";

export function TableOfContents() {
  return (
    <div className={styles.toc}>
      {events.map((event, i) => {
        const isLive = event.url && event.url !== "#";
        const rowClass = isLive ? styles.row : `${styles.row} ${styles.rowDimmed}`;
        const content = (
          <>
            <span className={styles.date}>{event.date}</span>
            <span className={styles.city}>
              <span className={styles.numeral}>{event.numeral}</span>
              {event.city}
            </span>
          </>
        );
        return isLive ? (
          <a
            key={i}
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className={rowClass}
            style={{ animationDelay: `${1.0 + i * 0.12}s` }}
          >
            {content}
          </a>
        ) : (
          <div
            key={i}
            className={rowClass}
            style={{ animationDelay: `${1.0 + i * 0.12}s` }}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
