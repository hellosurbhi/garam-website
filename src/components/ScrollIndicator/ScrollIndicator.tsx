import styles from "./ScrollIndicator.module.css";

export function ScrollIndicator() {
  return (
    <div className={styles.indicator}>
      <div className={styles.line} />
    </div>
  );
}
