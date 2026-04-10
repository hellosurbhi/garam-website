import type { CityData } from "./types";

/** Cities with active shows or confirmed coming-soon status */
export const activeCities: Record<string, CityData> = {
  manhattan: {
    slug: "manhattan",
    displayName: "Manhattan",
    titleTag: "NYC's Live Desi Dating Show",
    metaDescription:
      "The best South Asian singles event in Manhattan. The #1 live South Asian dating show with a real mixer. Meet people, watch blind dates unfold on stage, and have an actual night out in NYC.",
    h1: "The Live Dating Show That Took Over the East Village",
    status: "active",
    badgeLabel: "Every 2\u20133 Weeks",
    bodyParagraphs: [
      "Manhattan has no shortage of things to do on a Sunday. What it\u2019s short on is a room full of interesting, single people who are actually trying to meet someone without the pressure of a formal event or the numbness of another app.",
      "Garam Masala Dating fills that gap. Every two to three weeks, we run the #1 live South Asian dating show and singles mixer at Top Secret Comedy Club in the East Village. Real blind dates, on stage, in front of 250 people. Before and after, everyone mixes. It\u2019s low-stakes, high-energy, and nothing like the other \u201Cnetworking\u201D events you\u2019ve skipped.",
      "Our Manhattan shows draw South Asian professionals, desi diaspora, expats, and anyone who shows up curious and leaves having actually talked to someone new. The crowd skews late 20s to mid 30s, culturally mixed, and genuinely there for a good time.",
      "Shows happen on Sundays at Top Secret Comedy Club, 44 Avenue A. Grab tickets for the next one below.",
      "If you\u2019re tired of apps and tired of manufactured mixers, this is the alternative. Come watch a few strangers try to fall in love on stage, then go find your own person at the bar.",
    ],
    ctas: [
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=New+York&state=NY",
      },
    ],
    includeEventSchema: true,
    areaServed: "Manhattan, New York",
    addressLocality: "Manhattan",
    addressRegion: "NY",
    addressCountry: "US",
    venueName: "Top Secret Comedy Club",
    region: "US Northeast",
    nearbyCities: [
      "jersey-city",
      "edison",
      "philadelphia",
      "boston",
      "stamford",
    ],
  },

  "jersey-city": {
    slug: "jersey-city",
    displayName: "Jersey City",
    titleTag: "Desi Dating Night Jersey City NJ",
    metaDescription:
      "Garam Masala Dating has a monthly show at The Laugh Tour Comedy Club in Jersey City. The #1 live South Asian dating show and singles mixer. No PATH anxiety required.",
    h1: "No PATH Required. The Show Comes to Jersey City.",
    status: "active",
    badgeLabel: "Monthly Shows",
    bodyParagraphs: [
      "If you\u2019ve been skipping the NYC show because you didn\u2019t feel like dealing with the commute home, this one\u2019s for you.",
      "Garam Masala Dating runs a monthly show at The Laugh Tour Comedy Club in Jersey City. Same format as the NYC show, same hosts, smaller room. Real singles go on live blind dates on stage while the audience watches, reacts, and roots for them. Before and after, everyone mixes.",
      "The JC show draws from Jersey City, Hoboken, Newport, Weehawken, and the rest of Hudson County. The South Asian and desi community in this pocket of NJ is massive and concentrated, which means the odds that you already have a mutual with someone in the room are higher than you\u2019d think. That\u2019s not a bug.",
      "The room at The Laugh Tour is more intimate than our 250-person Manhattan venue. Less anonymous, more personal. If you\u2019ve ever wanted to do the show but felt like the NYC crowd was too big, this is the one to start with.",
      "Monthly dates are posted on the events page. Tickets go fast because the room is smaller. Don\u2019t wait.",
    ],
    ctas: [
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=Jersey+City&state=NJ",
      },
    ],
    includeEventSchema: true,
    areaServed: "Jersey City, New Jersey",
    addressLocality: "Jersey City",
    addressRegion: "NJ",
    addressCountry: "US",
    venueName: "The Laugh Tour Comedy Club",
    eventScheduleFrequency: "P1M",
    region: "US Northeast",
    nearbyCities: [
      "manhattan",
      "edison",
      "parsippany",
      "stony-brook",
      "philadelphia",
    ],
  },

  "san-diego": {
    slug: "san-diego",
    displayName: "San Diego",
    titleTag: "Live Desi Dating Night San Diego",
    metaDescription:
      "Garam Masala Dating is coming back to San Diego. A live South Asian dating show and singles mixer from the creators of NYC\u2019s #1 live South Asian dating show.",
    h1: "San Diego, We Sold Out Once. We're Coming Back.",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Garam Masala Dating came to San Diego in March 2026 and sold out. Same format as the NYC show: real singles, live blind dates on stage, and a mixer built into the night so everyone could meet.",
      "The San Diego desi scene showed up. The room was tight-knit, the energy was different from New York. More personal, more \u201Cwait, do we have a friend in common?\u201D The show worked.",
      "We\u2019re coming back. Dates are TBA, but if you want to be first to know when tickets drop, get on the waitlist. And if you want to be a contestant when we return, apply below.",
    ],
    ctas: [
      { label: "Join the San Diego Waitlist", href: "#waitlist" },
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=San+Diego&state=CA",
      },
    ],
    includeEventSchema: false,
    areaServed: "San Diego, California",
    addressLocality: "San Diego",
    addressRegion: "CA",
    addressCountry: "US",
    region: "US West",
    nearbyCities: [
      "los-angeles",
      "irvine",
      "phoenix",
      "las-vegas",
      "sacramento",
    ],
  },

  "los-angeles": {
    slug: "los-angeles",
    displayName: "Los Angeles",
    titleTag: "LA South Asian Dating Show",
    metaDescription:
      "Garam Masala Dating is coming to LA. A live South Asian dating show and singles mixer from the creators of NYC\u2019s #1 live South Asian dating show.",
    h1: "New York Built It. LA Is Next.",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "New York has been doing this for over a year. LA is next.",
      "Garam Masala Dating is the #1 live South Asian dating show and singles mixer that sells out a 250-person venue in NYC every week. Real contestants. Real blind dates on stage. A real mixer before and after so the audience can find their own person too.",
      "We\u2019ve been building a waitlist for LA and the interest has been strong. When we announce dates, the waitlist gets first access to tickets. If you want to be a contestant when we come to your city, apply below.",
    ],
    ctas: [
      { label: "Join the LA Waitlist", href: "#waitlist" },
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=Los+Angeles&state=CA",
      },
    ],
    includeEventSchema: false,
    areaServed: "Los Angeles, California",
    addressLocality: "Los Angeles",
    addressRegion: "CA",
    addressCountry: "US",
    region: "US West",
    nearbyCities: [
      "san-diego",
      "irvine",
      "san-francisco",
      "phoenix",
      "las-vegas",
    ],
  },

  "san-francisco": {
    slug: "san-francisco",
    displayName: "San Francisco",
    titleTag: "SF Bay Area Desi Dating Show",
    metaDescription:
      "Garam Masala Dating is coming to San Francisco. A live South Asian dating show and singles mixer from the creators of NYC\u2019s #1 live South Asian dating show.",
    h1: "The Bay Area Has 300K South Asians and No Dating Show. Until Now.",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "New York has been doing this for over a year. The Bay Area is next.",
      "Garam Masala Dating is NYC\u2019s #1 live South Asian dating show and singles mixer. Real contestants. Real blind dates on stage. A real mixer before and after so the audience can find their own person too.",
      "The Bay Area has one of the largest South Asian communities in the country and somehow no one has built this yet. We\u2019re fixing that. Dates are TBA, but when we announce, the waitlist gets first access.",
      "Get on the list to be notified first. If you want to be a contestant when we come to your city, apply below.",
    ],
    ctas: [
      { label: "Join the SF Waitlist", href: "#waitlist" },
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=San+Francisco&state=CA",
      },
    ],
    includeEventSchema: false,
    areaServed: "San Francisco, California",
    addressLocality: "San Francisco",
    addressRegion: "CA",
    addressCountry: "US",
    region: "US West",
    nearbyCities: [
      "san-jose",
      "sacramento",
      "los-angeles",
      "portland",
      "seattle",
    ],
  },

  "salt-lake-city": {
    slug: "salt-lake-city",
    displayName: "Salt Lake City",
    titleTag: "Desi Singles in Salt Lake City",
    metaDescription:
      "Garam Masala Dating may be coming to Salt Lake City. The #1 live South Asian dating show and singles mixer. Join the waitlist to be first to know.",
    h1: "Salt Lake City, We\u2019re Looking at You",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Garam Masala Dating is the #1 live South Asian dating show and singles mixer that runs every week in New York City. The format: real singles, live blind dates on stage in front of 250 people, and a mixer built into the night.",
      "Wyatt Feegrado, co-host of the show, is performing at Happy Valley Comedy in Salt Lake City on June 26. If you\u2019re in SLC and you\u2019ve been looking for a way to actually meet South Asian singles in person instead of swiping, this is the room you\u2019ve been missing.",
      "We\u2019re considering Salt Lake City for a future tour date. Drop your email to get notified if we announce a show, or apply now if you want to be a contestant when we come.",
    ],
    ctas: [
      { label: "Join the SLC Waitlist", href: "#waitlist" },
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=Salt+Lake+City&state=UT",
      },
    ],
    includeEventSchema: false,
    areaServed: "Salt Lake City, Utah",
    addressLocality: "Salt Lake City",
    addressRegion: "UT",
    addressCountry: "US",
    region: "US West",
    nearbyCities: ["denver", "boise", "phoenix", "las-vegas", "seattle"],
  },

  denver: {
    slug: "denver",
    displayName: "Denver",
    titleTag: "Denver Desi Dating Night",
    metaDescription:
      "Garam Masala Dating may be coming to Denver. The #1 live South Asian dating show and singles mixer. Join the waitlist and be first to know.",
    h1: "Denver, You\u2019re on the List",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Garam Masala Dating is the #1 live South Asian dating show and singles mixer running every week in New York City. The format is simple: real singles go on blind dates on stage in front of 250 people, the hosts ask questions, the audience reacts, and everyone mixes after.",
      "Wyatt Feegrado, co-host of the show, is performing at Comedy Works in Denver on June 28. If you caught his set and want more, this is the show he co-hosts back home in NYC every week.",
      "We\u2019re looking at Denver for a future tour stop. Get on the waitlist and you\u2019ll be first to know when tickets drop. Or apply to be a contestant now so you\u2019re already in the system when we announce.",
    ],
    ctas: [
      { label: "Join the Denver Waitlist", href: "#waitlist" },
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=Denver&state=CO",
      },
    ],
    includeEventSchema: false,
    areaServed: "Denver, Colorado",
    addressLocality: "Denver",
    addressRegion: "CO",
    addressCountry: "US",
    region: "US West",
    nearbyCities: [
      "salt-lake-city",
      "phoenix",
      "albuquerque",
      "kansas-city",
      "minneapolis",
    ],
  },
};
