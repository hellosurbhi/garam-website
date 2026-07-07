/**
 * All content for the /sponsorship brand partnerships page.
 * Never hardcode any of this in the component.
 */

export const SPONSORSHIP_COPY = {
  contactEmail: "caleb@garammasaladating.com",
  contactName: "Caleb",
  contactTitle: "Manager",
  heroHeadline: "Reach NYC's Most Engaged South Asian Audience",
  heroSub:
    "250 people in a room every two weeks. 70%+ South Asian professionals, 22 to 40, high income. 10M+ social views. They're not scrolling past your brand. They're watching a live show.",
  demoBlurb:
    "South Asian, desi diaspora, and culturally engaged non-South Asian guests in NYC metro. They share the clips, tag the brands, and come back every two weeks.",
  ctaHeadline: "Ready to be in the room?",
  ctaBody:
    "Email Caleb, our manager, with your brand, goal, and budget. He'll respond within 48 hours.",
} as const;

export interface SponsorTier {
  name: string;
  priceRange: string;
  tagline: string;
  perks: string[];
  highlight?: boolean;
}

export const SPONSOR_TIERS: SponsorTier[] = [
  {
    name: "Presenting Sponsor",
    priceRange: "$3,000 to $5,000 / show",
    tagline: "Your brand owns the night.",
    highlight: true,
    perks: [
      "Logo on all show collateral: stage, screens, slides, print",
      "60 second live host mention from stage",
      "Product placement or sampling during the show",
      "Full social package: pre-show, behind-the-scenes, post-show recap",
      "10 tickets + VIP seating",
      "Category exclusivity. No competing brand at the same show.",
    ],
  },
  {
    name: "Gold Sponsor",
    priceRange: "$1,500 to $2,500 / show",
    tagline: "Strong presence without the full commitment.",
    perks: [
      "Logo on digital show collateral and event page",
      "30 second live host mention from stage",
      "4 tickets + VIP seating",
      "Post-show social media feature",
    ],
  },
  {
    name: "Silver Sponsor",
    priceRange: "$500 to $1,000 / show",
    tagline: "Real visibility at an accessible entry point.",
    perks: [
      "Logo on digital collateral and event page",
      "Brand name mentioned from stage",
      "2 tickets to the show",
    ],
  },
  {
    name: "In-Kind Sponsor",
    priceRange: "Equivalent trade value",
    tagline: "Your product in the audience's hands.",
    perks: [
      "Instagram story thanking your brand",
      "Thank you mention from the hosts on stage",
    ],
  },
];

export interface MediaKitStat {
  num: string;
  label: string;
  sub: string;
}

export const MEDIA_KIT_STATS: MediaKitStat[] = [
  {
    num: "250",
    label: "Live audience per show",
    sub: "Sold out. Every night.",
  },
  {
    num: "10M+",
    label: "Social media views",
    sub: "TikTok, Instagram, YouTube",
  },
  {
    num: "70%+",
    label: "South Asian professionals",
    sub: "22 to 40, NYC, high income",
  },
  {
    num: "40+",
    label: "Shows produced",
    sub: "Bi-weekly in Manhattan",
  },
];

export interface TargetCategory {
  category: string;
  brands: string;
  why: string;
}

export const TARGET_CATEGORIES: TargetCategory[] = [
  {
    category: "Dating Apps",
    brands: "Dil Mil, Hinge, Bumble",
    why: "Our audience is there because they're interested in dating. Your app is one tap away.",
  },
  {
    category: "Spirits & Beverage",
    brands: "Hennessy, Grey Goose, Johnnie Walker",
    why: "Drinks are flowing. Your brand is literally in their hand during the show.",
  },
  {
    category: "South Asian Food & Beverage",
    brands: "Chai brands, South Asian restaurants, specialty grocery",
    why: "The exact demo that buys artisanal chai and orders from South Asian restaurants.",
  },
  {
    category: "Beauty & Wellness",
    brands: "Glossier, Fenty Beauty, South Asian beauty brands",
    why: "Dating show audience thinking about how they look. Gift bag samples convert.",
  },
  {
    category: "Entertainment & Streaming",
    brands: "Netflix South Asian content, Peacock, Hulu",
    why: "One mention from stage and your show is in their queue.",
  },
  {
    category: "Financial Services",
    brands: "Banks, credit cards, fintech",
    why: "High income, 22 to 40, urban professionals. All in one room.",
  },
];

export interface SponsorFaq {
  q: string;
  a: string;
}

export const SPONSORSHIP_FAQS: SponsorFaq[] = [
  {
    q: "What's the audience demographic?",
    a: "70%+ South Asian professionals, 22 to 40, NYC metro. Tech, finance, consulting, medicine, law. Highly active on social media. The other 30% came for the comedy and keep coming back.",
  },
  {
    q: "Can I sponsor multiple shows?",
    a: `Yes. Multi-show discounts available. Email ${SPONSORSHIP_COPY.contactEmail} for a season proposal.`,
  },
  {
    q: "What does category exclusivity mean?",
    a: "One brand per category per show. If you're a dating app, no other dating app is there. Your category is yours for the night.",
  },
  {
    q: "What social media content do sponsors get?",
    a: "Presenting gets the full package across Instagram, TikTok, and YouTube. Gold gets a post-show feature. Silver gets a mention. Organic reach is typically 100K to 500K+ per show.",
  },
  {
    q: "How do I get started?",
    a: `Email ${SPONSORSHIP_COPY.contactEmail} with your brand, goal, and budget. ${SPONSORSHIP_COPY.contactName}, our manager, responds within 48 hours.`,
  },
];
