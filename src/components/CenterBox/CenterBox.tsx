import { CREATOR_URLS } from "@/data/socials";
import { TableOfContents } from "../TableOfContents/TableOfContents";
import styles from "./CenterBox.module.css";

export function CenterBox() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.box}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            Garam Mas<em>ala</em> Dating
          </h1>
          <p className={styles.subtitle}>
            Come watch a desi couple find love, and if you're lucky, make out.
            Made with love in New York by comedians{" "}
            <a href={CREATOR_URLS.surbhi} target="_blank" rel="noopener noreferrer" className={styles.subtitleLink}>
              Surbhi
            </a>{" "}
            and{" "}
            <a href={CREATOR_URLS.wyatt} target="_blank" rel="noopener noreferrer" className={styles.subtitleLink}>
              Wyatt Feegrado
            </a>{" "}
            at{" "}
            <a href={CREATOR_URLS.venue} target="_blank" rel="noopener noreferrer" className={styles.subtitleLink}>
              Top Secret Comedy Club
            </a>
            .
          </p>
        </div>
        <TableOfContents />
      </div>
    </div>
  );
}
