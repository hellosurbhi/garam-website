/**
 * Post-build prerender script.
 *
 * Visits each public route with Puppeteer, waits for React + useEffect to run
 * (including JSON-LD injection), then saves the fully-rendered HTML as static files.
 * Vercel serves these automatically — matching paths get prerendered HTML,
 * unmatched paths fall through to the SPA shell.
 */

import { createServer } from "http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import puppeteer from "puppeteer";

// ---------------------------------------------------------------------------
// Route list — derived from static data files
// ---------------------------------------------------------------------------

// Import data from source. We use dynamic imports so the script can be run
// with tsx without needing a full Vite build pipeline for the data modules.
// Since these are simple TS files with no JSX, tsx handles them fine.

import { cities } from "../src/data/cities.js";
import { journalPosts } from "../src/data/journal.js";
import { tipPosts } from "../src/data/tips.js";

const STATIC_ROUTES = [
  "/",
  "/apply",
  "/faq",
  "/links",
  "/cities",
  "/journal",
  "/south-asian-dating-tips",
];

const CITY_ROUTES = Object.keys(cities).map((slug) => `/cities/${slug}`);
const JOURNAL_ROUTES = journalPosts.map((p) => `/journal/${p.slug}`);
const TIP_ROUTES = tipPosts.map((p) => `/south-asian-dating-tips/${p.slug}`);

const ALL_ROUTES = [
  ...STATIC_ROUTES,
  ...CITY_ROUTES,
  ...JOURNAL_ROUTES,
  ...TIP_ROUTES,
];

// Routes to SKIP (client-only, behind auth):
// /admin, /contestant-prep — intentionally excluded

// ---------------------------------------------------------------------------
// Static file server for the dist/ output
// ---------------------------------------------------------------------------

const DIST = join(import.meta.dirname, "..", "dist");
const PORT = 4173;

function getMime(path: string): string {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".avif")) return "image/avif";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

function startServer(): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = req.url ?? "/";
      const filePath = join(DIST, url === "/" ? "index.html" : url);

      // Try exact file, then fall back to SPA index.html
      const target = existsSync(filePath) ? filePath : join(DIST, "index.html");
      const content = readFileSync(target);
      res.writeHead(200, { "Content-Type": getMime(target) });
      res.end(content);
    });
    server.listen(PORT, () => resolve(server));
  });
}

// ---------------------------------------------------------------------------
// Prerender each route
// ---------------------------------------------------------------------------

async function prerender() {
  console.log(`\n  Prerendering ${ALL_ROUTES.length} routes...\n`);

  const server = await startServer();
  const browser = await puppeteer.launch({ headless: true });

  let rendered = 0;
  for (const route of ALL_ROUTES) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });

    // Wait a bit for any remaining useEffect (JSON-LD injection, etc.)
    await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));

    const html = await page.content();
    await page.close();

    // Write to dist/[route]/index.html (or dist/index.html for root)
    const outPath =
      route === "/"
        ? join(DIST, "index.html")
        : join(DIST, route, "index.html");

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `<!DOCTYPE html>${html}`);
    rendered++;
    console.log(`  ${rendered}/${ALL_ROUTES.length}  ${route}`);
  }

  await browser.close();
  server.close();

  console.log(`\n  Done! ${rendered} pages prerendered.\n`);
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
