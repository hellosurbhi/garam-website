import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Verify deployed alias hops preserve attribution without following ticket links or submitting forms. */
export async function checkEventRedirects(
  routes,
  {
    fetch: fetchImpl = fetch,
    origin = "https://garammasaladating.com",
    log = console.log,
  } = {},
) {
  const aliases = routes.filter(
    (route) =>
      route.status === 308 &&
      /^\/(events|api\/go)\//.test(route.headers?.Location ?? ""),
  );
  assert.ok(
    aliases.length > 0,
    "No generated event aliases found; build the site first",
  );
  const failures = [];
  const check = async (route) => {
    try {
      assert.match(route.src, /^\^\/(events|api\/go)\/[a-z0-9-]+\$$/);
      const source = new URL(route.src.slice(1, -1), origin);
      source.search = new URLSearchParams({
        utm_source: "redirect-smoke",
        utm_campaign: "city test",
        eid: "redirect-smoke-only",
      }).toString();
      const response = await fetchImpl(source, {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: { "user-agent": "Googlebot (read-only redirect smoke check)" },
      });
      assert.equal(
        response.status,
        308,
        `Alias did not redirect: ${source.pathname}`,
      );
      const location = response.headers.get("location");
      assert.ok(location, `Missing Location: ${source.pathname}`);
      const destination = new URL(location, source);
      assert.equal(destination.origin, source.origin);
      assert.equal(destination.pathname, route.headers.Location);
      for (const [key, value] of source.searchParams) {
        assert.equal(
          destination.searchParams.get(key),
          value,
          `Lost ${key} on ${source.pathname}`,
        );
      }
    } catch (error) {
      failures.push(
        `${route.src}: ${error instanceof Error ? error.message : "Redirect check failed"}`,
      );
    }
  };
  // Bound simultaneous requests while still visiting every alias after failures.
  for (let offset = 0; offset < aliases.length; offset += 4) {
    await Promise.all(aliases.slice(offset, offset + 4).map(check));
  }
  if (failures.length)
    throw new Error(`Redirect verification failed:\n${failures.join("\n")}`);
  log(
    `Verified ${aliases.length} live event aliases preserve tracking queries; no ticket destinations followed.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const config = JSON.parse(
      readFileSync(".vercel/output/config.json", "utf8"),
    );
    await checkEventRedirects(config.routes);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Redirect check failed",
    );
    process.exitCode = 1;
  }
}
