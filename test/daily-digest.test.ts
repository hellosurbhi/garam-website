import { describe, it, expect } from "vitest";
import {
  buildDailyDigest,
  digestDateKey,
  digestHtml,
  type DigestInput,
  type Row,
} from "@/lib/dailyDigest";
import {
  applicantHandle,
  applicantName,
  applicantSummary,
  UNNAMED_APPLICANT,
} from "@/utils/applicantDisplay";
import type { Application } from "@/types/application";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-10T12:00:00Z");
const SINCE = new Date(NOW.getTime() - DAY);

function at(msAgo: number): string {
  return new Date(NOW.getTime() - msAgo).toISOString();
}

function build(over: Partial<DigestInput> = {}) {
  return buildDailyDigest({
    now: NOW,
    since: SINCE,
    leads: [],
    applications: [],
    incidents: [],
    dirtyEnvNames: [],
    ...over,
  });
}

/** `perDay` live apps in each of the 7 days before the window, half finished. */
function weekOfApps(perDay: number): Row[] {
  const rows: Row[] = [];
  for (let d = 1; d <= 7; d++) {
    for (let i = 0; i < perDay; i++) {
      rows.push({
        name: `w${d}-${i}`,
        status: i % 2 === 0 ? "New" : "Draft",
        submittedAt: at(DAY + d * DAY - DAY / 2),
        photoPaths: ["p"],
        clientVersion: 2,
      });
    }
  }
  return rows;
}

describe("daily digest: quiet day", () => {
  it("is a calm one-liner with no ATTENTION when nothing is wrong", () => {
    const d = build();
    expect(d.subject).toBe(
      "Garam daily: 0 signups, 0 applications, 0 problems",
    );
    expect(d.warnings).toEqual([]);
    expect(d.text).toContain("None in this window.");
    expect(d.text).toContain("Database login and mail send worked");
  });

  it("counts and lists signups and applications in the window only", () => {
    const d = build({
      leads: [
        { email: "a@x.com", city: "NYC", createdAt: at(DAY / 2) },
        { email: "old@x.com", createdAt: at(3 * DAY) },
      ],
      applications: [
        {
          name: "Priya",
          email: "p@x.com",
          status: "New",
          submittedAt: at(DAY / 4),
          photoPaths: ["p"],
          clientVersion: 2,
        },
      ],
    });
    expect(d.subject).toBe("Garam daily: 1 signup, 1 application, 0 problems");
    expect(d.text).toContain("a@x.com | NYC");
    expect(d.text).not.toContain("old@x.com");
    expect(d.text).toContain("Priya | finished | p@x.com");
  });

  it("excludes deleted and synthetic rows", () => {
    const d = build({
      applications: [
        { name: "Gone", status: "New", submittedAt: at(1000), deletedAt: "x" },
        {
          name: "Fake",
          status: "New",
          submittedAt: at(1000),
          isSynthetic: true,
        },
      ],
    });
    expect(d.subject).toContain("0 applications");
  });

  it("shows unfinished drafts with their contact so they can be followed up", () => {
    const d = build({
      applications: [
        {
          name: "Half",
          phone: "555-1",
          status: "Draft",
          submittedAt: at(1000),
          clientVersion: 2,
        },
      ],
    });
    expect(d.subject).toContain("1 application (1 unfinished)");
    expect(d.text).toContain("Half | UNFINISHED | 555-1");
  });

  it("says 'no contact left' for a draft with no way to reach the person", () => {
    const d = build({
      applications: [
        {
          name: "Ghost",
          status: "Draft",
          submittedAt: at(1000),
          clientVersion: 2,
        },
      ],
    });
    expect(d.text).toContain("no contact left");
  });
});

describe("daily digest: finished applications", () => {
  it("lists an application finished today even though it was started before the window", () => {
    const d = build({
      applications: [
        {
          name: "Late Finisher",
          status: "New",
          submittedAt: at(3 * DAY),
          finalizedAt: at(DAY / 4),
          photoPaths: ["p"],
          clientVersion: 2,
        },
      ],
    });
    expect(d.subject).toContain("1 application");
    expect(d.text).toContain("Late Finisher");
  });

  it("does not list it again the day after it was finished", () => {
    const d = build({
      applications: [
        {
          name: "Yesterday Finisher",
          status: "New",
          submittedAt: at(3 * DAY),
          finalizedAt: at(2 * DAY),
          photoPaths: ["p"],
          clientVersion: 2,
        },
      ],
    });
    expect(d.text).not.toContain("Yesterday Finisher");
  });
});

