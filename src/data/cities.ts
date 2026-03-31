export interface CityCta {
  label: string;
  href: string;
}

export interface CityData {
  slug: string;
  displayName: string;
  titleTag: string;
  metaDescription: string;
  h1: string;
  bodyParagraphs: string[];
  ctas: CityCta[];
  /**
   * "active"      — weekly / regular shows running now
   * "coming-soon" — announced or planned, no confirmed date yet
   * "past"        — show already happened
   */
  status: "active" | "coming-soon" | "past";
  /** Label shown on the /cities index card (e.g. "Weekly Shows", "Monthly Shows") */
  badgeLabel: string;
  /** For LocalBusiness schema */
  areaServed: string;
  /** Whether to include an Event schema block (false for unconfirmed / past cities) */
  includeEventSchema: boolean;
  addressLocality: string;
  addressRegion: string;
  /** Named venue for Event schema location.name (defaults to displayName) */
  venueName?: string;
  /** ISO 8601 duration for eventSchedule.repeatFrequency (e.g. "P1M" for monthly) */
  eventScheduleFrequency?: string;
}

export const cities: Record<string, CityData> = {
  manhattan: {
    slug: "manhattan",
    displayName: "Manhattan",
    titleTag:
      "South Asian Singles Events Manhattan | Garam Masala Dating NYC",
    metaDescription:
      "The best South Asian singles event in Manhattan \u2014 a live comedy dating show with a real mixer. Meet people, watch blind dates unfold on stage, and have an actual night out in NYC.",
    h1: "Manhattan\u2019s Weekly Desi Dating Night",
    status: "active",
    badgeLabel: "Weekly Shows",
    bodyParagraphs: [
      "Manhattan has no shortage of things to do on a Friday or Saturday night. What it\u2019s short on is a room full of interesting, single people who are actually trying to meet someone \u2014 without the pressure of a formal event or the numbness of another app.",
      "Garam Masala Dating fills that gap. Every week, we take over a venue in Manhattan and run a live comedy dating show with a singles mixer built around it. Real blind dates, on stage, in front of 250 people. Before and after, everyone mixes. It\u2019s low-stakes, high-energy, and nothing like the other \u201Cnetworking\u201D events you\u2019ve skipped.",
      "Our Manhattan shows draw South Asian professionals, desi diaspora, expats, and anyone who shows up curious and leaves having actually talked to someone new. The crowd skews late 20s to mid 30s, culturally mixed, and genuinely there for a good time.",
      "We run the show weekly. Check the events page for the current venue and date \u2014 we move around the East Village, Lower East Side, and Lower Manhattan depending on the week.",
      "If you\u2019re tired of apps and tired of manufactured mixers, this is the alternative. Come watch a few strangers try to fall in love on stage, then go find your own person at the bar.",
    ],
    ctas: [
      { label: "Get Tickets", href: "/links" },
      { label: "Apply to Be a Contestant", href: "/apply" },
    ],
    includeEventSchema: true,
    areaServed: "Manhattan, New York",
    addressLocality: "Manhattan",
    addressRegion: "NY",
  },

  "san-diego": {
    slug: "san-diego",
    displayName: "San Diego",
    titleTag:
      "South Asian Singles Events San Diego | Garam Masala Dating",
    metaDescription:
      "Garam Masala Dating came to San Diego \u2014 a live comedy dating show and South Asian singles mixer. Join the waitlist for the next show and apply to be a contestant.",
    h1: "San Diego\u2019s First Desi Dating Show",
    status: "past",
    badgeLabel: "Past Shows",
    bodyParagraphs: [
      "Garam Masala Dating came to San Diego on March 7, 2026. Same format as the NYC show: real singles, live blind dates on stage in front of a packed house, and a mixer built into the night so the audience could find their own person too.",
      "San Diego\u2019s desi scene showed up. The room was tight-knit, the energy was different from New York \u2014 more personal, more \u201Cwait, do we have a friend in common?\u201D \u2014 and the show worked.",
      "We\u2019ll be back. If you missed it, get on the waitlist for the next San Diego date. And if you want to be a contestant when we return, apply below \u2014 we\u2019ll have your name when we announce.",
    ],
    ctas: [
      { label: "Join the Waitlist for Next Time", href: "/links" },
      { label: "Apply to Be a Contestant", href: "/apply" },
    ],
    includeEventSchema: false,
    areaServed: "San Diego, California",
    addressLocality: "San Diego",
    addressRegion: "CA",
  },

  "jersey-city": {
    slug: "jersey-city",
    displayName: "Jersey City",
    titleTag:
      "South Asian Singles Events Jersey City NJ | Garam Masala Dating Hoboken",
    metaDescription:
      "Garam Masala Dating has a monthly show at The Laugh Tour Comedy Club in Jersey City. A live comedy dating show and South Asian singles mixer \u2014 no PATH anxiety required.",
    h1: "Jersey City\u2019s Desi Dating Night",
    status: "active",
    badgeLabel: "Monthly Shows",
    bodyParagraphs: [
      "If you\u2019ve been skipping the NYC show because you didn\u2019t feel like dealing with the commute home, this one\u2019s for you.",
      "Garam Masala Dating runs a monthly show at The Laugh Tour Comedy Club in Jersey City \u2014 same format as the NYC show, same hosts, smaller room. Real singles go on live blind dates on stage while the audience watches, reacts, and roots for them. Before and after, everyone mixes.",
      "The JC show draws from Jersey City, Hoboken, Newport, Weehawken, and the rest of Hudson County. The South Asian and desi community in this pocket of NJ is massive and concentrated \u2014 which means the odds that you already have a mutual with someone in the room are higher than you\u2019d think. That\u2019s not a bug.",
      "The room at The Laugh Tour is more intimate than our 250-person Manhattan venue. Less anonymous, more personal. If you\u2019ve ever wanted to do the show but felt like the NYC crowd was too big, this is the one to start with.",
      "Monthly dates are posted on the events page. Tickets go fast because the room is smaller \u2014 don\u2019t wait.",
    ],
    ctas: [
      { label: "Get Tickets", href: "/links" },
      { label: "Apply to Be a Contestant", href: "/apply" },
    ],
    includeEventSchema: true,
    areaServed: "Jersey City, New Jersey",
    addressLocality: "Jersey City",
    addressRegion: "NJ",
    venueName: "The Laugh Tour Comedy Club",
    eventScheduleFrequency: "P1M",
  },

  "los-angeles": {
    slug: "los-angeles",
    displayName: "Los Angeles",
    titleTag:
      "South Asian Singles Events Los Angeles | Garam Masala Dating",
    metaDescription:
      "Garam Masala Dating is coming to LA. A live comedy dating show and South Asian singles mixer \u2014 from the co-creator of the NYC show that sells out 250 seats every week.",
    h1: "LA\u2019s Desi Dating Night Is Coming",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "New York has been doing this for over a year. LA is next.",
      "Garam Masala Dating is a live comedy dating show and South Asian singles mixer that sells out a 250-person venue in NYC every week. Real contestants. Real blind dates on stage. A real mixer before and after so the audience can find their own person too.",
      "Wyatt Feegrado \u2014 co-host of Garam Masala Dating \u2014 is performing in Los Angeles May 4 through May 10 as part of Netflix Is a Joke Fest. If you\u2019re going to one of his shows, this is the same guy who hosts a room every week where South Asian singles go on live blind dates in front of hundreds of people. It\u2019s exactly as chaotic as it sounds, and it works.",
      "We\u2019re planning LA dates now. Get on the list to be notified first \u2014 and if you want to be a contestant when we come to your city, apply below.",
    ],
    ctas: [
      { label: "Join the LA Waitlist", href: "/links" },
      { label: "Apply to Be a Contestant", href: "/apply" },
    ],
    includeEventSchema: true,
    areaServed: "Los Angeles, California",
    addressLocality: "Los Angeles",
    addressRegion: "CA",
  },

  "salt-lake-city": {
    slug: "salt-lake-city",
    displayName: "Salt Lake City",
    titleTag:
      "South Asian Singles Events Salt Lake City | Garam Masala Dating",
    metaDescription:
      "Garam Masala Dating may be coming to Salt Lake City. A live comedy dating show and singles mixer \u2014 join the waitlist to be first to know.",
    h1: "Salt Lake City, We\u2019re Looking at You",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Garam Masala Dating is a live comedy dating show and South Asian singles mixer that runs every week in New York City. The format: real singles, live blind dates on stage in front of 250 people, and a mixer built into the night.",
      "Wyatt Feegrado \u2014 co-host of the show \u2014 is performing at Happy Valley Comedy in Salt Lake City on June 26. If you\u2019re in SLC and you\u2019ve been looking for a way to actually meet South Asian singles in person instead of swiping, this is the room you\u2019ve been missing.",
      "We\u2019re considering Salt Lake City for a future tour date. Drop your email to get notified if we announce a show, or apply now if you want to be a contestant when we come.",
    ],
    ctas: [
      { label: "Join the SLC Waitlist", href: "/links" },
      { label: "Apply to Be a Contestant", href: "/apply" },
    ],
    includeEventSchema: false,
    areaServed: "Salt Lake City, Utah",
    addressLocality: "Salt Lake City",
    addressRegion: "UT",
  },

  denver: {
    slug: "denver",
    displayName: "Denver",
    titleTag:
      "South Asian Singles Events Denver | Garam Masala Dating",
    metaDescription:
      "Garam Masala Dating may be coming to Denver. A live comedy dating show and South Asian singles mixer \u2014 join the waitlist and be first to know.",
    h1: "Denver, You\u2019re on the List",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Garam Masala Dating is a live comedy dating show and South Asian singles mixer running every week in New York City. The format is simple: real singles go on blind dates on stage in front of 250 people, the hosts ask questions, the audience reacts, and everyone mixes after.",
      "Wyatt Feegrado \u2014 co-host of the show \u2014 is performing at Comedy Works in Denver on June 28. If you caught his set and want more, this is the show he co-hosts back home in NYC every week.",
      "We\u2019re looking at Denver for a future tour stop. Get on the waitlist and you\u2019ll be first to know when tickets drop \u2014 or apply to be a contestant now so you\u2019re already in the system when we announce.",
    ],
    ctas: [
      { label: "Join the Denver Waitlist", href: "/links" },
      { label: "Apply to Be a Contestant", href: "/apply" },
    ],
    includeEventSchema: false,
    areaServed: "Denver, Colorado",
    addressLocality: "Denver",
    addressRegion: "CO",
  },
};

/** Ordered list for the /cities index page */
export const citiesIndex: CityData[] = [
  cities["manhattan"],
  cities["jersey-city"],
  cities["los-angeles"],
  cities["salt-lake-city"],
  cities["denver"],
];

export function getCityBySlug(slug: string): CityData | undefined {
  return cities[slug];
}
