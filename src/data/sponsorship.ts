/**
 * All content for the /sponsorship brand partnerships page.
 * Never hardcode any of this in the component.
 */

export const SPONSORSHIP_COPY = {
  partnerEmail: "partnerships@garammasaladating.com",
  heroHeadline: "Reach NYC's Most Engaged South Asian Audience",
  heroSub:
    "Garam Masala Dating puts 250 people in a room every two weeks — South Asian professionals aged 22–40, high income, high social engagement, and zero ad fatigue. They're not scrolling past your brand. They're watching a live show where your product is part of the experience. 40+ shows produced. 10M+ social media views. This is the room brands want to be in.",
  demoBlurb:
    "Our audience is South Asian, desi diaspora, and culturally engaged non-South Asian guests — primarily based in NYC metro, aged 22–40, with high disposable income and active social media presence. They're not passive attendees. They share the clips, quote the hosts, tag the brands, and come back every two weeks. 70%+ identify as South Asian. The remaining 30% are there because someone in their life dragged them to the show — and they come back on their own.",
  ctaHeadline: "Ready to be in the room?",
  ctaBody:
    "Tell us your brand, your sponsorship goal, and your rough budget. We'll respond within 48 hours with the right package, custom ideas for your activation, and available dates.",
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
    priceRange: "$3,000–$5,000 / show",
    tagline:
      "The headline sponsor. Your brand owns the night. This is the tier for brands that want to be synonymous with the show — your logo is on everything, your product is in the room, and Surbhi and Wyatt mention you by name from stage in front of 250 people.",
    highlight: true,
    perks: [
      "Logo on all show collateral — stage backdrop, digital screens, pre-show slides, and printed materials",
      "60-second live host mention from stage — Surbhi or Wyatt talk about your brand organically during the show, not a scripted ad read",
      "Product placement or sampling during the show — your product is physically in the room and in people's hands",
      "Full social media package — pre-show hype post, behind-the-scenes story feature, post-show recap with brand tag across Instagram, TikTok, and YouTube",
      "10 complimentary tickets + VIP seating — bring your team, bring clients, bring whoever you want front-row",
      "Category exclusivity — no competing brand at the same show. If you're a dating app, you're the only dating app. If you're a spirits brand, you're the only spirits brand. Your category is yours for the night.",
    ],
  },
  {
    name: "Gold Sponsor",
    priceRange: "$1,500–$2,500 / show",
    tagline:
      "Strong brand presence without the full presenting commitment. Your logo is visible, your brand gets stage time, and you get VIP access for your team. A great option for brands testing the waters or running a multi-show campaign at a lower per-show cost.",
    perks: [
      "Logo on digital show collateral — pre-show slides, social graphics, and event page",
      "30-second live host mention from stage — your brand name and a brief plug woven into the show naturally",
      "4 complimentary tickets + VIP seating",
      "Post-show social media feature — brand tagged in recap content across our channels",
    ],
  },
  {
    name: "Silver Sponsor",
    priceRange: "$500–$1,000 / show",
    tagline:
      "Real visibility at an accessible entry point. Your brand gets in front of 250 people live and across our social channels — ideal for smaller brands, local businesses, or brands running a first-time test before committing to a bigger package.",
    perks: [
      "Logo on digital collateral and event page",
      "Brand name mentioned from stage by the hosts",
      "2 complimentary tickets to the show",
    ],
  },
  {
    name: "In-Kind Sponsor",
    priceRange: "Equivalent trade value",
    tagline:
      "Products, services, or experiences in exchange for brand exposure. Perfect for brands that want their product physically in the audience's hands — drinks, beauty products, snacks, dating app promos, gift bags. The audience takes your product home and associates it with the best night they've had in months.",
    perks: [
      "Product sampling or distribution at the show — your product is part of the experience",
      "Logo on relevant show collateral",
      "Social media mention with brand tag",
      "Opportunity to include branded materials in post-show gift bags or activations",
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
    sub: "Packed room. Sold out. Every single night. Not a half-empty venue with scattered seats — a full room of engaged, laughing people.",
  },
  {
    num: "10M+",
    label: "Social media views",
    sub: "Organic reach across TikTok, Instagram Reels, and YouTube. Our clips go viral because the content is genuinely unscripted and chaotic.",
  },
  {
    num: "70%+",
    label: "South Asian professionals",
    sub: "Aged 22–40, NYC metro, high disposable income. Tech, finance, consulting, medicine, law, and creative industries.",
  },
  {
    num: "40+",
    label: "Shows produced",
    sub: "Bi-weekly in Manhattan. Expanding to LA, SF, Chicago, and 300+ cities. This is a proven, recurring platform — not a one-off event.",
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
    why: "Our audience is literally there because they're interested in dating. They're holding their phones. Your app is one tap away.",
  },
  {
    category: "Spirits & Beverage",
    brands: "Hennessy, Grey Goose, Johnnie Walker",
    why: "The show is at a bar or venue with drinks flowing. Product placement is organic — your brand is literally in their hand during the show.",
  },
  {
    category: "South Asian Food & Beverage",
    brands: "Chai brands, South Asian restaurants, specialty grocery",
    why: "Cultural resonance. Our audience is the exact demo that buys artisanal chai, orders from South Asian restaurants, and shops at specialty stores.",
  },
  {
    category: "Beauty & Wellness",
    brands: "Glossier, Fenty Beauty, South Asian beauty brands",
    why: "Dating show audience. They're thinking about how they look. Gift bag samples convert at an unusually high rate in this context.",
  },
  {
    category: "Entertainment & Streaming",
    brands: "Netflix South Asian content, Peacock, Hulu",
    why: "A room full of people who consume South Asian entertainment content and share it with their networks. One mention from stage and your show is in their queue.",
  },
  {
    category: "Financial Services",
    brands: "Banks, credit cards, and fintech for South Asian professionals",
    why: "High-income, 22–40, urban professionals. This is the acquisition demo every financial brand targets — and they're all in one room.",
  },
];

