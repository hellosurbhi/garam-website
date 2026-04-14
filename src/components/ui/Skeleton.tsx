import ReactSkeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import styles from "./Skeleton.module.css";

const WIDTHS = ["100%", "55%", "100%", "75%", "100%", "55%"];

interface Props {
  count?: number;
  height?: number;
  borderRadius?: number | string;
}

export default function Skeleton({
  count = 4,
  height = 52,
  borderRadius = 12,
}: Props) {
  return (
    <div className={styles.skeleton}>
      {Array.from({ length: count }).map((_, i) => (
        <ReactSkeleton
          key={i}
          height={height}
          width={WIDTHS[i % WIDTHS.length]}
          borderRadius={borderRadius}
        />
      ))}
    </div>
  );
}
