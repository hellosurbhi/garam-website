const BASE = import.meta.env.SITE ?? "https://garammasaladating.com";

interface Crumb {
  name: string;
  url?: string;
}

/**
 * Serialise a BreadcrumbList JSON-LD string for use in structured data `<script>` tags.
 *
 * @param crumbs Ordered list of breadcrumb entries; omit `url` on the last (current) item.
 */
export function buildBreadcrumbJsonLd(crumbs: Crumb[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => {
      const item: Record<string, unknown> = {
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
      };
      if (crumb.url) item.item = crumb.url;
      return item;
    }),
  });
}

/** Canonical base URL for the site, used when building absolute breadcrumb item URLs. */
export { BASE };
