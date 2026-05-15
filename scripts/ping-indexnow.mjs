/**
 * Runs after astro build to notify search engines (Bing/IndexNow) that
 * the sitemap was updated. Reads URLs from the generated sitemap XML so
 * the list is always authoritative. Non-blocking: failures only warn.
 *
 * Bing processes IndexNow submissions and shares data with other engines.
 * Google requires manual sitemap submission in Google Search Console.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const SITE = "https://garammasaladating.com";
const KEY = "053daf33e1f144f28143394db082d4b7";
const KEY_LOCATION = `${SITE}/${KEY}.txt`;

function extractUrls(xml) {
  const urls = [];
  for (const [, url] of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const trimmed = url.trim();
    // Skip sitemap index entries — we want page URLs only
    if (!trimmed.includes("sitemap")) {
      urls.push(trimmed);
    }
  }
  return urls;
}

async function readSitemap() {
  const candidates = ["sitemap-0.xml", "sitemap.xml"];
  for (const name of candidates) {
    try {
      return readFileSync(resolve("dist", name), "utf8");
    } catch {
      // try next
    }
  }
  return null;
}

async function pingIndexNow(urls) {
  const host = new URL(SITE).hostname;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: KEY,
      keyLocation: KEY_LOCATION,
      urlList: urls.slice(0, 10000), // IndexNow hard cap
    }),
  });
  return res.status;
}

async function main() {
  const xml = await readSitemap();
  if (!xml) {
    console.log("[sitemap-ping] dist/sitemap-0.xml not found — skipping");
    return;
  }

  const urls = extractUrls(xml);
  if (urls.length === 0) {
    console.log("[sitemap-ping] No URLs parsed from sitemap — skipping");
    return;
  }

  console.log(`[sitemap-ping] Pinging ${urls.length} URLs via IndexNow…`);

  try {
    const status = await pingIndexNow(urls);
    if (status === 200 || status === 202) {
      console.log(`[sitemap-ping] IndexNow accepted (${status})`);
    } else {
      console.log(`[sitemap-ping] IndexNow returned ${status} — check key file`);
    }
  } catch (err) {
    // Non-blocking: a failed ping doesn't break the deploy
    console.log(`[sitemap-ping] IndexNow failed: ${err.message}`);
  }
}

main();