describe("daily digest: tripwires", () => {
  it("warns when applications started collapse versus the trailing week", () => {
    const d = build({ applications: weekOfApps(8) });
    expect(d.warnings.join("\n")).toMatch(/Applications started dropped to 0/);
    expect(d.subject.startsWith("ATTENTION ")).toBe(true);
  });

  it("does not let applications started earlier and finished today hide a dead form", () => {
    const apps = weekOfApps(8);
    for (let i = 0; i < 5; i++) {
      apps.push({
        name: `old${i}`,
        status: "New",
        submittedAt: at(3 * DAY),
        finalizedAt: at(DAY / 3),
        photoPaths: ["p"],
        clientVersion: 2,
      });
    }
    const d = build({ applications: apps });
    expect(d.warnings.join("\n")).toMatch(/Applications started dropped to 0/);
  });

  it("does not count the weekly monitor test alert as a failure", () => {
    const d = build({
      incidents: [
        {
          createdAt: at(1000),
          flow: "ops",
          stage: "monitor_heartbeat",
          errorMessage: "Labelled monitoring notification test.",
        },
      ],
    });
    expect(d.warnings).toEqual([]);
    expect(d.subject).not.toContain("ATTENTION");
    expect(d.subject).toContain("0 problems");
  });

  it("warns when drafts flow but none are finished", () => {
    const apps = weekOfApps(8);
    for (let i = 0; i < 6; i++) {
      apps.push({
        name: `d${i}`,
        status: "Draft",
        submittedAt: at(DAY / 3),
        clientVersion: 2,
      });
    }
    const d = build({ applications: apps });
    expect(d.warnings.join("\n")).toMatch(/Zero applications were finished/);
  });

  it("does not cry wolf on a genuinely slow week", () => {
    const d = build({ applications: weekOfApps(1) });
    expect(d.warnings).toEqual([]);
  });

  it("names every finished application that arrived with no photos", () => {
    const d = build({
      applications: [
        {
          name: "NoPics",
          status: "New",
          submittedAt: at(1000),
          photoPaths: [],
          clientVersion: 2,
        },
        {
          name: "Pics",
          status: "New",
          submittedAt: at(1000),
          photoPaths: ["a"],
          clientVersion: 2,
        },
      ],
    });
    expect(d.warnings.join("\n")).toContain(
      "1 finished application arrived with no photos: NoPics",
    );
  });

  it("reports env vars with a stray newline or space by name", () => {
    const d = build({ dirtyEnvNames: ["CRON_SECRET", "NOTIFICATION_EMAIL"] });
    expect(d.warnings.join("\n")).toContain("CRON_SECRET, NOTIFICATION_EMAIL");
  });

  it("lists failure alerts with subject and the first line of the raw error only", () => {
    const d = build({
      incidents: [
        {
          createdAt: at(1000),
          subject: "APPLY FAILED: finalize: deadline exceeded",
          errorMessage: "deadline exceeded\nstack line 2\nstack line 3",
        },
        { createdAt: at(5 * DAY), subject: "old", errorMessage: "old" },
      ],
    });
    expect(d.subject).toContain("1 problem");
    expect(d.text).toContain("FAILURE ALERTS (1)");
    expect(d.text).toContain(
      "APPLY FAILED: finalize: deadline exceeded: deadline exceeded",
    );
    expect(d.text).not.toContain("stack line 2");
    expect(d.text).not.toContain("old: old");
  });

  it("counts old-client writes so the rules lockdown has a real gate", () => {
    const d = build({
      applications: [
        {
          name: "Legacy",
          status: "New",
          submittedAt: at(1000),
          photoPaths: ["p"],
        },
        {
          name: "Modern",
          status: "New",
          submittedAt: at(1000),
          photoPaths: ["p"],
          clientVersion: 2,
        },
      ],
    });
    expect(d.text).toContain(
      "old cached tabs: 1 (the owner deploys the lockdown rules only after",
    );
    const clean = build({
      applications: [
        {
          name: "Modern",
          status: "New",
          submittedAt: at(1000),
          photoPaths: ["p"],
          clientVersion: 2,
        },
      ],
    });
    expect(clean.text).toContain("old cached tabs: 0");
    expect(clean.text).not.toContain("lockdown waits");
  });

  it("flags under 18 applicants in the list and the health line", () => {
    const d = build({
      applications: [
        {
          name: "Kid",
          status: "New",
          submittedAt: at(1000),
          photoPaths: ["p"],
          ageUnder18: true,
          clientVersion: 2,
        },
      ],
    });
    expect(d.text).toContain("Kid | finished");
    expect(d.text).toContain("| UNDER 18");
    expect(d.text).toContain("Under 18 flagged: 1");
  });

  it("survives garbage rows (missing and mistyped fields) without throwing", () => {
    expect(() =>
      build({
        leads: [{}, { createdAt: 5 }, { createdAt: "not a date" }],
        applications: [{ submittedAt: at(10), name: 7 as unknown as string }],
        incidents: [{ createdAt: at(10) }],
      }),
    ).not.toThrow();
  });
});

describe("digest helpers", () => {
  it("escapes html so an applicant name cannot inject markup into the email", () => {
    const html = digestHtml("- <script>x</script> & co");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keys the idempotency date to New York, not UTC", () => {
    expect(digestDateKey(new Date("2026-11-10T03:00:00Z"))).toBe("2026-11-09");
    expect(digestDateKey(new Date("2026-11-10T17:00:00Z"))).toBe("2026-11-10");
  });
});

describe("applicantDisplay: partial drafts never crash the dashboard", () => {
  const empty = {} as Application;

  it("names an unnamed draft", () => {
    expect(applicantName(empty)).toBe(UNNAMED_APPLICANT);
    expect(applicantName({ name: "   " } as Application)).toBe(
      UNNAMED_APPLICANT,
    );
    expect(applicantName({ name: " Priya " } as Application)).toBe("Priya");
  });

  it("summarizes only the pieces that exist", () => {
    expect(applicantSummary(empty)).toBe("");
    expect(
      applicantSummary({
        age: 29,
        gender: "Woman",
        city: "Brooklyn",
        state: "NY",
      } as Application),
    ).toBe("29 · Woman · Brooklyn, NY");
    expect(applicantSummary({ gender: "Man" } as Application)).toBe("Man");
  });

  it("marks under 18 visibly", () => {
    expect(applicantSummary({ age: 16, ageUnder18: true } as Application)).toBe(
      "16 · UNDER 18",
    );
  });

  it("handles a missing instagram and strips a leading @", () => {
    expect(applicantHandle(empty)).toBe("");
    expect(applicantHandle({ instagram: "@priya" } as Application)).toBe(
      "priya",
    );
  });
});
