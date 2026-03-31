const BASE = "https://garammasaladating.com";

interface Crumb {
  name: string;
  url?: string;
}

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

export { BASE };
