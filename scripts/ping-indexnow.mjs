/**
 * Runs after production Vercel builds to notify search engines
 * (Bing/IndexNow) that the sitemap was updated. Reads URLs from the
 * generated sitemap XML so the list is always authoritative.
 * Non-blocking: failures only warn.
 *
 * Bing processes IndexNow submissions and shares data with other engines.
 * Google requires manual sitemap submission in Google Search Console.
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

const SITE = "https://garammasaladating.com";
const KEY = "053daf33e1f144f28143394db082d4b7";
const KEY_LOCATION = `${SITE}/${KEY}.txt`;

function shouldPingIndexNow() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.INDEXNOW_FORCE === "1" ||
    process.env.INDEXNOW_DRY_RUN === "1"
  );
}

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

function readGeneratedSitemaps() {
  const outputDirs = [resolve("dist", "client"), resolve("dist")];
  const sitemapXml = [];

  for (const dir of outputDirs) {
    if (!existsSync(dir)) {
      continue;
    }

    try {
      const sitemapFiles = readdirSync(dir)
        .filter((name) => /^sitemap(?:-\d+)?\.xml$/.test(name))
        .sort();

      for (const file of sitemapFiles) {
        sitemapXml.push(readFileSync(join(dir, file), "utf8"));
      }
    } catch {
      // Try the next generated output location.
    }
  }

  return sitemapXml;
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
  if (!shouldPingIndexNow()) {
    console.log("[sitemap-ping] Non-production build — skipping");
    return;
  }

  const sitemaps = readGeneratedSitemaps();
  if (sitemaps.length === 0) {
    console.log("[sitemap-ping] Generated sitemap XML not found — skipping");
    return;
  }

  const urls = [...new Set(sitemaps.flatMap(extractUrls))];
  if (urls.length === 0) {
    console.log("[sitemap-ping] No URLs parsed from sitemap — skipping");
    return;
  }

  console.log(`[sitemap-ping] Pinging ${urls.length} URLs via IndexNow…`);

  if (process.env.INDEXNOW_DRY_RUN === "1") {
    console.log("[sitemap-ping] Dry run enabled — not sending request");
    return;
  }

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