export interface SponsorFaq {
  q: string;
  a: string;
}

export const SPONSORSHIP_FAQS: SponsorFaq[] = [
  {
    q: "What exactly is the audience demographic?",
    a: "Primarily South Asian professionals aged 22–40 in the NYC metro area. 70%+ identify as South Asian — Indian, Pakistani, Bangladeshi, Sri Lankan, and broader desi diaspora. High disposable income: tech, finance, consulting, medicine, law, and creative industries. Highly active on social media — our audience shares clips, tags brands, and talks about the show online organically. The remaining 30% is non-South Asian guests who are there for the comedy, the dating culture, or because a friend dragged them. They come back on their own.",
  },
  {
    q: "Can I sponsor multiple shows?",
    a: "Yes — and it's the stronger play. Multi-show season packages are available at a per-show discount and give your brand recurring presence across an entire quarter or season rather than a single night. Repetition builds recognition, and our audience overlaps significantly show to show — they'll see your brand multiple times. Email partnerships@garammasaladating.com and we'll put together a season proposal.",
  },
  {
    q: "What does 'category exclusivity' mean for Presenting sponsors?",
    a: "Only one brand per category per show. If you're a dating app, no competing dating app is featured at that show. If you're a spirits brand, you're the only spirits brand in the room. If you're a beauty brand, same thing. Your category is yours for the night. This protects your investment and ensures the audience associates that category with your brand specifically.",
  },
  {
    q: "What kind of social media content do sponsors get?",
    a: "Depends on the tier. Presenting sponsors get the full package: pre-show hype post, behind-the-scenes story feature, show-night content with brand visible, and post-show recap with brand tag — across Instagram, TikTok, and YouTube. Our organic reach per show is typically 100K–500K+ impressions depending on how viral the clips go. Gold sponsors get post-show feature content. Silver sponsors get a social mention with brand tag.",
  },
  {
    q: "How do I get started?",
    a: "Email partnerships@garammasaladating.com with your brand name, what you're hoping to achieve (awareness, sampling, content, direct acquisition), and your rough budget. We'll respond within 48 hours with tier options, custom activation ideas, and available dates. No commitment required to start the conversation.",
  },
];
