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
  body: PostBlock[];
  faqs?: JournalFaq[];
  /** 2-3 slugs of related articles for cross-linking */
  relatedSlugs: string[];
  ctaConfig?: JournalCtaConfig;
}
