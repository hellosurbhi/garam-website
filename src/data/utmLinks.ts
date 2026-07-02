export type UtmChannel =
  | "instagram_bio"
  | "instagram_story"
  | "instagram_reel"
  | "manychat"
  | "email"
  | "partner"
  | "venue"
  | "press";

export interface CanonicalUtmLink {
  label: string;
  path: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
}

export function withCanonicalUtms(link: CanonicalUtmLink): string {
  const params = new URLSearchParams({
    utm_source: link.utm_source,
    utm_medium: link.utm_medium,
    utm_campaign: link.utm_campaign,
    utm_content: link.utm_content,
  });
  return `${link.path}?${params.toString()}`;
}

export const CANONICAL_UTM_LINKS: Record<UtmChannel, CanonicalUtmLink[]> = {
  instagram_bio: [
    {
      label: "Instagram bio tickets",
      path: "/tickets",
      utm_source: "ig",
      utm_medium: "social",
      utm_campaign: "ticket_sales",
      utm_content: "bio",
    },
    {
      label: "Instagram bio apply",
      path: "/apply",
      utm_source: "ig",
      utm_medium: "social",
      utm_campaign: "casting",
      utm_content: "bio",
    },
  ],
  instagram_story: [
    {
      label: "Instagram story San Francisco",
      path: "/cities/san-francisco",
      utm_source: "ig",
      utm_medium: "social",
      utm_campaign: "sf_show",
      utm_content: "story",
    },
    {
      label: "Instagram story tickets",
      path: "/tickets",
      utm_source: "ig",
      utm_medium: "social",
      utm_campaign: "ticket_sales",
      utm_content: "story",
    },
  ],
  instagram_reel: [
    {
      label: "Instagram reel caption tickets",
      path: "/tickets",
      utm_source: "ig",
      utm_medium: "social",
      utm_campaign: "ticket_sales",
      utm_content: "reel_caption",
    },
  ],
  manychat: [
    {
      label: "ManyChat tickets",
      path: "/tickets",
      utm_source: "manychat",
      utm_medium: "dm",
      utm_campaign: "ticket_sales",
      utm_content: "automation",
    },
    {
      label: "ManyChat apply",
      path: "/apply",
      utm_source: "manychat",
      utm_medium: "dm",
      utm_campaign: "casting",
      utm_content: "automation",
    },
  ],
  email: [
    {
      label: "Email tickets",
      path: "/tickets",
      utm_source: "email",
      utm_medium: "newsletter",
      utm_campaign: "ticket_sales",
      utm_content: "primary_cta",
    },
  ],
  partner: [
    {
      label: "Partner tickets",
      path: "/tickets",
      utm_source: "partner",
      utm_medium: "referral",
      utm_campaign: "ticket_sales",
      utm_content: "partner_link",
    },
  ],
  venue: [
    {
      label: "Venue tickets",
      path: "/tickets",
      utm_source: "venue",
      utm_medium: "referral",
      utm_campaign: "ticket_sales",
      utm_content: "venue_link",
    },
  ],
  press: [
    {
      label: "Press tickets",
      path: "/tickets",
      utm_source: "press",
      utm_medium: "referral",
      utm_campaign: "ticket_sales",
      utm_content: "article_link",
    },
  ],
};

export const CANONICAL_UTM_URLS = Object.fromEntries(
  Object.entries(CANONICAL_UTM_LINKS).map(([channel, links]) => [
    channel,
    links.map(withCanonicalUtms),
  ]),
) as Record<UtmChannel, string[]>;
