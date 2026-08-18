/**
 * Show lineup: hosts/performers who appear on stage.
 * Single source of truth for bios, photos, and credits, consumed by
 * hosts.astro and by the per-event landing page's Lineup section so the
 * two never drift out of sync.
 */

// WHY: relative import, not the "@/" alias: this file is transitively
// imported by astro.config.mjs (via events.ts, for sitemap generation), and
// the config's own module-loading pass does not apply the vite.resolve.alias
// it defines to its own dependency graph. See the matching note in events.ts.
import { CREATOR_URLS } from "./socials";

export type PerformerId = "surbhi" | "wyatt";

export interface Performer {
  id: PerformerId;
  name: string;
  role: string;
  photo: string;
  instagramUrl: string;
  /** Rendered with set:html, may contain inline markup (e.g. <em>) for show titles. */
  bioParagraphs: string[];
  credits: string[];
}

export const PERFORMERS: Record<PerformerId, Performer> = {
  surbhi: {
    id: "surbhi",
    name: "Surbhi",
    role: "Co-Creator & Host",
    photo: "/images/hosts/surbhi.webp",
    instagramUrl: CREATOR_URLS.surbhi,
    bioParagraphs: [
      "Surbhi is a New York-based stand-up comedian and the creative force behind Garam Masala Dating. She created the show in 2022 after noticing something missing in the South Asian comedy and dating scene, a space where desi singles could meet in real life, in a room full of energy, without the awkwardness of apps or the pressure of family setups.",
      "What started as a one-off experiment in a downtown bar is now America's #1 live desi comedy dating show. The show sells out 250-seat venues weekly in Manhattan, runs monthly in Jersey City, and has expanded to Los Angeles, San Francisco, and San Diego. Surbhi has performed at comedy venues across the US and UK, and has accidentally matched three real couples through the show, and counting.",
      "She handles everything from casting and producing to hosting the show itself, where her ability to make strangers comfortable on stage in front of hundreds of people is the reason contestants keep coming back.",
    ],
    credits: [
      "Stand-Up Comedian",
      "Co-Creator & Producer",
      "NYC · LA · SF · SD",
    ],
  },
  wyatt: {
    id: "wyatt",
    name: "Wyatt Feegrado",
    role: "Co-Host & Actor",
    photo: "/images/hosts/wyatt.avif",
    instagramUrl: CREATOR_URLS.wyatt,
    bioParagraphs: [
      "Wyatt Feegrado is a stand-up comedian and actor who started sneaking out of his parents' house in Walnut Creek, California to do open mics at 16. He went on to attend NYU Tisch School of the Arts, then landed a starring role in ESPN+'s <em>Bettor Days</em>, followed by Hulu's <em>Chicano Squad</em> and the History Channel's <em>Holy Marvels</em>.",
      "He tours the US 11 months of the year and co-hosts the podcast <em>Gen Zenophobic</em> with his brother Luke. On Garam Masala Dating, Wyatt is the reason no awkward silence survives longer than two seconds. His improvisation keeps the energy high, the contestants laughing, and the audience on the edge of their seats.",
      "Together with Surbhi, he's built a show that feels less like a production and more like the best house party you've ever been to, except two strangers are falling in love on stage while 250 people lose their minds.",
    ],
    credits: [
      "Stand-Up Comedian",
      "Actor: ESPN+, Hulu, History",
      "NYU Tisch",
      "Co-Host",
    ],
  },
};

/** Every show has both hosts on stage unless an event overrides `lineup`. */
export const DEFAULT_LINEUP: PerformerId[] = ["surbhi", "wyatt"];
