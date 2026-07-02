import type { CityData } from "@/data/cities";

export function buildCityJsonLd(city: CityData): string {
  const cityPageUrl = `https://garammasaladating.com/cities/${city.slug}`;

  const graph: Record<string, unknown>[] = [
    {
      "@type": "LocalBusiness",
      name: "Garam Masala Dating",
      url: "https://garammasaladating.com",
      areaServed: city.areaServed,
    },
    {
      "@type": "WebPage",
      "@id": cityPageUrl,
      url: cityPageUrl,
      name: city.titleTag,
      description: city.metaDescription,
      inLanguage: "en-US",
      isPartOf: {
        "@type": "WebSite",
        "@id": "https://garammasaladating.com",
      },
    },
  ];

  if (city.faqItems && city.faqItems.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: city.faqItems.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    });
  }

  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
}

export { buildEventSchemas } from "@/utils/eventSchema";
