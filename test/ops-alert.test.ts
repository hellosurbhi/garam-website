import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateEmail } from "@/utils/validateEmail";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/zohoMailer", () => ({ sendMail: mockSend }));

const { alertOps, redactEmails } = await import("@/lib/opsAlert");

const WEBHOOK = "https://ntfy.sh/gmd-alerts";

// The real shape of a cron page: applicant addresses are interpolated into the
// failure summary (src/pages/api/cron/post-show.ts, followups.ts).
const CRON_SUMMARY =
  "2 failures in this run:\npost-show email to priya@example.com: SMTP 535\n" +
  "host briefing email to host@garammasaladating.com: SMTP 535";

const pushes: { url: string; init: RequestInit }[] = [];

function lastPushBody(): string {
  expect(pushes).toHaveLength(1);
  return String(pushes[0].init.body);
}

describe("alertOps push webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushes.length = 0;
    mockSend.mockResolvedValue(undefined);
    import.meta.env.NOTIFICATION_EMAIL = "admin@example.com";
    import.meta.env.ALERT_WEBHOOK_URL = WEBHOOK;
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      url: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      pushes.push({ url: String(url), init: init ?? {} });
      return new Response("ok");
    }) as typeof fetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.NOTIFICATION_EMAIL;
    delete import.meta.env.ALERT_WEBHOOK_URL;
  });

  it("strips email addresses from the body (ntfy topics are effectively public)", async () => {
    await alertOps({
      flow: "ops",
      stage: "cron_post_show",
      errorMessage: CRON_SUMMARY,
    });
    const body = lastPushBody();
    expect(body).not.toContain("priya@example.com");
    expect(body).not.toContain("host@garammasaladating.com");
    expect(body).toContain("[email redacted]");
    // The diagnosis itself survives; only the identity is removed.
    expect(body).toContain("SMTP 535");
    expect(body).toContain("Failure in ops/cron_post_show");
  });

  it("keeps the unredacted message on the private email channel", async () => {
    await alertOps({
      flow: "ops",
      stage: "cron_post_show",
      errorMessage: CRON_SUMMARY,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain("priya@example.com");
  });

  it("redacts before the 2000-char bound, so a cut cannot leave half an address", async () => {
    await alertOps({
      flow: "ops",
      stage: "cron_followups",
      errorMessage: `${"x".repeat(1990)}priya@example.com`,
    });
    expect(lastPushBody()).not.toContain("@");
  });

  // The redactor has to cover every address the app ACCEPTS, not every address
  // that is conventionally formed: validateEmail.ts allows any non-space,
  // non-@ character in the local part, so these all reach a cron summary.
  it.each([
    "priya!@example.com",
    "priya's.test@example.co.uk",
    "priya#tag@mail.example.com",
    "priya(x)@example.com",
    // Domain shapes the validator accepts because its dot is inside a class
    // that also allows dots: a doubled dot, and a dot in first position.
    "priya@exa..mple.com",
    "priya@.example.com",
  ])("redacts %s, which the apply form accepts", async (address) => {
    await alertOps({
      flow: "ops",
      stage: "cron_followups",
      errorMessage: `post-show email to ${address}: SMTP 535`,
    });
    const body = lastPushBody();
    expect(body).not.toContain(address);
    // Nothing address-shaped survives at all, domain included.
    expect(body).not.toContain("@");
    expect(body).toContain("[email redacted]");
    expect(body).toContain("SMTP 535");
  });

  // `errorMessage` is whatever a caught exception carried, so the redactor
  // caps its input before scanning it. That cap must not become the same
  // half-address trap the truncation ordering avoids.
  it("drops the token its input ceiling cuts through, rather than publishing half an address", async () => {
    // 73 chars each, so the 8000-char ceiling lands 5 chars past an `@`. Sized
    // so redaction shrinks the 108 whole addresses before it to roughly 1900
    // chars: the fragment would sit inside the 2000-char body if it survived.
    const address = `${"a".repeat(60)}@example.com `;
    await alertOps({
      flow: "ops",
      stage: "cron_followups",
      errorMessage: `${"s".repeat(50)} ${address.repeat(110)}`,
    });
    const body = lastPushBody();
    expect(body).toContain("[email redacted]");
    expect(body).not.toContain("@");
  });

  // The real shape this misses: a transport error naming several rejected
  // recipients at once. A pattern that stopped after one `@` pair swallowed the
  // separator and the second local part with it, publishing a bare `@d.co`.
  it("redacts adjacent addresses joined with no space, not just the first", async () => {
    await alertOps({
      flow: "ops",
      stage: "cron_followups",
      errorMessage:
        "550 invalid recipients: priya@example.com,raj@other.example: SMTP 553",
    });
    const body = lastPushBody();
    expect(body).not.toContain("@");
    expect(body).not.toContain("priya");
    expect(body).not.toContain("raj");
    // Not even the second address's domain half.
    expect(body).not.toContain("other.example");
    expect(body).toContain("[email redacted]");
    expect(body).toContain("SMTP 553");
  });

  it("leaves error text with no address untouched", async () => {
    await alertOps({
      flow: "apply",
      stage: "submit",
      errorMessage: "storage/unauthorized on photos/x.jpeg",
    });
    const body = lastPushBody();
    expect(body).toContain("storage/unauthorized on photos/x.jpeg");
    expect(body).not.toContain("redacted");
  });

  it("never sends context entries over the webhook", async () => {
    await alertOps({
      flow: "apply",
      stage: "submit",
      errorMessage: "firestore write failed",
      context: { name: "Priya Sharma", phone: "+1 555 0100" },
    });
    const body = lastPushBody();
    expect(body).not.toContain("Priya Sharma");
    expect(body).not.toContain("555 0100");
  });
});

