function loadPostHog() {
  var path = window.location.pathname;
  if (path.startsWith("/admin") || path.startsWith("/contestant-prep")) return;
  if (["localhost", "127.0.0.1"].indexOf(window.location.hostname) !== -1)
    return;

  window.__garamErrorQueue = window.__garamErrorQueue || [];

  // WHY: Instagram/Facebook in-app browsers inject their own scripts into
  // every page and those scripts crash constantly ("window.webkit
  // .messageHandlers" on iOS, "Java object is gone" on Android). They are
  // injected INLINE, so event.filename is the page URL, not a foreign origin:
  // an origin check cannot catch them, only these signatures can. In July
  // 2026 this noise made up 80% of tracked "site" errors and buried a real
  // apply-form outage for a week. Matches are still captured (as
  // third_party_error) so the data exists, but they must never pollute
  // first-party issues or alerts. The shader's "WebGL not supported" is that
  // asset's intentional no-WebGL fallback (it hides the canvas), not a bug.
  function classifyErrorEvent(message, filename, stack) {
    var msg = String(message || "");
    var file = String(filename || "");
    if (msg.indexOf("window.webkit.messageHandlers") !== -1)
      return "third_party_error";
    if (msg.indexOf("Java object is gone") !== -1) return "third_party_error";
    if (file.indexOf("iabjs://") === 0) return "third_party_error";
    if (msg.indexOf("Script error") === 0 && !stack)
      return "third_party_error";
    if (msg.indexOf("WebGL not supported") !== -1) return "third_party_error";
    return "client_error";
  }

  function captureError(eventName, props) {
    if (window.posthog && window.posthog.capture) {
      window.posthog.capture(eventName, props);
    } else {
      window.__garamErrorQueue.push({ event: eventName, properties: props });
    }
  }

  window.addEventListener("error", function (event) {
    var stack = event.error ? String(event.error.stack || "").slice(0, 2000) : "";
    var props = {
      error_message: event.message || "Unknown error",
      error_stack: stack,
      error_type: "uncaught",
      error_filename: event.filename || "",
      error_lineno: event.lineno || 0,
      error_colno: event.colno || 0,
      page_url: window.location.href,
    };
    captureError(classifyErrorEvent(event.message, event.filename, stack), props);
  });

  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    var message =
      reason instanceof Error
        ? reason.message
        : String(reason || "Unknown rejection");
    var stack =
      reason instanceof Error ? String(reason.stack || "").slice(0, 2000) : "";
    var props = {
      error_message: message,
      error_stack: stack,
      error_type: "unhandled_rejection",
      page_url: window.location.href,
    };
    captureError(classifyErrorEvent(message, "", stack), props);
  });

  window.__garamAnalytics = window.__garamAnalytics || {};
  if (window.__garamAnalytics.posthog) return;
  window.__garamAnalytics.posthog = true;
  !(function (t, e) {
    var o, n, p, r;
    e.__SV ||
      ((window.posthog = e),
      (e._i = []),
      (e.init = function (i, s, a) {
        function g(t, e) {
          var o = e.split(".");
          2 == o.length && ((t = t[o[0]]), (e = o[1]));
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }
        (p = t.createElement("script")).type = "text/javascript";
        p.async = !0;
        p.src =
          s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") +
          "/static/array.js";
        (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
        var u = e;
        void 0 !== a ? (u = e[a] = []) : (a = "posthog");
        u.people = u.people || [];
        u.toString = function (t) {
          var e = "posthog";
          "posthog" !== a && (e += "." + a);
          t || (e += " (stub)");
          return e;
        };
        u.people.toString = function () {
          return u.toString(1) + ".people (stub)";
        };
        o =
          "init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(
            " ",
          );
        for (n = 0; n < o.length; n++) g(u, o[n]);
        e._i.push([i, s, a]);
      }),
      (e.__SV = 1));
  })(document, window.posthog || []);
  posthog.init("phc_qqPeeEMxGcVmknbpgvkgbNUbMEaBMQu2fXWyPV6kAmxD", {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    capture_dead_clicks: true,
    enable_heatmaps: true,
    capture_performance: { network_timing: true },
    session_recording: { maskTextSelector: ".ph-mask" },
    autocapture: { capture_copied_text: true },
    custom_campaign_params: ["source"],
  });

  var queue = window.__garamErrorQueue || [];
  for (var i = 0; i < queue.length; i++) {
    posthog.capture(queue[i].event, queue[i].properties);
  }
  window.__garamErrorQueue = [];

  var eventQueue = window.__garamEventQueue || [];
  for (var j = 0; j < eventQueue.length; j++) {
    posthog.capture(eventQueue[j].event, eventQueue[j].properties);
  }
  window.__garamEventQueue = [];
}
if ("requestIdleCallback" in window) {
  requestIdleCallback(loadPostHog, { timeout: 3000 });
} else {
  setTimeout(loadPostHog, 2000);
}
