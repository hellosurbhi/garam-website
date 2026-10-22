import { describe, it, expect, vi, beforeEach } from "vitest";

import { sendPagerEmail } from "./send-pager-email.mjs";

const env = {
  GMAIL_USER: "garammasaladating@gmail.com",
  GMAIL_CLIENT_ID: "client-id-123",
  GMAIL_CLIENT_SECRET: "client-secret-456",
  GMAIL_REFRESH_TOKEN: "refresh-token-789",
  RUN_URL: "https://github.com/o/r/actions/runs/1",
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

let mockFetch;

function decodeSentMessage() {
  const sendCall = mockFetch.mock.calls.find(([url]) => url === SEND_URL);
  const { raw } = JSON.parse(sendCall[1].body);
  return Buffer.from(raw, "base64url").toString("utf8");
}

describe("sendPagerEmail", () => {
  beforeEach(() => {
    mockFetch = vi.fn(async (url) => {
      if (url === TOKEN_URL) return jsonResponse(200, { access_token: "at-1" });
      if (url === SEND_URL) return jsonResponse(200, { id: "msg-1" });
      throw new Error(`unexpected fetch: ${url}`);
    });
  });

  it("rejects an unknown mode", async () => {
    await expect(sendPagerEmail("oops", env, mockFetch)).rejects.toThrow(
      "usage:",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fails loudly without any network call when secrets are missing", async () => {
    for (const missing of [
      "GMAIL_USER",
      "GMAIL_CLIENT_ID",
      "GMAIL_CLIENT_SECRET",
      "GMAIL_REFRESH_TOKEN",
    ]) {
      const partial = { ...env, [missing]: undefined };
      await expect(sendPagerEmail("page", partial, mockFetch)).rejects.toThrow(
        "secrets are not all set",
      );
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("never puts credential values in a validation error message", async () => {
    const err = await sendPagerEmail(
      "page",
      { ...env, GMAIL_USER: undefined },
      mockFetch,
    ).catch((e) => e);
    expect(String(err)).not.toContain(env.GMAIL_CLIENT_SECRET);
    expect(String(err)).not.toContain(env.GMAIL_REFRESH_TOKEN);
  });

  it("exchanges the refresh token with a form-encoded request carrying all OAuth params", async () => {
    await sendPagerEmail("page", env, mockFetch);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(TOKEN_URL);
    expect(init.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const params = new URLSearchParams(init.body);
    expect(params.get("client_id")).toBe(env.GMAIL_CLIENT_ID);
    expect(params.get("client_secret")).toBe(env.GMAIL_CLIENT_SECRET);
    expect(params.get("refresh_token")).toBe(env.GMAIL_REFRESH_TOKEN);
    expect(params.get("grant_type")).toBe("refresh_token");
  });

  it("sends base64url raw MIME with the bearer token from the exchange", async () => {
    await sendPagerEmail("page", env, mockFetch);
    const sendCall = mockFetch.mock.calls.find(([url]) => url === SEND_URL);
    expect(sendCall[1].headers.Authorization).toBe("Bearer at-1");
    const message = decodeSentMessage();
    expect(message).toContain(
      `From: "Garam Masala Dating pager" <${env.GMAIL_USER}>`,
    );
  });

  it("a failed token exchange throws without leaking the token and never calls send", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(400, {
        error: "invalid_grant",
        error_description: "Token has been expired or revoked.",
      }),
    );
    const err = await sendPagerEmail("page", env, mockFetch).catch((e) => e);
    expect(String(err)).toContain("HTTP 400");
    expect(String(err)).toContain("invalid_grant");
    expect(String(err)).not.toContain(env.GMAIL_REFRESH_TOKEN);
    expect(
      mockFetch.mock.calls.filter(([url]) => url === SEND_URL),
    ).toHaveLength(0);
  });

  it("a 2xx token response without an access token fails cleanly", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, {}));
    await expect(sendPagerEmail("page", env, mockFetch)).rejects.toThrow(
      "no access token",
    );
  });

  it("a failed send surfaces Gmail's nested error message", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url === TOKEN_URL) return jsonResponse(200, { access_token: "at-1" });
      return jsonResponse(403, {
        error: { message: "Request had insufficient authentication scopes." },
      });
    });
    const err = await sendPagerEmail("page", env, mockFetch).catch((e) => e);
    expect(String(err)).toContain("HTTP 403");
    expect(String(err)).toContain("insufficient authentication scopes");
  });

  it("sends to the Gmail user itself when PAGER_EMAIL_TO is unset", async () => {
    const { to } = await sendPagerEmail("page", env, mockFetch);
    expect(to).toBe(env.GMAIL_USER);
    expect(decodeSentMessage()).toContain(`To: ${env.GMAIL_USER}`);
  });

  it("sends to PAGER_EMAIL_TO when set", async () => {
    const { to } = await sendPagerEmail(
      "page",
      { ...env, PAGER_EMAIL_TO: "messagesurbhi@gmail.com" },
      mockFetch,
    );
    expect(to).toBe("messagesurbhi@gmail.com");
  });

  it("page mode names the outage and links the run", async () => {
    const { subject } = await sendPagerEmail("page", env, mockFetch);
    expect(subject).toContain("APPLY MONITOR FAILED");
    expect(decodeSentMessage()).toContain(env.RUN_URL);
  });

  it("test mode is unmistakably a drill", async () => {
    const { subject } = await sendPagerEmail("test", env, mockFetch);
    expect(subject).toContain("pager test");
    expect(subject).toContain("No action needed");
    expect(subject).not.toContain("FAILED");
  });

  it("both Google calls carry an abort timeout so a stalled endpoint fails fast", async () => {
    await sendPagerEmail("page", env, mockFetch);
    for (const [, init] of mockFetch.mock.calls) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
