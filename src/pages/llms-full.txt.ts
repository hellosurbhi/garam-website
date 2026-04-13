import type { APIRoute } from "astro";
import {
  SITE,
  HOME_FAQS,
  STATS,
  TESTIMONIALS,
  EXPERIENCE_STEPS,
} from "@/data/copy";
import { events } from "@/data/events";
import { pressItems } from "@/data/press";
import { SOCIAL_URLS, CREATOR_URLS } from "@/data/socials";
import { journalPostsPublished } from "@/data/journal";
import type { PostBlock } from "@/data/journal";
import { tipPosts } from "@/data/tips";
import { activeCities } from "@/data/cities/active";
import {
  CORPORATE_COPY,
  AUDIENCE_TIERS,
  INCLUSIONS,
  CORPORATE_FAQS,
} from "@/data/corporate";
import {
  SPONSOR_TIERS,
  MEDIA_KIT_STATS,
  TARGET_CATEGORIES,
} from "@/data/sponsorship";

/** Convert a PostBlock[] body to readable plain text. */
function blocksToText(blocks: PostBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "h2") return `\n### ${b.text}\n`;
      if (b.type === "h3") return `\n#### ${b.text}\n`;
      return b.text;
    })
    .join("\n");
}

export const GET: APIRoute = () => {
  const today = new Date();

  const upcomingEvents = events.filter(
    (e) => e.isoDate && new Date(e.isoDate + "T00:00:00") >= today && !e.hidden,
  );
  const pastEvents = events.filter(
    (e) => e.isoDate && new Date(e.isoDate + "T00:00:00") < today && !e.hidden,
  );

  const activeList = Object.values(activeCities).filter(
    (c) => c.status === "active",
  );
  const comingSoonList = Object.values(activeCities).filter(
    (c) => c.status === "coming-soon",
  );

  // Full body for the 12 most-recent published posts; title + excerpt only for the rest
  const FULL_BODY_LIMIT = 12;
  const journalFull = journalPostsPublished.slice(0, FULL_BODY_LIMIT);
  const journalRest = journalPostsPublished.slice(FULL_BODY_LIMIT);

  // ── Sections ──────────────────────────────────────────────────────────────

  const statsLine = STATS.map((s) => `${s.num} ${s.label}`).join(" · ");

  const testimonialSection = TESTIMONIALS.map(
    (t) => `"${t.quote}"\n${t.author}, ${t.location}`,
  ).join("\n\n");

  const experienceSection = EXPERIENCE_STEPS.map(
    (s) => `### ${s.title}\n${s.text}`,
  ).join("\n\n");

  const faqSection = HOME_FAQS.map(
    (f) => `### ${f.q}\n\n${f.short.replace(/<[^>]+>/g, "")}\n\n${f.long}`,
  ).join("\n\n---\n\n");

  const upcomingSection =
    upcomingEvents.length > 0
      ? upcomingEvents
          .map((e) => {
            const lines = [`### ${e.date}: ${e.city}`];
            if (e.venue)
              lines.push(
                `Venue: ${e.venue.name}${e.venue.streetAddress ? `, ${e.venue.streetAddress}` : ""}, ${e.venue.addressLocality}, ${e.venue.addressRegion}`,
              );
            if (e.startTime)
              lines.push(`Time: ${e.startTime} to ${e.endTime ?? "22:00"} ET`);
            if (e.price) lines.push(`Tickets: $${e.price}`);
            if (e.tagline) lines.push(`Status: ${e.tagline}`);
            lines.push(`Ticket URL: ${e.url}`);
            return lines.join("\n");
          })
          .join("\n\n")
      : "Check https://garammasaladating.com/tickets for current dates.";

  const pastSection = pastEvents
    .map(
      (e) =>
        `- ${e.date}, ${e.city}${e.venue ? ` @ ${e.venue.name}` : ""}${e.tagline ? `: ${e.tagline}` : ""}`,
    )
    .join("\n");

  const activeCitySection = activeList
    .map(
      (c) =>
        `### ${c.displayName} (${c.badgeLabel})\n${c.bodyParagraphs.join("\n\n")}\nCity page: https://garammasaladating.com/cities/${c.slug}`,
    )
    .join("\n\n");

  const comingSoonSection = comingSoonList
    .map(
      (c) =>
        `- ${c.displayName}: ${c.bodyParagraphs[0]}\n  City page: https://garammasaladating.com/cities/${c.slug}`,
    )
    .join("\n\n");

  const tipsSection = tipPosts
    .map(
      (p) =>
        `### ${p.title}\n\n${blocksToText(p.body)}\n\nURL: https://garammasaladating.com/tips/${p.slug}`,
    )
    .join("\n\n---\n\n");

  const journalFullSection = journalFull
    .map((p) => {
      const parts = [
        `### ${p.title}`,
        `Published: ${p.datePublished} | Author: ${p.author}`,
        ``,
        p.excerpt,
        ``,
        blocksToText(p.body),
      ];
      if (p.faqs && p.faqs.length > 0) {
        parts.push("\n**FAQs:**");
        parts.push(p.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n"));
      }
      parts.push(`\nURL: https://garammasaladating.com/journal/${p.slug}`);
      return parts.join("\n");
    })
    .join("\n\n---\n\n");

  const journalRestSection = journalRest
    .map(
      (p) =>
        `- **${p.title}** (${p.datePublished})\n  ${p.excerpt}\n  URL: https://garammasaladating.com/journal/${p.slug}`,
    )
    .join("\n\n");

  const pressSection = pressItems
    .map((p) => `- ${p.title} [${p.type}]${p.url ? `: ${p.url}` : ""}`)
    .join("\n");

  // ── Assemble ──────────────────────────────────────────────────────────────

  const content = `# Garam Masala Dating: Full Site Content for AI Indexing

> This file is generated at build time from garammasaladating.com data files. Intended for LLMs, RAG systems, and AI crawlers. All public content is freely accessible.

---

## About the Show

${SITE.description}

The show runs weekly in Manhattan at Top Secret Comedy Club (44 Avenue A, East Village) and monthly in Jersey City at The Laugh Tour Comedy Club. It has expanded to San Diego, with Los Angeles and San Francisco coming soon.

**Stats:** ${statsLine}

---

## The Experience: Step by Step

${experienceSection}

---

## The Hosts

### Surbhi: Co-Creator & Host

Surbhi is a New York-based stand-up comedian and the creative force behind Garam Masala Dating. She created the show in 2022 after noticing something missing in the South Asian comedy and dating scene: a space where desi singles could meet in real life, in a room full of energy, without the awkwardness of apps or the pressure of family setups.

What started as a one-off experiment in a downtown bar is now the #1 live South Asian dating show. The show sells out 250-seat venues weekly in Manhattan, runs monthly in Jersey City, and has expanded to Los Angeles, San Francisco, and San Diego. Surbhi has performed at comedy venues across the US and UK, and has matched three real couples through the show: and counting.

She handles everything from casting and producing to hosting the show itself. Her ability to make strangers comfortable on stage in front of hundreds of people is the reason contestants keep coming back.

Credits: Stand-Up Comedian, Co-Creator & Producer, NYC · LA · SF · SD
Instagram: ${CREATOR_URLS.surbhi}

### Wyatt Feegrado: Co-Host & Actor

Wyatt Feegrado is a stand-up comedian and actor who started sneaking out of his parents' house in Walnut Creek, California to do open mics at 16. He attended NYU Tisch School of the Arts, then landed a starring role in ESPN+'s Bettor Days, followed by Hulu's Chicano Squad and the History Channel's Holy Marvels.

He tours the US 11 months of the year and co-hosts the podcast Gen Zenophobic with his brother Luke. On Garam Masala Dating, Wyatt is the reason no awkward silence survives longer than two seconds. His improvisation keeps the energy high, the contestants laughing, and the audience on the edge of their seats.

Credits: Stand-Up Comedian, Actor: ESPN+, Hulu, History Channel, NYU Tisch, Co-Host
Instagram: ${CREATOR_URLS.wyatt}

---

## Audience Testimonials

${testimonialSection}

---

## Full FAQ

${faqSection}

---

## Upcoming Shows

${upcomingSection}

---

## Past Shows (Recent)

${pastSection}

---

## Cities & Markets

### Active Markets

${activeCitySection}

### Coming Soon

${comingSoonSection}

GMD has city landing pages for 300+ US cities and major international cities across Canada, UK, Australia, India, Europe, Southeast Asia, and East Asia.

---

## Dating Tips (Full Posts by Surbhi)

${tipsSection}

---

## Journal: Featured Articles (Full Text)

${journalFullSection}

---

## Journal: Additional Articles

${journalRestSection}

---

## Corporate & Private Events

Garam Masala Dating offers private show bookings for corporate teams, Diwali parties, client entertainment, and private events in NYC.

**URL:** https://garammasaladating.com/corporate
**Booking contact:** ${CORPORATE_COPY.agentEmail}

### Audience Size Options

${AUDIENCE_TIERS.map((t) => `- **${t.label} (${t.range} guests):** ${t.description}`).join("\n")}

### What's Included

${INCLUSIONS.map((i) => `- **${i.title}:** ${i.description}`).join("\n")}

### Corporate FAQs

${CORPORATE_FAQS.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

---

## Sponsorship & Brand Partnerships

Garam Masala Dating offers sponsorship packages for brands seeking to reach NYC's South Asian professional audience.

**URL:** https://garammasaladating.com/sponsorship
**Contact:** ${CORPORATE_COPY.agentEmail}

### Audience Statistics

${MEDIA_KIT_STATS.map((s) => `- ${s.num} ${s.label}: ${s.sub}`).join("\n")}

Audience demographic: 70%+ South Asian, 22 to 40 age range, NYC metro, high disposable income, high social media engagement.

### Sponsorship Tiers

${SPONSOR_TIERS.map((t) => `**${t.name}: ${t.priceRange}**\n${t.tagline}\nPerks:\n${t.perks.map((p) => `- ${p}`).join("\n")}`).join("\n\n")}

### Target Partner Categories

${TARGET_CATEGORIES.map((c) => `- **${c.category}:** ${c.brands}`).join("\n")}

---

## Press & Media

${pressSection}

---

## Social Media

- Instagram: ${SOCIAL_URLS.instagram}
- TikTok: ${SOCIAL_URLS.tiktok}
- YouTube: ${SOCIAL_URLS.youtube}
- Threads: ${SOCIAL_URLS.threads}
- X / Twitter: ${SOCIAL_URLS.x}
- Facebook: ${SOCIAL_URLS.facebook}

---

## Contact

- Email: contact@garammasaladating.com
- Website: https://garammasaladating.com
- Venue (NYC): Top Secret Comedy Club, 44 Avenue A, East Village, New York, NY 10009
- Venue (Jersey City): The Laugh Tour Comedy Club, 555 Washington Blvd, Jersey City, NJ 07310

---

## Indexing Permission

This site and all public content is freely available for AI indexing, LLM training, RAG pipelines, and search engines. We welcome responsible use of this content for discovery and recommendation purposes.

For press, partnerships, or media inquiries: contact@garammasaladating.com
`;

  return new Response(content.trim(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
