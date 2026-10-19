import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const script = fileURLToPath(import.meta.url);

if (process.argv[2] === "--worker") {
  const artifact = process.argv[3];
  const { routes, ticketLinks } = JSON.parse(readFileSync(0, "utf8"));
  const config = JSON.parse(
    readFileSync(join(artifact, ".vc-config.json"), "utf8"),
  );

  // WHY: exercise the real packaged handler without contacting vendors,
  // analytics or customer services. The parent also strips credentials.
  const networkAttempts = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    // The adapter fetches the static error page from Vercel after a 404.
    // Supply that asset locally rather than starting a second HTTP server.
    if (url.href === "https://localhost/404.html") {
      return new Response("Not found", { status: 404 });
    }
    networkAttempts.push(`${url.origin}${url.pathname}`);
    throw new Error("Runtime smoke checks must not call external services");
  };
  const { default: handler } = await import(
    pathToFileURL(join(artifact, config.handler)).href
  );
  assert.equal(typeof handler.fetch, "function");
  const request = (path, init) =>
    handler.fetch(new Request(`https://garammasaladating.com${path}`, init));

  // OPTIONS loads each API module without executing a submission or cron.
  for (const route of routes) {
    const response = await request(route, { method: "OPTIONS" });
    assert.equal(response.status, 404, `API module failed to load: ${route}`);
  }

  const geo = await request("/api/geo", {
    headers: { "x-vercel-ip-city": "Chicago", "x-vercel-ip-country": "US" },
  });
  assert.equal(geo.status, 200);
  assert.equal((await geo.json()).city, "Chicago");

  const unknown = await request("/api/go/runtime-smoke-missing-event");
  assert.equal(unknown.status, 404);
  for (const href of ticketLinks) {
    const response = await request(`${href}?utm_source=runtime-smoke`);
    assert.equal(response.status, 302, `Ticket redirect failed: ${href}`);
    const destination = new URL(response.headers.get("location"));
    assert.equal(destination.protocol, "https:");
    assert.notEqual(destination.hostname, "garammasaladating.com");
    assert.equal(destination.searchParams.get("utm_source"), "runtime-smoke");
  }

  const lead = await request("/api/capture-lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(lead.status, 400);
  assert.equal((await lead.json()).error, "Valid email required");
  for (const path of ["/api/notify-application", "/api/alert-failure"]) {
    const response = await request(path, {
      method: "POST",
      headers: {
        origin: "https://runtime-smoke.invalid",
        "content-type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, 403, `Origin guard failed: ${path}`);
    assert.equal((await response.json()).error, "Forbidden");
  }
  assert.deepEqual(networkAttempts, []);
  console.log(
    `Packaged server passed: ${routes.length} API modules, ${ticketLinks.length} ticket redirects, geo and form guards.`,
  );
} else {
  const artifact = resolve(
    process.argv[2] ?? ".vercel/output/functions/_render.func",
  );
  const apiRoot = "src/pages/api";
  const routes = readdirSync(apiRoot, { recursive: true })
    .filter((file) => file.endsWith(".ts"))
    .map(
      (file) =>
        `/api/${file.replace(/\.ts$/, "").replace(/\[[^\]]+\]/g, "runtime-smoke")}`,
    );
  assert.ok(routes.length > 0, "No API routes found");
  const tickets = readFileSync(
    ".vercel/output/static/tickets/index.html",
    "utf8",
  );
  const ticketLinks = [
    ...new Set(
      [...tickets.matchAll(/href="(\/api\/go\/[^"?]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  // WHY: loading the artifact inside the checkout can silently resolve missing
  // dependencies from the development node_modules and hide deployment failures.
  const isolated = mkdtempSync(join(tmpdir(), "gmd-server-runtime-"));
  try {
    cpSync(artifact, isolated, { recursive: true, dereference: true });
    const child = spawnSync(process.execPath, [script, "--worker", isolated], {
      cwd: isolated,
      env: { NODE_ENV: "production" },
      input: JSON.stringify({ routes, ticketLinks }),
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (child.stdout) process.stdout.write(child.stdout);
    if (child.stderr) process.stderr.write(child.stderr);
    if (child.error) throw child.error;
    assert.equal(child.status, 0, "Packaged server runtime check failed");
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }
}
