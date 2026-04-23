export interface PostBlock {
  type: "p" | "h2" | "h3";
  text: string;
}

export interface JournalFaq {
  q: string;
  a: string;
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
}
