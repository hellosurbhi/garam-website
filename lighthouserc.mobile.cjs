module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist/client",
      startServerCommand:
        "node tests/smoke/static-preview.mjs 4321 dist/client",
      startServerReadyPattern: "Static preview serving",
      url: [
        "http://localhost:4321/",
        "http://localhost:4321/tickets",
        "http://localhost:4321/links",
        "http://localhost:4321/apply",
        "http://localhost:4321/cities/san-francisco",
        "http://localhost:4321/cities/los-angeles",
        "http://localhost:4321/journal/best-indian-dating-apps-ranked",
      ],
      numberOfRuns: 1,
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 3,
          disabled: false,
        },
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
        throttlingMethod: "simulate",
        skipAudits: ["uses-http2", "uses-long-cache-ttl"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.75 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./reports/lighthouse-mobile",
    },
  },
};
