/**
 * Refresh dateModified for published journal articles older than 60 days.
 * Run by the monthly article-refresh GitHub Action.
 *
 * Reads each journal data file, finds articles where:
 *   - datePublished is in the past (article is published)
 *   - dateModified is older than 60 days
 * Updates dateModified to today's date in YYYY-MM-DD format.
 */

const fs = require("fs");
const path = require("path");

const JOURNAL_DIR = path.join(__dirname, "..", "src", "data", "journal");
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
const cutoff = new Date(today.getTime() - SIXTY_DAYS_MS);

const files = fs
  .readdirSync(JOURNAL_DIR)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts");

let totalUpdated = 0;

for (const file of files) {
  const filePath = path.join(JOURNAL_DIR, file);
  let content = fs.readFileSync(filePath, "utf-8");
  let updated = 0;

  // Match dateModified lines and check if they need updating
  const dateModifiedRe = /dateModified:\s*"(\d{4}-\d{2}-\d{2})"/g;
  const datePublishedRe = /datePublished:\s*"(\d{4}-\d{2}-\d{2})"/g;

  // Collect all datePublished values to check if articles are published
  const publishedDates = [];
  let match;
  while ((match = datePublishedRe.exec(content)) !== null) {
    publishedDates.push({
      date: new Date(match[1] + "T00:00:00Z"),
      index: match.index,
    });
  }

  // For each dateModified, find the nearest preceding datePublished
  const newContent = content.replace(dateModifiedRe, (fullMatch, dateStr) => {
    const modDate = new Date(dateStr + "T00:00:00Z");
    const matchIdx = content.indexOf(fullMatch);

    // Find the nearest preceding datePublished
    const nearestPublished = publishedDates
      .filter((p) => p.index < matchIdx)
      .pop();

    if (!nearestPublished) return fullMatch;

    const isPublished = nearestPublished.date <= today;
    const isStale = modDate <= cutoff;

    if (isPublished && isStale) {
      updated++;
      return `dateModified: "${todayStr}"`;
    }
    return fullMatch;
  });

  if (updated > 0) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    totalUpdated += updated;
    console.log(`  ${file}: refreshed ${updated} article(s)`);
  }
}

if (totalUpdated === 0) {
  console.log("No articles need refreshing (all dateModified within 60 days).");
} else {
  console.log(`\nTotal: refreshed ${totalUpdated} article(s) to ${todayStr}`);
}
