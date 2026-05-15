import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] ?? 4321);
const root = path.resolve(__dirname, "../..", process.argv[3] ?? "dist/client");
const host = "127.0.0.1";

const redirects = new Map([
  ["/south-asian-dating-tips", "/journal"],
  [
    "/south-asian-dating-tips/how-to-find-love-as-a-desi-in-new-york",
    "/journal/how-to-find-love-as-a-desi-in-new-york",
  ],
  [
    "/south-asian-dating-tips/how-to-find-someone-before-your-parents-arrange-marry-you-off",
    "/journal/how-to-find-someone-before-your-parents-arrange-marry-you-off",
  ],
  [
    "/south-asian-dating-tips/why-going-with-the-flow-is-ruining-your-dating-life",
    "/journal/why-going-with-the-flow-is-ruining-your-dating-life",
  ],
]);

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": contentTypes[".json"] });
  res.end(JSON.stringify(body));
}

function normalizeUrlPath(reqUrl) {
  try {
    return decodeURIComponent(new URL(reqUrl ?? "/", `http://${host}`).pathname);
  } catch {
    return "/";
  }
}

function safePath(urlPath) {
  const relative = urlPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relative);
  return filePath.startsWith(root) ? filePath : root;
}

async function findFile(urlPath) {
  const basePath = safePath(urlPath);
  const candidates = [];

  if (path.extname(basePath)) {
    candidates.push(basePath);
  } else {
    candidates.push(path.join(basePath, "index.html"));
    candidates.push(`${basePath}.html`);
  }

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

async function serveFile(req, res, filePath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[ext] ?? "application/octet-stream";
  const body = req.method === "HEAD" ? "" : await readFile(filePath);
  res.writeHead(statusCode, { "content-type": contentType });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const urlPath = normalizeUrlPath(req.url);

  if (urlPath === "/api/geo") {
    sendJson(res, 200, {});
    return;
  }

  if (urlPath === "/api/capture-lead" && req.method === "POST") {
    sendJson(res, 200, { ok: true, id: "smoke-lead" });
    return;
  }

  if (urlPath === "/api/update-lead" && req.method === "POST") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const redirectTarget = redirects.get(urlPath);
  if (redirectTarget) {
    res.writeHead(308, { location: redirectTarget });
    res.end();
    return;
  }

  const filePath = await findFile(urlPath);
  if (filePath) {
    await serveFile(req, res, filePath);
    return;
  }

  const notFoundPath = await findFile("/404");
  if (notFoundPath) {
    await serveFile(req, res, notFoundPath, 404);
    return;
  }

  res.writeHead(404, { "content-type": contentTypes[".txt"] });
  res.end("Not found");
});

server.listen(port, host, () => {
  console.log(`Static preview serving ${root} at http://${host}:${port}`);
});
