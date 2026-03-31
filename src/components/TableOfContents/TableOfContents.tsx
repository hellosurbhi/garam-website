import { useState, useEffect } from "react";
import { events } from "../../data/events";
import { isEventPast, msUntilMidnight } from "../../utils/eventDate";
import styles from "./TableOfContents.module.css";

export function TableOfContents() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(
      () => setTick((t) => t + 1),
      msUntilMidnight(),
    );
    return () => clearTimeout(timeout);
  }, [tick]);

  const upcomingEvents = events.filter((e) => !isEventPast(e.date) && !e.hidden);

  return (
    <div className={styles.toc}>
      {upcomingEvents.map((event, i) => {
        const isLive = event.url && event.url !== "#";
        const rowClass = isLive ? styles.row : `${styles.row} ${styles.rowDimmed}`;
        const content = (
          <>
            <span className={styles.date}>{event.date}</span>
            <span className={styles.city}>{event.city}</span>
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
