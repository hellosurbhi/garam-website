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
            Come watch a desi couple find love, and maybe make out on stage
          </p>
        </div>
        <TableOfContents />
      </div>
    </div>
  );
}
