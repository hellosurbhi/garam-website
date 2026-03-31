import { useEffect } from "react";

/**
 * Sets document.title, meta description, and injects a JSON-LD <script> tag
 * into <head> on mount. Restores/removes all three on unmount (route change).
 *
 * Pass jsonLd as a pre-stringified string to avoid stale-closure / object
 * reference issues in the dependency array.
 */
export function usePageMeta(
  title: string,
  description: string,
  jsonLd?: string,
  noindex?: boolean
) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const metaDesc = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    const prevDesc = metaDesc?.content ?? "";
    if (metaDesc) metaDesc.content = description;

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = jsonLd;
      document.head.appendChild(script);
    }

    let robotsMeta: HTMLMetaElement | null = null;
    if (noindex) {
      robotsMeta = document.createElement("meta");
      robotsMeta.name = "robots";
      robotsMeta.content = "noindex, nofollow";
      document.head.appendChild(robotsMeta);
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc) metaDesc.content = prevDesc;
      script?.remove();
      robotsMeta?.remove();
    };
  }, [title, description, jsonLd, noindex]);
}
