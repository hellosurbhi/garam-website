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
        "http://localhost:4321/apply",
        "http://localhost:4321/journal",
      ],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        skipAudits: ["uses-http2", "uses-long-cache-ttl"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
