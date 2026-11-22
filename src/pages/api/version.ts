import type { APIRoute } from "astro";
export const prerender = false;
/**
 * Which build is live: the git commit and the published show list version
 * it rendered (issue 337). The admin Shows tab polls this to tell "live" from
 * "rebuilding", and the synthetic monitor uses it the same way (plan R10).
 */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      commit: import.meta.env.BUILD_COMMIT_SHA,
      eventsVersion: import.meta.env.BUILD_EVENTS_VERSION,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
