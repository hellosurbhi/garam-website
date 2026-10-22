/**
 * Recognizes the link-preview/unfurl bots and crawlers that are expected to
 * fetch tracked links directly (see rateLimit.ts's `goRedirect` policy
 * comment): when someone shares a `/api/go/[slug]` ad or ticket link in
 * Slack, iMessage, WhatsApp, Telegram, Discord, or X, that platform's server
 * headlessly fetches the URL to build a preview card before any human ever
 * clicks it. None of these carry real purchase intent, so they must never
 * be reported to Meta as a conversion (InitiateCheckout) or they train the
 * ad algorithm to optimize toward bots instead of buyers.
 *
 * This is a denylist of known User-Agent substrings, not a security
 * boundary: it cannot catch every crawler and a motivated bot can always
 * spoof a browser UA. That's fine here, the goal is filtering out the
 * specific, well-known unfurl bots that legitimately and routinely hit this
 * route, not blocking traffic.
 */
const BOT_USER_AGENT_PATTERNS = [
  /facebookexternalhit/i,
  /facebookcatalog/i,
  /Meta-ExternalAgent/i,
  /Slackbot/i,
  /TelegramBot/i,
  /WhatsApp/i,
  /Twitterbot/i,
  /Discordbot/i,
  /LinkedInBot/i,
  /Googlebot/i,
  /bingbot/i,
  /AppleBot/i,
  /iMessageLinkPresentation/i,
  /Applebot/i,
  /SkypeUriPreview/i,
  /redditbot/i,
  /Pinterestbot/i,
  /vkShare/i,
  /W3C_Validator/i,
];

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}
