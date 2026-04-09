/**
 * All content for the /sponsorship brand partnerships page.
 * Never hardcode any of this in the component.
 */

export const SPONSORSHIP_COPY = {
  partnerEmail: "partnerships@garammasaladating.com",
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
    name: "Presenting",
    priceRange: "$3,000–$5,000 / show",
    tagline: "The headline sponsor. Your brand owns the night.",
    highlight: true,
    perks: [
      "Logo on all show collateral (stage, backdrop, digital assets)",
      "60-second host mention live from stage",
      "Product placement or sampling during the show",
      "Full social package — pre-show hype, post-show recap",
      "10 tickets + VIP access",
      "Category exclusivity — no competing brands at the same show",
    ],
  },
  {
    name: "Gold",
    priceRange: "$1,500–$2,500 / show",
    tagline: "Strong brand presence without the full commitment.",
    perks: [
      "Logo on digital show collateral",
      "30-second host mention from stage",
      "4 tickets + VIP access",
      "Post-show social feature",
    ],
  },
  {
    name: "Silver",
    priceRange: "$500–$1,000 / show",
    tagline: "Real visibility at an accessible entry point.",
    perks: [
      "Logo on digital collateral",
      "Brand name mentioned from stage",
      "2 tickets to the show",
    ],
  },
  {
    name: "In-Kind",
    priceRange: "Equivalent trade value",
    tagline: "Products or services in exchange for genuine audience exposure.",
    perks: [
      "Product sampling or distribution at the show",
      "Logo on relevant collateral",
      "Social mention",
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
    sub: "Packed room. Every single night.",
  },
  {
    num: "10M+",
    label: "Social media views",
    sub: "TikTok, Instagram, YouTube",
  },
  {
    num: "70%+",
    label: "South Asian audience",
    sub: "Urban professionals, 22–40",
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
}

export const TARGET_CATEGORIES: TargetCategory[] = [
  { category: "Dating Apps", brands: "Dil Mil, Hinge, Bumble" },
  {
    category: "Spirits & Beverage",
    brands: "Hennessy, Grey Goose, Johnnie Walker",
  },
  {
    category: "South Asian Food & Beverage",
    brands: "Chai brands, South Asian restaurants, specialty grocery",
  },
  {
    category: "Beauty & Wellness",
    brands: "Glossier, Fenty Beauty, South Asian beauty brands",
  },
  {
    category: "Entertainment & Streaming",
    brands: "Netflix South Asian content, Peacock, Hulu",
  },
  {
    category: "Financial Services",
    brands:
      "Banks, credit cards, and fintech targeting South Asian professionals",
  },
];

export interface SponsorFaq {
  q: string;
  a: string;
}

export const SPONSORSHIP_FAQS: SponsorFaq[] = [
  {
    q: "What is the audience demographic?",
    a: "Primarily South Asian professionals aged 22–40 in the NYC metro area. 70%+ South Asian, high disposable income, culturally engaged. We also draw a meaningful non-South Asian audience of comedy fans and people interested in dating culture — the room is always mixed.",
  },
  {
    q: "Can I sponsor multiple shows?",
    a: "Yes — and it's the better deal. Multi-show packages are available at a discount and give your brand consistent presence across a season rather than a single night. Email us to discuss what that looks like for your budget.",
  },
  {
    q: "What does 'category exclusivity' mean for Presenting sponsors?",
    a: "Only one brand per category per show. If you're a dating app, no competing dating app will be featured at that show. If you're a spirits brand, you're the only spirits brand. Your category is yours for the night.",
  },
  {
    q: "How do I get started?",
    a: "Email partnerships@garammasaladating.com with your brand name, sponsorship goal, and rough budget. We'll come back within 48 hours with options.",
  },
];
