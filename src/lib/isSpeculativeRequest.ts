/**
 * Recognizes speculative requests: browser prefetches, prerenders and
 * link-preview fetches that a human never initiated.
 *
 * These are the blind spot isBotUserAgent() cannot cover. A prefetch is made
 * by the visitor's own browser, so it carries an ordinary browser
 * User-Agent, their cookies and their IP; nothing about it looks like a bot.
 * Chrome's "preload pages" setting, speculation rules, `<link rel=prefetch>`
 * and extension-driven prefetchers all fetch `/api/go/[slug]` links exactly
 * this way, and every one of those fetches used to be reported to Meta as an
 * InitiateCheckout for a click that never happened.
 *
 * Every browser that speculates announces it in a request header, which is
 * the whole point of these headers: Sec-Purpose is the current standard
 * (Chrome/Edge, `prefetch` and `prefetch;prerender`), Purpose is its legacy
 * spelling, X-moz is Firefox's, X-Purpose is Safari's.
 *
 * Fetch Metadata closes the rest: the only legitimate human path to a
 * tracked redirect is a top-level navigation, so a browser that tells us the
 * request is anything else (`fetch`/XHR/subresource) is not someone opening
 * checkout. Requests with no Sec-Fetch-Mode at all (non-browser clients) are
 * left to the User-Agent denylist, unchanged.
 */
const SPECULATIVE_HEADERS: ReadonlyArray<readonly [string, RegExp]> = [
  ["sec-purpose", /prefetch|prerender/i],
  ["purpose", /prefetch|preview/i],
  ["x-purpose", /prefetch|preview/i],
  ["x-moz", /prefetch|preview/i],
];

export function isSpeculativeRequest(request: Request): boolean {
  for (const [header, pattern] of SPECULATIVE_HEADERS) {
    const value = request.headers.get(header);
    if (value && pattern.test(value)) return true;
  }

  const fetchMode = request.headers.get("sec-fetch-mode");
  return fetchMode !== null && fetchMode !== "navigate";
}
