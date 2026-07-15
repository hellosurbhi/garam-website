import { parseWaiverDocument } from "@/lib/waiverDisplay";
import styles from "@/components/ContestantPortal.module.css";

type WaiverDocumentProps = {
  text: string;
};

export function WaiverDocument({ text }: WaiverDocumentProps) {
  return (
    <article className={styles.waiverDoc} aria-label="Waiver document">
      {parseWaiverDocument(text).map((block, index) => {
        if (block.type === "title") {
          return (
            <h2
              className={styles.waiverDocTitle}
              key={`${block.type}-${index}`}
            >
              {block.text}
            </h2>
          );
        }

        if (block.type === "section") {
          return (
            <h3
              className={styles.waiverDocSection}
              key={`${block.type}-${index}`}
            >
              {block.text}
            </h3>
          );
        }

        return (
          <p
            className={styles.waiverDocParagraph}
            key={`${block.type}-${index}`}
          >
            {block.text}
          </p>
        );
      })}
    </article>
  );
}
