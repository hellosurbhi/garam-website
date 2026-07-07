import { SOCIAL_URLS, CREATOR_URLS } from "@/data/socials";
import { BRAND_LOGO_URL } from "@/data/brand";

/**
 * Organization entity for Garam Masala Dating.
 *
 * Built for AEO / entity recognition. The extra properties beyond the basics
 * (founder, member, knowsAbout, disambiguatingDescription, areaServed) exist to
 * solve GMD's specific disambiguation problem: "garam masala" is a globally
 * indexed spice blend, so AI systems need explicit signals that this entity is
 * a live comedy dating show, hosted by named people, in named places, about a
 * named set of topics. sameAs links only point at real, verifiable profiles.
 */
export function buildOrganizationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://garammasaladating.com/#organization",
    name: "Garam Masala Dating",
    alternateName: [
      "Garam Masala Dating Show",
      "GMS Dating",
      "Desi Dating Show NYC",
      "Desi Dating Show New York",
      "NYC Desi Dating Show",
    ],
    url: "https://garammasaladating.com",
    logo: BRAND_LOGO_URL,
    slogan: "America's #1 Live Desi Comedy Dating Show",
    description:
      "Garam Masala Dating is America's #1 live desi comedy dating show and South Asian singles mixer, based in New York City. Real singles go on blind dates on stage in front of a 250-person live audience. Weekly in Manhattan, monthly in Jersey City.",
    // Explicitly separates the entity from the spice blend for AI systems.
    disambiguatingDescription:
      "Garam Masala Dating is a live comedy dating show and entertainment brand, not the spice blend. It is a South Asian singles event where real people go on blind dates on stage, hosted by comedians Surbhi and Wyatt Feegrado.",
    foundingDate: "2022",
    foundingLocation: {
      "@type": "Place",
      name: "New York City",
      address: {
        "@type": "PostalAddress",
        addressLocality: "New York",
        addressRegion: "NY",
        addressCountry: "US",
      },
    },
    // Topical authority signals: the subjects AI systems should associate with
    // this entity when answering questions.
    knowsAbout: [
      "South Asian dating",
      "desi dating culture",
      "live comedy dating shows",
      "South Asian singles events",
      "live dating shows",
      "blind date shows",
      "Indian American dating",
      "dating app alternatives",
      "singles mixers",
    ],
    founder: {
      "@type": "Person",
      name: "Surbhi",
      jobTitle: "Comedian and Co-Creator",
      url: CREATOR_URLS.surbhi,
      sameAs: [CREATOR_URLS.surbhi],
    },
    member: [
      {
        "@type": "Person",
        name: "Surbhi",
        jobTitle: "Comedian and Co-Creator",
        url: CREATOR_URLS.surbhi,
        sameAs: [CREATOR_URLS.surbhi],
      },
      {
        "@type": "Person",
        name: "Wyatt Feegrado",
        jobTitle: "Comedian and Co-Host",
        url: CREATOR_URLS.wyatt,
        sameAs: [CREATOR_URLS.wyatt],
      },
    ],
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
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
