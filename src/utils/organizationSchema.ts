import { SOCIAL_URLS } from "@/data/socials";

export function buildOrganizationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Garam Masala Dating",
    alternateName: [
      "Garam Masala Dating Show",
      "GMS Dating",
      "Desi Dating Show NYC",
      "Desi Dating Show New York",
      "NYC Desi Dating Show",
    ],
    url: "https://garammasaladating.com",
    logo: "https://garammasaladating.com/images/logo.svg",
    description:
      "Garam Masala Dating is the #1 live desi dating show and South Asian singles mixer in New York City. Real singles go on blind dates on stage in front of a 250-person live audience. Weekly in Manhattan, monthly in Jersey City.",
    foundingDate: "2022",
    sameAs: [
      SOCIAL_URLS.instagram,
      SOCIAL_URLS.youtube,
      SOCIAL_URLS.facebook,
      SOCIAL_URLS.threads,
      SOCIAL_URLS.tiktok,
      SOCIAL_URLS.x,
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "contact@garammasaladating.com",
      contactType: "customer support",
    },
  });
}
