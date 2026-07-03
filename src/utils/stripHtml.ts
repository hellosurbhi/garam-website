export function stripHtml(input: string): string {
  let prev = "";
  let out = input;
  while (out !== prev) {
    prev = out;
    out = out.replace(/<[^<>]*>/g, "");
  }
  return out;
}