// The redactor's contract is not "matches an email address", it is "covers
// everything the front door LET IN": whatever validateEmail accepts can be
// stored, then interpolated into a cron failure summary, then published to a
// topic anyone can subscribe to. The two patterns drifted twice, once on the
// local part and once on the domain, both times in the direction that publishes
// the whole address.
//
// So this is not a list of addresses someone thought of. A remembered table
// proves only that the addresses in it are covered, and a table is exactly what
// stops being updated when the validator moves, which is the drift that already
// happened twice. These sweeps ENUMERATE the input space instead: every string
// up to a length over a small alphabet, plus every interesting character in
// every structural position of an address. Each candidate is run through the
// real validateEmail first, and only the ones it ACCEPTS are required to
// disappear. Loosen the front door in any way these sweeps can express and the
// suite fails here, without anyone having to remember to add a row.

/** Every string over `alphabet` from length 1 to `maxLength`, in order. */
function* everyStringUpTo(
  alphabet: string[],
  maxLength: number,
): Generator<string> {
  let current = [""];
  for (let length = 1; length <= maxLength; length++) {
    const next: string[] = [];
    for (const prefix of current) {
      for (const character of alphabet) next.push(prefix + character);
    }
    yield* next;
    current = next;
  }
}

/**
 * Structural sweeps. `a` stands for any ordinary character, and the rest are
 * the characters the grammar actually turns on: `@` (how many, and where), `.`
 * (the validator's one requirement, and the doubled/leading/trailing dots its
 * character class quietly allows), and a space (which both the validator's
 * `trim()` and the redactor's `\s` treat as a boundary). 9,840 and 21,844
 * candidates, a few milliseconds.
 */
const STRUCTURE_SWEEPS = [
  { alphabet: ["a", "@", "."], maxLength: 8 },
  { alphabet: ["a", "@", ".", " "], maxLength: 7 },
];

/**
 * Character sweep: printable ASCII, plus whitespace, non-ASCII and lookalike
 * characters that a character class can disagree about. Each one is dropped
 * into every structural position of an address, so the redactor's classes are
 * checked against the validator's per character rather than per example.
 */
const CHARACTERS = [
  ...Array.from({ length: 94 }, (_, index) => String.fromCharCode(33 + index)),
  " ",
  "\t",
  "\n",
  " ", // non-breaking space: `\s` and `trim()` both count it
  "é",
  "🌶",
  "．", // fullwidth full stop: looks like a dot, is not one
];

const POSITIONS = [
  (character: string) => `${character}@example.com`,
  (character: string) => `pri${character}ya@example.com`,
  (character: string) => `priya${character}@example.com`,
  (character: string) => `priya@${character}example.com`,
  (character: string) => `priya@exam${character}ple.com`,
  (character: string) => `priya@example.com${character}`,
  (character: string) => `priya@${character}`,
];

function* everyCandidate(): Generator<string> {
  for (const { alphabet, maxLength } of STRUCTURE_SWEEPS) {
    yield* everyStringUpTo(alphabet, maxLength);
  }
  for (const character of CHARACTERS) {
    for (const position of POSITIONS) yield position(character);
  }
}

