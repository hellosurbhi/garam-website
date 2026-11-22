// WHY these five characters: JSON-LD is emitted raw inside
// <script type="application/ld+json" set:html={...}>, and JSON.stringify
// leaves "<", ">" and "&" untouched, so event text such as "</script>" would
// close the tag and inject markup. U+2028 and U+2029 are legal in JSON but
// break some script parsers. Each is replaced with its six-character JSON
// escape, which JSON.parse turns back into the identical string, so the
// structured data is unchanged while no literal "<" survives in the HTML.
const JSON_LD_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** JSON.stringify for a JSON-LD script body that is safe to inline in HTML. */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError("serializeJsonLd: value is not JSON serializable");
  }
  return json.replace(/[<>&\u2028\u2029]/g, (c) => JSON_LD_ESCAPES[c]);
}
