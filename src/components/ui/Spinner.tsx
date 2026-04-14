import styles from "./Spinner.module.css";

interface Props {
  size?: "sm" | "md";
  label?: string;
}

export default function Spinner({ size = "md", label = "Loading..." }: Props) {
  return (
    <span
      className={`${styles.spinner} ${styles[size]}`}
      role="status"
      aria-label={label}
    />
  );
}
