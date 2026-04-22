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
    badgeLabel: "Every 2–3 Weeks",
    bodyParagraphs: [
      "Manhattan has no shortage of things to do on a Sunday. What it’s short on is a room full of interesting, single people who are actually trying to meet someone without the pressure of a formal event or the numbness of another app.",
      "Garam Masala Dating fills that gap. Every two to three weeks, we run the #1 live South Asian dating show and singles mixer at Top Secret Comedy Club in the East Village. Real blind dates, on stage, in front of 250 people. Before and after, everyone mixes. It’s low-stakes, high-energy, and nothing like the other “networking” events you’ve skipped.",
      "Our Manhattan shows draw South Asian professionals, desi diaspora, expats, and anyone who shows up curious and leaves having actually talked to someone new. The crowd skews late 20s to mid 30s, culturally mixed, and genuinely there for a good time.",
      "Shows happen on Sundays at Top Secret Comedy Club, 44 Avenue A. Grab tickets for the next one below.",
      "If you’re tired of apps and tired of manufactured mixers, this is the alternative. Come watch a few strangers try to fall in love on stage, then go find your own person at the bar.",
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
      "If you’ve been skipping the NYC show because you didn’t feel like dealing with the commute home, this one’s for you.",
      "Garam Masala Dating runs a monthly show at The Laugh Tour Comedy Club in Jersey City. Same format as the NYC show, same hosts, smaller room. Real singles go on live blind dates on stage while the audience watches, reacts, and roots for them. Before and after, everyone mixes.",
      "The JC show draws from Jersey City, Hoboken, Newport, Weehawken, and the rest of Hudson County. The South Asian and desi community in this pocket of NJ is massive and concentrated, which means the odds that you already have a mutual with someone in the room are higher than you’d think. That’s not a bug.",
      "The room at The Laugh Tour is more intimate than our 250-person Manhattan venue. Less anonymous, more personal. If you’ve ever wanted to do the show but felt like the NYC crowd was too big, this is the one to start with.",
      "Monthly dates are posted on the events page. Tickets go fast because the room is smaller. Don’t wait.",
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
    titleTag: "Live Desi Dating Show San Diego",
    metaDescription:
      "The live South Asian comedy dating show from NYC is coming to San Diego. Demand is high and we are planning our first date now. Join the waitlist for presale tickets and casting.",
    h1: "San Diego, We're Coming.",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "San Diego has a growing South Asian community spread from UTC and Mira Mesa to Chula Vista and beyond. The demand for something real, in person, and different from the apps has been clear.",
      "Garam Masala Dating is the live South Asian dating show that sells out 250-person venues in NYC every few weeks. Real singles go on blind dates on stage while the audience watches, reacts, and mingles. We are scheduling our first San Diego date now.",
      "Join the waitlist to be first in line for presale tickets and casting. The more signups we see, the faster we confirm a venue and date.",
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
    communityStats:
      "San Diego's South Asian community is concentrated in UTC, Mira Mesa, Rancho Bernardo, and Chula Vista",
    relatedArticleSlugs: [
      "what-actually-happens-at-a-live-comedy-dating-show",
      "tired-of-dating-apps-desi-singles-irl-events",
      "how-to-get-cast-on-a-live-dating-show",
    ],
    faqItems: [
      {
        q: "When is Garam Masala Dating coming to San Diego?",
        a: "No date is confirmed yet. We are actively planning our first San Diego show and the waitlist helps us determine timing. Join below and you will be first to know.",
      },
      {
        q: "How do I get on the San Diego waitlist?",
        a: "Click the waitlist button and enter your email. You will receive presale access and casting opportunities before tickets go public.",
      },
      {
        q: "Can I apply to be on the show before a date is announced?",
        a: "Yes. Apply now. Applications stay active for 12 months and San Diego applicants will be prioritized when we confirm a date.",
      },
      {
        q: "How many people attend a Garam Masala Dating show?",
        a: "Our NYC shows sell out at 250 people. Touring shows run 100 to 200 depending on venue.",
      },
    ],
  },

  "los-angeles": {
    slug: "los-angeles",
    displayName: "Los Angeles",
    titleTag: "LA South Asian Dating Show",
    metaDescription:
      "The live desi reality dating show from NYC is heading to Los Angeles. 500,000 South Asian Angelenos and no live comedy dating events. Join the Garam Masala Dating LA waitlist for presale tickets and casting.",
    h1: "New York Built It. LA Is Next.",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "New York has been doing this for over a year. LA is next.",
      "The Los Angeles South Asian community runs from Artesia to Koreatown to Woodland Hills. Half a million people, dozens of zip codes, and a dating scene that still bottoms out at Dil Mil and temple events. There is a real gap here.",
      "Garam Masala Dating is bringing its live format to LA. We are scheduling dates now. The waitlist tells us demand. The more signups, the faster we confirm a venue.",
      "Get on the list to be notified first. If you want to be a contestant when we come to your city, apply below.",
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
    communityStats: "Over 500,000 South Asians live in Greater Los Angeles",
    relatedArticleSlugs: [
      "tired-of-dating-apps-desi-singles-irl-events",
      "what-actually-happens-at-a-live-comedy-dating-show",
      "irl-dating-revival",
    ],
    faqItems: [
      {
        q: "When is Garam Masala Dating coming to Los Angeles?",
        a: "We are actively planning our first LA date. No venue is confirmed yet. Join the waitlist and you will get presale access and casting priority before tickets go public.",
      },
      {
        q: "Where will the LA show be held?",
        a: "Venue is TBD. We are looking at spaces serving the Koreatown, Hollywood, and Culver City areas. Waitlist members will be the first to know.",
      },
      {
        q: "Can I apply to be on the show?",
        a: "Yes. Apply now. We cast from our active applicant pool for each touring date. LA applicants will be prioritized for the LA show.",
      },
      {
        q: "Is Garam Masala Dating only for South Asian people?",
        a: "The show focuses on the South Asian singles experience but the audience is open to everyone. Our NYC crowd is desi, culturally adjacent, or genuinely curious.",
      },
    ],
  },

  "san-francisco": {
    slug: "san-francisco",
    displayName: "San Francisco",
    titleTag: "SF Bay Area Desi Dating Show",
    metaDescription:
      "The desi live comedy dating show is coming to San Francisco. 400,000 South Asian Bay Area residents, one live reality dating night. Join the Garam Masala Dating SF waitlist for presale tickets and casting.",
    h1: "The Bay Area Has 400K South Asians and No Dating Show. Until Now.",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "New York has been doing this for over a year. The Bay Area is next.",
      "The Bay Area has more South Asian professionals per square mile than almost anywhere outside of South Asia. The dating scene looks exactly like you would expect: everyone is on the apps, everyone is also always working, and the one IRL event you attended was a networking mixer that should have been an email.",
      "We are planning our first Bay Area show. Join the waitlist and we will reach out with presale tickets and casting opportunities when a venue is confirmed.",
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
    communityStats:
      "The Bay Area has one of the highest South Asian population densities in the US, with over 400,000 desi residents across SF, San Jose, and the East Bay",
    relatedArticleSlugs: [
      "indian-tech-bro-guide-dating-silicon-valley",
      "tired-of-dating-apps-desi-singles-irl-events",
      "what-actually-happens-at-a-live-comedy-dating-show",
    ],
    faqItems: [
      {
        q: "When is Garam Masala Dating coming to San Francisco?",
        a: "We are actively planning our Bay Area debut. Join the waitlist for presale access and casting priority when a date is confirmed.",
      },
      {
        q: "Will the show be in SF or the South Bay?",
        a: "TBD. We are evaluating venues across SF, the South Bay, and the East Bay. Waitlist members will be first to know.",
      },
      {
        q: "I work in tech. Can I apply to be on the show?",
        a: "Absolutely. Apply now. Bay Area applicants will be prioritized for the Bay Area show.",
      },
    ],
  },

  "salt-lake-city": {
    slug: "salt-lake-city",
    displayName: "Salt Lake City",
    titleTag: "Desi Singles in Salt Lake City",
    metaDescription:
      "Garam Masala Dating may be coming to Salt Lake City. The #1 live South Asian dating show and singles mixer. Join the waitlist to be first to know.",
    h1: "Salt Lake City, We’re Looking at You",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Garam Masala Dating is the #1 live South Asian dating show and singles mixer that runs every week in New York City. The format: real singles, live blind dates on stage in front of 250 people, and a mixer built into the night.",
      "Wyatt Feegrado, co-host of the show, is performing at Happy Valley Comedy in Salt Lake City on June 26. If you’re in SLC and you’ve been looking for a way to actually meet South Asian singles in person instead of swiping, this is the room you’ve been missing.",
      "We’re considering Salt Lake City for a future tour date. Drop your email to get notified if we announce a show, or apply now if you want to be a contestant when we come.",
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
    h1: "Denver, You’re on the List",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Garam Masala Dating is the #1 live South Asian dating show and singles mixer running every week in New York City. The format is simple: real singles go on blind dates on stage in front of 250 people, the hosts ask questions, the audience reacts, and everyone mixes after.",
      "Wyatt Feegrado, co-host of the show, is performing at Comedy Works in Denver on June 28. If you caught his set and want more, this is the show he co-hosts back home in NYC every week.",
      "We’re looking at Denver for a future tour stop. Get on the waitlist and you’ll be first to know when tickets drop. Or apply to be a contestant now so you’re already in the system when we announce.",
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
