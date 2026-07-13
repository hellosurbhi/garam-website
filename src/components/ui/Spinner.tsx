import styles from "./Spinner.module.css";

interface Props {
  size?: "sm" | "md";
  label?: string;
}

export default function Spinner({ size = "md", label = "Loading..." }: Props) {
  const className = `${styles.spinner} ${styles[size]}`;
  if (!label) {
    return <span className={className} aria-hidden="true" />;
  }
  return <span className={className} role="status" aria-label={label} />;
}
