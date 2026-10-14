import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { connectMailbox } from "./gmail";
const config = {
  address: "show@gmail.com",
  clientId: "test-client",
  clientSecret: "test-secret",
  refreshToken: "test-refresh",
};
const mail = {
  to: "reader@example.org",
  subject: "Chicago\nBcc: attacker@example.org",
  body: "A show",
  unsubscribe: "https://example.org/unsubscribe",
  id: "delivery-id",
};
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());
function identity(address = "show@gmail.com") {
  request.mockResolvedValueOnce(Response.json({ access_token: "test-access" }));
  request.mockResolvedValueOnce(Response.json({ email: address }));
}
it("refuses a token belonging to another mailbox", async () => {
  identity("wrong@gmail.com");
  await expect(connectMailbox(config)).rejects.toThrow("does not match");
  expect(request).toHaveBeenCalledTimes(2);
});
it("records Gmail's message id and encodes the entire subject as one header", async () => {
  identity();
  request.mockResolvedValueOnce(Response.json({ id: "provider-message" }));
  const mailbox = await connectMailbox(config);
  expect(await mailbox.send(mail)).toEqual({
    status: "sent",
    messageId: "provider-message",
  });
  const body = JSON.parse(String(request.mock.calls[2][1]?.body));
  const message = Buffer.from(body.raw, "base64url").toString();
  expect(message).toContain(
    "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
  );
  expect(message).not.toContain("\nBcc:");
});
it("does not retry when Gmail may have accepted the message", async () => {
  identity();
  request.mockRejectedValueOnce(new Error("connection lost"));
  expect(await (await connectMailbox(config)).send(mail)).toEqual({
    status: "uncertain",
  });
  expect(request).toHaveBeenCalledTimes(3);
});
it("defers confirmed rate-limit rejection", async () => {
  identity();
  request.mockResolvedValueOnce(new Response("limited", { status: 429 }));
  expect(await (await connectMailbox(config)).send(mail)).toMatchObject({
    status: "deferred",
  });
});
