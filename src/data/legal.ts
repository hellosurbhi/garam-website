export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  id: "privacy" | "terms";
  title: string;
  lastUpdated: string;
  metaTitle: string;
  metaDescription: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: Record<"privacy" | "terms", LegalDocument> = {
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    lastUpdated: "April 2026",
    metaTitle: "Privacy Policy",
    metaDescription:
      "Privacy policy for Garam Masala Dating. How we collect, use, and protect your information.",
    sections: [
      {
        heading: "What we collect",
        blocks: [
          {
            type: "p",
            text: "When you use garammasaladating.com, we may collect:",
          },
          {
            type: "ul",
            items: [
              "Email address (if you subscribe to our newsletter or apply to be a contestant)",
              "Phone number (if you provide it via the newsletter form)",
              "Name, age, and application responses (if you apply to be a contestant)",
              "Basic analytics data (pages visited, device type, referral source)",
            ],
          },
        ],
      },
      {
        heading: "How we use it",
        blocks: [
          {
            type: "ul",
            items: [
              "To send you show announcements, ticket links, and discount codes",
              "To review contestant applications and contact selected applicants",
              "To understand how people use the site so we can improve it",
            ],
          },
        ],
      },
      {
        heading: "Third-party services",
        blocks: [
          {
            type: "p",
            text: "We use the following services that may collect data:",
          },
          {
            type: "ul",
            items: [
              "<strong>Eventbrite</strong> for ticket sales and event management",
              "<strong>Firebase</strong> for storing contestant applications",
              "<strong>Vercel Analytics</strong> for website performance monitoring",
              "<strong>PostHog</strong> for product analytics",
              "<strong>Google Tag Manager</strong> for marketing analytics",
              "<strong>Meta Pixel</strong> for ad performance tracking",
            ],
          },
          {
            type: "p",
            text: "Each of these services has its own privacy policy governing how they handle your data.",
          },
        ],
      },
      {
        heading: "Cookies",
        blocks: [
          {
            type: "p",
            text: "We use cookies and similar technologies for analytics and marketing. You can disable cookies in your browser settings, though some site features may not work as expected.",
          },
        ],
      },
      {
        heading: "Your data",
        blocks: [
          {
            type: "p",
            text: "We don't sell your data to anyone. If you want your information removed, email us at <a href=\"mailto:contact@garammasaladating.com\">contact@garammasaladating.com</a> and we'll delete it.",
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            text: 'Questions about this policy? Email <a href="mailto:contact@garammasaladating.com">contact@garammasaladating.com</a>.',
          },
        ],
      },
    ],
  },
  terms: {
    id: "terms",
    title: "Terms of Service",
    lastUpdated: "April 2026",
    metaTitle: "Terms of Service",
    metaDescription:
      "Terms of service for Garam Masala Dating. Rules and guidelines for using our website and attending our shows.",
    sections: [
      {
        heading: "The basics",
        blocks: [
          {
            type: "p",
            text: "By using garammasaladating.com or attending a Garam Masala Dating show, you agree to these terms. If you don't agree, that's fine, but you shouldn't use the site or attend the show.",
          },
        ],
      },
      {
        heading: "Tickets and events",
        blocks: [
          {
            type: "ul",
            items: [
              "Tickets are sold through Eventbrite and are subject to Eventbrite's terms and refund policies.",
              "We reserve the right to refuse entry or remove anyone from an event for disruptive, disrespectful, or unsafe behavior.",
              "Show dates, venues, and lineups are subject to change. We'll do our best to notify ticket holders of any changes.",
            ],
          },
        ],
      },
      {
        heading: "Contestant applications",
        blocks: [
          {
            type: "ul",
            items: [
              "Submitting an application does not guarantee selection or appearance in the show.",
              "We may use your application responses internally to cast the show. We will not publish your written answers without your consent.",
              "If selected, you agree to participate in good faith and treat your date and the audience with respect.",
              "Selection is entirely at our discretion. We have no obligation to explain our decisions, include your participation in any recording or promotional material, or cast you in any specific role.",
            ],
          },
        ],
      },
      {
        heading: "Contestant eligibility",
        blocks: [
          {
            type: "p",
            text: "To apply or participate as a contestant, you must meet the following requirements:",
          },
          {
            type: "ul",
            items: [
              "You must be 18 years of age or older.",
              "You represent that you are in good health and able to participate fully in a live show.",
              "You agree not to participate while under the influence of any substance that impairs your judgment or ability to engage with others.",
              "Participation is voluntary. You are not an employee of Garam Masala Dating and are not entitled to compensation of any kind.",
            ],
          },
        ],
      },
      {
        heading: "Personal and emotional risks",
        blocks: [
          {
            type: "p",
            text: "Participating as a contestant on Garam Masala Dating means going on a blind date in front of a live audience. This carries real emotional and reputational risks, including public rejection, embarrassment, and the disclosure of personal information.",
          },
          {
            type: "p",
            text: "By applying and participating, you acknowledge these risks. You consent to the inclusion of your personal stories, experiences, and information shared during the show in our production and promotion. Any connections or relationships that arise from your participation are entirely your own responsibility.",
          },
        ],
      },
      {
        heading: "Likeness and media rights",
        blocks: [
          {
            type: "p",
            text: "By attending a Garam Masala Dating show, you acknowledge that the event may be photographed or recorded. These photos and videos may be used on our website, social media, and marketing materials. If you'd prefer not to be featured as an audience member, let us know at the event or email us afterward.",
          },
          {
            type: "p",
            text: "If you participate as a contestant, your rights grant is broader. By applying and appearing in the show, you grant Garam Masala Dating the right to capture and use your name, likeness, photographs, voice, personal characteristics, and any information shared during the show, in connection with the production, distribution, and promotion of the event across all media now known or developed in the future, without monetary compensation. We may edit or modify this material as we see fit. You understand that the publicity associated with the show is the consideration for this grant.",
          },
        ],
      },
      {
        heading: "Confidentiality",
        blocks: [
          {
            type: "p",
            text: "If you are selected as a contestant, you agree not to publicly disclose the identity of other contestants, the outcome of your date, or details of the casting process before the show takes place, without our prior written approval.",
          },
          {
            type: "p",
            text: "We understand that you may share things with close friends and family, but public posts, media appearances, and social media disclosures about the show before it happens may affect other participants and the integrity of the event. Breaching this may cause us real harm, and we reserve the right to seek appropriate relief.",
          },
        ],
      },
      {
        heading: "Content",
        blocks: [
          {
            type: "p",
            text: "Everything on this site (text, design, photos, code) belongs to Garam Masala Dating unless otherwise noted. Don't copy it without permission.",
          },
        ],
      },
      {
        heading: "Liability",
        blocks: [
          {
            type: "p",
            text: "We run a comedy dating show. We do our best to create a safe, fun environment, but we are not responsible for what happens between audience members or contestants outside of the show.",
          },
          {
            type: "p",
            text: "To the fullest extent permitted by law, Garam Masala Dating, its producers, hosts, staff, and affiliates are not liable for any claims arising from your participation as a contestant or audience member, including personal injury, emotional distress, defamation, or invasion of privacy. Your participation is at your own risk.",
          },
        ],
      },
      {
        heading: "Governing law",
        blocks: [
          {
            type: "p",
            text: "These terms are governed by the laws of the State of New York. Any disputes arising from these terms or your participation in the show shall be resolved under New York law.",
          },
        ],
      },
      {
        heading: "Changes",
        blocks: [
          {
            type: "p",
            text: "We may update these terms from time to time. If we make significant changes, we'll note the updated date at the top of this page.",
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            text: 'Questions? Email <a href="mailto:contact@garammasaladating.com">contact@garammasaladating.com</a>.',
          },
        ],
      },
    ],
  },
};
