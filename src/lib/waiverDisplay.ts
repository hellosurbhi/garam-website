export type WaiverDocumentBlock =
  | { type: "title"; text: string }
  | { type: "section"; text: string }
  | { type: "paragraph"; text: string };

const SIGNATURE_FIELD_PATTERN =
  /^(Name \(printed\)|Signature|Date of signature|Show date \(if known\)|Email|Phone):\s*_+\s*$/;

function cleanInlineMarkdown(text: string) {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
}

function flushParagraph(lines: string[], blocks: WaiverDocumentBlock[]) {
  if (lines.length === 0) return;
  blocks.push({
    type: "paragraph",
    text: cleanInlineMarkdown(lines.join(" ")),
  });
  lines.length = 0;
}

export function parseWaiverDocument(text: string): WaiverDocumentBlock[] {
  const blocks: WaiverDocumentBlock[] = [];
  const paragraphLines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph(paragraphLines, blocks);
      continue;
    }

    if (line === "---") {
      flushParagraph(paragraphLines, blocks);
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph(paragraphLines, blocks);
      blocks.push({ type: "title", text: cleanInlineMarkdown(line.slice(2)) });
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph(paragraphLines, blocks);
      blocks.push({
        type: "section",
        text: cleanInlineMarkdown(line.slice(3)),
      });
      continue;
    }

    const signatureHeadingMatch = line.match(/^\*\*([^*]+):\*\*$/);
    if (signatureHeadingMatch) {
      flushParagraph(paragraphLines, blocks);
      continue;
    }

    const signatureFieldMatch = line.match(SIGNATURE_FIELD_PATTERN);
    if (signatureFieldMatch) {
      flushParagraph(paragraphLines, blocks);
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph(paragraphLines, blocks);
  return blocks;
}

export function formatWaiverForReading(text: string) {
  return parseWaiverDocument(text)
    .map((block) => block.text)
    .join("\n\n");
}
