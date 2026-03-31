import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getCityBySlug } from "@/data/cities";
import { getPostBySlug } from "@/data/journal";
import { getTipBySlug } from "@/data/tips";

const BASE = "https://garammasaladating.com";

interface Crumb {
  name: string;
  url?: string;
}

function buildCrumbs(pathname: string): Crumb[] | null {
  if (pathname === "/" || pathname === "/admin" || pathname === "/contestant-prep") {
    return null;
  }

  const crumbs: Crumb[] = [{ name: "Home", url: BASE + "/" }];

  if (pathname === "/apply") {
    crumbs.push({ name: "Apply" });
  } else if (pathname === "/links") {
    crumbs.push({ name: "Links" });
  } else if (pathname === "/faq") {
    crumbs.push({ name: "FAQ" });
  } else if (pathname === "/cities") {
    crumbs.push({ name: "Cities" });
  } else if (pathname.startsWith("/cities/")) {
    const slug = pathname.replace("/cities/", "");
    const city = getCityBySlug(slug);
    crumbs.push({ name: "Cities", url: BASE + "/cities" });
    crumbs.push({ name: city?.displayName ?? slug });
  } else if (pathname === "/journal") {
    crumbs.push({ name: "Journal" });
  } else if (pathname.startsWith("/journal/")) {
    const slug = pathname.replace("/journal/", "");
    const post = getPostBySlug(slug);
    crumbs.push({ name: "Journal", url: BASE + "/journal" });
    crumbs.push({ name: post?.title ?? slug });
  } else if (pathname === "/south-asian-dating-tips") {
    crumbs.push({ name: "Dating Tips" });
  } else if (pathname.startsWith("/south-asian-dating-tips/")) {
    const slug = pathname.replace("/south-asian-dating-tips/", "");
    const tip = getTipBySlug(slug);
    crumbs.push({ name: "Dating Tips", url: BASE + "/south-asian-dating-tips" });
    crumbs.push({ name: tip?.title ?? slug });
  } else {
    return null;
  }

  return crumbs;
}

export function BreadcrumbSchema() {
  const { pathname } = useLocation();

  useEffect(() => {
    const crumbs = buildCrumbs(pathname);
    if (!crumbs || crumbs.length < 2) return;

    const jsonLd = JSON.stringify({
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

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = jsonLd;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [pathname]);

  return null;
}
