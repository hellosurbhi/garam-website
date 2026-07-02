import { parseWaiverDocument } from "@/lib/waiverDisplay";

type WaiverDocumentProps = {
  text: string;
  className?: string;
};

export function WaiverDocument({ text, className }: WaiverDocumentProps) {
  const classes = ["waiver-doc", className].filter(Boolean).join(" ");

  return (
    <article className={classes} aria-label="Waiver document">
      {parseWaiverDocument(text).map((block, index) => {
        if (block.type === "title") {
          return (
            <h2 className="waiver-doc-title" key={`${block.type}-${index}`}>
              {block.text}
            </h2>
          );
        }

        if (block.type === "section") {
          return (
            <h3 className="waiver-doc-section" key={`${block.type}-${index}`}>
              {block.text}
            </h3>
          );
        }

        return (
          <p className="waiver-doc-paragraph" key={`${block.type}-${index}`}>
            {block.text}
          </p>
        );
      })}
    </article>
  );
}
