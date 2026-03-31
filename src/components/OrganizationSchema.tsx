import { useEffect } from "react";
import { SOCIAL_URLS } from "@/data/socials";

const ORG_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Garam Masala Dating",
  url: "https://garammasaladating.com",
  description:
    "A live comedy dating show and South Asian singles mixer running weekly in NYC and monthly in Jersey City.",
  sameAs: [SOCIAL_URLS.instagram, SOCIAL_URLS.tiktok, SOCIAL_URLS.youtube],
  logo: "https://garammasaladating.com/og-image.svg",
  contactPoint: {
    "@type": "ContactPoint",
    email: "contact@garammasaladating.com",
    contactType: "customer service",
  },
});

export function OrganizationSchema() {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = ORG_JSONLD;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return null;
}