describe("redactEmails covers the whole validateEmail grammar", () => {
  it("redacts every address the front door accepts, swept over the grammar", () => {
    const survived: string[] = [];
    let accepted = 0;

    for (const candidate of everyCandidate()) {
      // Only what the apply form and capture-lead API let through can ever
      // reach a cron summary, so only that has to be redacted here.
      if (validateEmail(candidate) !== undefined) continue;
      accepted++;
      const redacted = redactEmails(
        `post-show email to ${candidate}: SMTP 535`,
      );
      // Not even the domain half: a bare domain still names the person on a
      // personal address, and a partial match is what both misses looked like.
      if (redacted.includes("@") || !redacted.includes("[email redacted]")) {
        survived.push(JSON.stringify(candidate));
      }
    }

    // Guards the sweep itself: a validator or a generator that accepted nothing
    // would make the assertion below pass while proving nothing. The
    // ["a", "@", "."] sweep alone accepts 576 candidates.
    expect(accepted).toBeGreaterThan(500);
    expect(
      survived.slice(0, 20),
      "validateEmail now accepts an address shape EMAIL_ADDRESS in src/lib/opsAlert.ts does not match, so that address goes out whole on the public alert topic; widen the redactor, never narrow the sweep",
    ).toEqual([]);
  });

  // The sweep above feeds one address at a time, so it cannot see the class of
  // miss that lives BETWEEN addresses: the runs in the pattern are greedy and
  // cannot cross an `@`, so a pattern that stopped after one `@` pair matched
  // through the separator and the second address's local part, then stopped,
  // leaving a bare `@domain` in the public body. Composition needs its own
  // sweep for the same reason single addresses do: the separator is chosen by
  // whatever exception text the caller caught, not by us, so every character
  // above is tried as the join rather than the comma someone thought of.
  const ADJACENCY_SAMPLE_SIZE = 24;

  /**
   * What "nothing survived" means once two addresses can be joined by an `@`.
   * A leftover `@` on its own is not a leak and never was: the redactor
   * deliberately leaves `@garammasaladating` alone, and a join like
   * `a@a.a @ a@a.a` leaves that lone `@` between the two redactions. What must
   * never survive is an `@` still ATTACHED to text, which is exactly the
   * beheaded-address shape this test exists for (`[email redacted]@d.co`). So
   * the placeholder is blanked out first, and then any `@` with a non-space
   * neighbour is the failure.
   */
  function addressFragmentSurvives(redacted: string): boolean {
    const withoutPlaceholders = redacted.split("[email redacted]").join(" ");
    return /[^\s@]@|@[^\s@]/.test(withoutPlaceholders);
  }

  it("redacts both addresses when two sit adjacent, whatever character joins them", () => {
    const accepted = [...everyCandidate()].filter(
      (candidate) => validateEmail(candidate) === undefined,
    );
    // Evenly spaced across the accepted set rather than the first N, so the
    // pairs come from both structural sweeps and the per-character positions
    // instead of one corner of the first alphabet.
    const step = Math.max(
      1,
      Math.floor(accepted.length / ADJACENCY_SAMPLE_SIZE),
    );
    const sample = accepted
      .filter((_, index) => index % step === 0)
      .slice(0, ADJACENCY_SAMPLE_SIZE);
    expect(sample).toHaveLength(ADJACENCY_SAMPLE_SIZE);

    const survived: string[] = [];
    for (const left of sample) {
      for (const right of sample) {
        // The empty join too: nothing says a caught exception separates them.
        for (const join of ["", ...CHARACTERS]) {
          const pair = `${left}${join}${right}`;
          const redacted = redactEmails(
            `invalid recipients: ${pair}: SMTP 553`,
          );
          if (addressFragmentSurvives(redacted)) {
            survived.push(JSON.stringify(pair));
          }
        }
      }
    }

    expect(
      survived.slice(0, 20),
      "two addresses the front door accepts, joined by one character, left address text attached to an `@`: the greedy run reached past the separator into the next local part and stopped there, so the trailing address goes out on the public alert topic with only its local part removed",
    ).toEqual([]);
  });

  it("keeps the diagnosis while removing the identity", () => {
    const redacted = redactEmails(
      "post-show email to priya@example.com: SMTP 535",
    );
    expect(redacted).toBe("post-show email to [email redacted] SMTP 535");
  });

  it("leaves a bare @handle alone, since an address needs a local part", () => {
    // The apply success copy and several alert bodies name the Instagram
    // handle; over-redaction is the safe direction but not a licence to eat
    // every @ in the message.
    const text = "applicant asked to DM photos to @garammasaladating";
    expect(redactEmails(text)).toBe(text);
  });
});
