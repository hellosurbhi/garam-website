export interface PostBlock {
  type: "p" | "h2" | "h3";
  text: string;
}

export interface JournalFaq {
  q: string;
  a: string;
}

export type JournalCtaVariant = "primary" | "secondary";

export interface JournalCtaSpec {
  text: string;
  href?: string;
  modal?: string;
  variant?: JournalCtaVariant;
  ctaId: string;
}

export interface JournalCtaConfig {
  intent: "show" | "advice";
  topCta?: JournalCtaSpec;
  midCta?: JournalCtaSpec;
  bottomCta?: JournalCtaSpec;
  cityLinks?: string[];
}

/** One entry in a ranked list article, rendered as ItemList JSON-LD. */
export interface RankedItem {
  /** 1-based rank. Positions across a post must be contiguous (1..n). */
  position: number;
  name: string;
  /** Optional canonical URL for the ranked thing (external product page). */
  url?: string;
}

/**
 * Editorial review of a third party app, rendered as Review JSON-LD
 * (itemReviewed = SoftwareApplication) plus a visible verdict box on the
 * page. Google requires the rating to be visible to readers, so pros and
 * cons are mandatory. Never use for Garam Masala itself: self serving
 * reviews violate Google's review snippet policy.
 */
export interface AppReview {
  appName: string;
  operatingSystem: string;
  applicationCategory: string;
  /** 1 to 5, halves allowed (e.g. 3.5). */
  ratingValue: number;
  pros: string[];
  cons: string[];
}

export interface JournalPost {
  slug: string;
  title: string;
  /** Optional override for the HTML <title> tag when the display title exceeds 65 chars. */
  seoTitle?: string;
  metaDescription: string;
  datePublished: string;
  dateModified: string;
  author: string;
  /** First two sentences of the body — used on the index page. */
  excerpt: string;
  /**
   * Answer-first lead (AEO): a 40-60 word, definition-led direct answer to the
   * post's title question, rendered as a highlighted callout at the very top of
   * the article and marked Speakable so AI answer engines can lift it verbatim.
   * Present only on the posts that map to real LLM/voice queries.
   */
  keyTakeaway?: string;
  body: PostBlock[];
  faqs?: JournalFaq[];
  /** 2-3 slugs of related articles for cross-linking */
  relatedSlugs: string[];
  ctaConfig?: JournalCtaConfig;
  /** Present only on ranked list articles. */
  rankedItems?: RankedItem[];
  /** Present only on third party app review articles. */
  appReview?: AppReview;
}
