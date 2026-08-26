import { describe, it, expect } from "vitest";
import { isBotUserAgent } from "@/lib/isBotUserAgent";

// The User-Agent strings these platforms send when someone shares a
// /api/go/[slug] link and the platform headlessly fetches it to build a
// preview card. Every one of them used to be reported to Meta as an
// InitiateCheckout before any human had seen the link.
const UNFURL_BOTS: [string, string][] = [
  [
    "Meta",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  ],
  ["Meta catalog", "facebookcatalog/1.0"],
  ["Meta agent", "meta-externalagent/1.1"],
  ["Slack", "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"],
  ["Telegram", "TelegramBot (like TwitterBot)"],
  ["WhatsApp", "WhatsApp/2.23.20.0 A"],
  ["X", "Twitterbot/1.0"],
  ["Discord", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.com)"],
  ["LinkedIn", "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient)"],
  [
    "Google",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ],
  [
    "Bing",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  ],
  [
    "Apple",
    "Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)",
  ],
  ["iMessage", "Mozilla/5.0 (Macintosh) iMessageLinkPresentation/1.0"],
  ["Skype", "SkypeUriPreview Preview/0.5"],
  ["Reddit", "redditbot/1.0 (+http://www.reddit.com/feedback)"],
  [
    "Pinterest",
    "Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)",
  ],
  ["VK", "vkShare; +http://vk.com/dev/Share"],
  ["W3C", "W3C_Validator/1.3"],
];

// Real browsers, one per engine family, that must always reach CAPI.
const HUMAN_BROWSERS: [string, string][] = [
  [
    "Chrome desktop",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  ],
  [
    "Safari iOS",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ],
  [
    "Firefox Android",
    "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  ],
  [
    "Edge desktop",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
  ],
];

describe("isBotUserAgent", () => {
  it.each(UNFURL_BOTS)("recognizes the %s unfurl bot", (_platform, ua) => {
    expect(isBotUserAgent(ua)).toBe(true);
  });

  it.each(HUMAN_BROWSERS)("clears %s", (_browser, ua) => {
    expect(isBotUserAgent(ua)).toBe(false);
  });

  // Matching is case-insensitive because platforms are inconsistent about
  // capitalization across versions.
  it("matches regardless of case", () => {
    expect(isBotUserAgent("SLACKBOT-LINKEXPANDING 1.0")).toBe(true);
    expect(isBotUserAgent("twitterbot/1.0")).toBe(true);
  });

  // A missing User-Agent is NOT treated as a bot: suppressing CAPI on absence
  // would silently drop real conversions from privacy tools that strip the
  // header, and this denylist is a filter, not a security boundary.
  it("does not treat a missing or empty User-Agent as a bot", () => {
    expect(isBotUserAgent(null)).toBe(false);
    expect(isBotUserAgent(undefined)).toBe(false);
    expect(isBotUserAgent("")).toBe(false);
  });
});
