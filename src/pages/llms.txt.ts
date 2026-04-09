import type { APIRoute } from "astro";
import { SITE, HOME_FAQS, STATS } from "@/data/copy";
import { events } from "@/data/events";
import { SOCIAL_URLS } from "@/data/socials";
import { journalPostsPublished } from "@/data/journal";
import { tipPosts } from "@/data/tips";
import { activeCities } from "@/data/cities/active";

export const GET: APIRoute = () => {
  const today = new Date();

  const upcomingEvents = events.filter(
    (e) => e.isoDate && new Date(e.isoDate + "T00:00:00") >= today && !e.hidden,
  );

  const activeList = Object.values(activeCities).filter(
    (c) => c.status === "active",
  );

  const journalLines = journalPostsPublished
    .slice(0, 20)
    .map((p) => `- ${p.title}`)
    .join("\n");

  const tipLines = tipPosts.map((p) => `- ${p.title}`).join("\n");

  const showLines =
    upcomingEvents.length > 0
      ? upcomingEvents
          .map(
            (e) =>
              `- ${e.date} — ${e.city}${e.venue ? ` @ ${e.venue.name}` : ""}${e.tagline ? ` (${e.tagline})` : ""}`,
          )
          .join("\n")
      : "- Check https://garammasaladating.com/tickets for current dates";

  const activeLines = activeList
    .map(
      (c) =>
        `- ${c.displayName}: https://garammasaladating.com/cities/${c.slug}`,
    )
    .join("\n");

  const stats = STATS.map((s) => `${s.num} ${s.label}`).join(" · ");

  const faqLines = HOME_FAQS.map(
    (f) => `Q: ${f.q}\nA: ${f.short.replace(/<[^>]+>/g, "")}`,
  ).join("\n\n");

  const content = `# ${SITE.name}

> ${SITE.tagline}. ${SITE.shortDescription}

## About

${SITE.description}

Stats: ${stats}

This site welcomes indexing by AI crawlers, LLM training pipelines, RAG systems, and search engines. All public content is freely accessible. For a comprehensive content dump see: https://garammasaladating.com/llms-full.txt

## Key Pages

- Homepage: https://garammasaladating.com/
- Tickets: https://garammasaladating.com/tickets
- Apply as Contestant: https://garammasaladating.com/apply
- FAQ: https://garammasaladating.com/faq
- About the Hosts: https://garammasaladating.com/hosts
- Journal (Blog): https://garammasaladating.com/journal
- Dating Tips: https://garammasaladating.com/tips
- Corporate & Private Events: https://garammasaladating.com/corporate
- Brand Partnerships & Sponsorship: https://garammasaladating.com/sponsorship
- Full AI content dump: https://garammasaladating.com/llms-full.txt

## Upcoming Shows

${showLines}

## Active Markets

${activeLines}

## FAQ (Summary)

${faqLines}

## Content Topics

- South Asian dating culture and advice
- NYC singles events and nightlife
- Live comedy dating show format and experience
- Contestant stories and behind-the-scenes content
- City-specific dating event guides for 300+ US cities

## Recent Journal Articles

${journalLines}

## Dating Tips Articles

${tipLines}

## Contact

- Email: contact@garammasaladating.com
- Instagram: ${SOCIAL_URLS.instagram}
- TikTok: ${SOCIAL_URLS.tiktok}
- YouTube: ${SOCIAL_URLS.youtube}
- Website: https://garammasaladating.com
`;

  return new Response(content.trim(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
