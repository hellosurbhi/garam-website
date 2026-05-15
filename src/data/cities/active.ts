import type { CityData } from "./types";

/** Cities with active shows or confirmed coming-soon status */
export const activeCities: Record<string, CityData> = {
  manhattan: {
    slug: "manhattan",
    displayName: "Manhattan",
    titleTag: "NYC's Live Desi Dating Show",
    metaDescription:
      "The best South Asian singles event in Manhattan. Live dating show and mixer at Top Secret Comedy Club. Real dates on stage, real people in the room.",
    h1: "The Live Dating Show That Took Over the East Village",
    status: "active",
    badgeLabel: "Every 2 to 3 Weeks",
    bodyParagraphs: [
      "Manhattan has no shortage of things to do on a Sunday. What it’s short on is a room full of interesting, single people who are actually trying to meet someone without the pressure of a formal event or the numbness of another app.",
      "Garam Masala Dating fills that gap. Every two to three weeks at Top Secret Comedy Club in the East Village, real singles volunteer for live dates on stage while a packed room watches it unfold. Before and after, the whole crowd mingles. It’s low-stakes, high-energy, and nothing like the so-called networking events you’ve skipped.",
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
    communityStats:
      "Over 250,000 South Asians live in the NYC metro area, with the densest concentration of desi professionals in the country",
    relatedArticleSlugs: [
      "the-only-live-desi-dating-show-in-nyc",
      "south-asian-singles-events-nyc",
      "best-things-to-do-in-nyc-if-youre-single",
    ],
    faqItems: [
      {
        q: "How often does Garam Masala Dating run in Manhattan?",
        a: "Every two to three weeks on Sundays at Top Secret Comedy Club in the East Village. Dates are posted on our events page and tickets go on sale about a week before each show.",
      },
      {
        q: "What happens at a Garam Masala Dating show?",
        a: "Real singles go on live dates on stage while the audience watches, reacts, and picks favorites. Before and after the stage portion, the entire room mingles. It is part comedy, part dating, part social event.",
      },
      {
        q: "How do I apply to be a contestant on the Manhattan show?",
        a: "Fill out the application on our apply page. We cast from our active applicant pool for each show. New York applicants are reviewed on a rolling basis.",
      },
      {
        q: "Is Garam Masala Dating only for South Asian people?",
        a: "The show is built around the South Asian singles experience, but the audience is open to everyone. Our crowd is desi, culturally adjacent, and genuinely curious.",
      },
    ],
  },

  "jersey-city": {
    slug: "jersey-city",
    displayName: "Jersey City",
    titleTag: "Desi Dating Night Jersey City NJ",
    metaDescription:
      "Garam Masala Dating runs monthly at The Laugh Tour Comedy Club in Jersey City. Live desi dating show and mixer. No PATH anxiety required.",
    h1: "No PATH Required. The Show Comes to Jersey City.",
    status: "active",
    badgeLabel: "Monthly Shows",
    bodyParagraphs: [
      "If you’ve been skipping the NYC show because you didn’t feel like dealing with the commute home, this one’s for you.",
      "Garam Masala Dating runs a monthly show at The Laugh Tour Comedy Club in Jersey City. Same format as the Manhattan show, same hosts, smaller room. Contestants go on live dates while the crowd watches and roots for them. Before and after, the whole room mingles.",
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
    communityStats:
      "Jersey City, Hoboken, and Hudson County have one of the fastest growing South Asian populations in New Jersey",
    relatedArticleSlugs: [
      "how-to-meet-indian-singles-without-apps",
      "comedy-dating-show-unique-date-idea",
      "what-we-learned-from-100-desi-blind-dates",
    ],
    faqItems: [
      {
        q: "How often does the Jersey City show run?",
        a: "Monthly. Dates are posted on our events page. The JC room is smaller than Manhattan so tickets sell out faster.",
      },
      {
        q: "Is the Jersey City show different from the Manhattan show?",
        a: "Same format, same hosts, more intimate room. The Laugh Tour holds fewer people than our East Village venue, which makes it more personal and less anonymous.",
      },
      {
        q: "Where is The Laugh Tour Comedy Club?",
        a: "In Jersey City, easily accessible from Hoboken, Newport, Weehawken, and the rest of Hudson County. No PATH ride to the East Village required.",
      },
      {
        q: "Can I apply to be a contestant for the JC show?",
        a: "Yes. Apply on our apply page and note Jersey City as your preferred location. We cast from our applicant pool for each show date.",
      },
    ],
  },

  "san-diego": {
    slug: "san-diego",
    displayName: "San Diego",
    titleTag: "Live Desi Dating Show San Diego",
    metaDescription:
      "The live South Asian dating show from NYC is coming to San Diego. UTC, Mira Mesa, Chula Vista. Join the waitlist for presale tickets and casting.",
    h1: "San Diego, We’re Coming.",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "San Diego has a growing South Asian community spread from UTC and Mira Mesa to Chula Vista and beyond. The demand for something real, in person, and different from the apps has been clear.",
      "The format that sells out in New York every few weeks: real contestants go on live dates on stage while a packed room watches it unfold. Afterward, the whole crowd mingles. We are scheduling our first San Diego date now.",
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
      "San Diego’s South Asian community is concentrated in UTC, Mira Mesa, Rancho Bernardo, and Chula Vista",
    relatedArticleSlugs: [
      "desi-dating-show-vs-dating-apps",
      "irl-dating-revival",
      "dating-after-30-desi-guide",
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
      "The live desi dating show from NYC is heading to LA. 500,000 South Asians, zero live dating events. Join the waitlist for presale tickets.",
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
      "desi-night-out-beyond-bollywood",
      "indian-matchmaking-meets-standup-comedy",
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
      "The live South Asian dating show is now in the Bay Area. Real dates on stage, real people in the room. Grab tickets for the next San Francisco show.",
    h1: "The Bay Area Has 400K South Asians. The Dating Show Has Finally Arrived.",
    status: "active",
    badgeLabel: "Tickets Available",
    bodyParagraphs: [
      "The Bay Area has more South Asian professionals per square mile than almost anywhere outside of South Asia. The dating scene looks exactly like you would expect: everyone is on the apps, everyone is also always working, and the one IRL event you attended was a networking mixer that should have been an email.",
      "Garam Masala Dating is now running shows in San Francisco. Real singles volunteer for live dates on stage while a packed room watches it unfold. Before and after, the whole crowd mingles. It is part comedy, part dating show, part social event. The format that sells out in New York every few weeks.",
      "Shows are at The Faight Collective on Haight Street in San Francisco. Grab tickets for the next one below. If you want to be on stage instead of in the audience, apply to be a contestant.",
    ],
    ctas: [
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=San+Francisco&state=CA",
      },
    ],
    includeEventSchema: true,
    areaServed: "San Francisco, California",
    addressLocality: "San Francisco",
    addressRegion: "CA",
    addressCountry: "US",
    venueName: "The Faight Collective",
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
      "dating-on-h1b-visa",
      "how-to-meet-indian-singles-without-apps",
    ],
    faqItems: [
      {
        q: "How often does Garam Masala Dating run in San Francisco?",
        a: "We are actively adding SF show dates. Check the tickets section on this page for the latest dates at The Faight Collective on Haight Street.",
      },
      {
        q: "Where is the San Francisco show held?",
        a: "At The Faight Collective, 473A Haight St, San Francisco. Doors open 30 minutes before showtime.",
      },
      {
        q: "I work in tech. Can I apply to be on the show?",
        a: "Absolutely. Apply now and select San Francisco as your preferred city. Bay Area applicants are prioritized for SF show dates.",
      },
    ],
  },

  "salt-lake-city": {
    slug: "salt-lake-city",
    displayName: "Salt Lake City",
    titleTag: "Desi Singles in Salt Lake City",
    metaDescription:
      "Garam Masala Dating may be coming to Salt Lake City. Live South Asian dating show and mixer. Join the waitlist to be first to know.",
    h1: "Salt Lake City, We’re Looking at You",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Salt Lake City’s South Asian community is small but growing, concentrated around the tech corridor, University of Utah, and the healthcare industry. If you’re desi in SLC, you probably already know every other desi person in your building. The dating pool feels even smaller.",
      "Wyatt Feegrado, co-host of the show, is performing at Happy Valley Comedy in Salt Lake City on June 26. If you’re in SLC and you’ve been looking for a way to actually meet South Asian singles in person instead of swiping, this is the room you’ve been missing.",
      "The show format that sells out in New York: real contestants go on live dates on stage while the audience watches, reacts, and picks favorites. Afterward, the whole room mingles. It works because it puts everyone in one place with zero ambiguity about why they showed up.",
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
    communityStats:
      "Salt Lake City’s South Asian community is centered around the tech corridor, University of Utah, and Intermountain Healthcare",
    relatedArticleSlugs: [
      "irl-dating-revival",
      "how-to-prepare-for-a-live-matchmaking-show",
      "rise-of-south-asian-comedy-america",
    ],
    faqItems: [
      {
        q: "When is Garam Masala Dating coming to Salt Lake City?",
        a: "No date is confirmed yet. We are gauging interest through the waitlist. Co-host Wyatt Feegrado is performing in SLC on June 26, which helps us build local awareness.",
      },
      {
        q: "Is there a large enough desi community in SLC for this?",
        a: "The South Asian population in the Salt Lake metro has grown significantly, especially with tech companies and healthcare expanding in the area. The waitlist helps us confirm demand.",
      },
      {
        q: "Can I apply to be a contestant before a date is announced?",
        a: "Yes. Apply now. Applications stay active for 12 months and SLC applicants will be prioritized when we confirm a date.",
      },
    ],
  },

  denver: {
    slug: "denver",
    displayName: "Denver",
    titleTag: "Denver Desi Dating Night",
    metaDescription:
      "Garam Masala Dating may be coming to Denver. Live South Asian dating show and mixer. Join the waitlist and be first to know.",
    h1: "Denver, You’re on the List",
    status: "coming-soon",
    badgeLabel: "Coming Soon",
    bodyParagraphs: [
      "Denver’s South Asian community has grown steadily with the tech, aerospace, and healthcare industries pulling professionals from across the country. The desi population is spread from Aurora to Centennial to downtown, and the dating options for South Asian singles are limited to the apps and the occasional cultural event that doubles as an aunty interrogation.",
      "Wyatt Feegrado, co-host of the show, is performing at Comedy Works in Denver on June 28. If you caught his set and want more, this is the show he co-hosts back home in NYC every week.",
      "The format: real contestants go on live dates on stage while the audience watches, reacts, and picks favorites. Afterward, the whole room mingles. It works because everyone in the room showed up for the same reason. No ambiguity, no pretense.",
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
    communityStats:
      "Denver’s South Asian population has grown with the tech and aerospace industries, concentrated in Aurora, Centennial, and the DTC corridor",
    relatedArticleSlugs: [
      "what-actually-happens-at-a-live-comedy-dating-show",
      "comedy-dating-show-unique-date-idea",
      "desi-dating-problems-brown-people",
    ],
    faqItems: [
      {
        q: "When is Garam Masala Dating coming to Denver?",
        a: "No date is confirmed yet. Co-host Wyatt Feegrado is performing at Comedy Works on June 28, and we are using that to gauge Denver interest. Join the waitlist to be notified first.",
      },
      {
        q: "Where would the Denver show be held?",
        a: "Venue is TBD. We are evaluating comedy clubs and event spaces in the Denver metro area. Waitlist members will be the first to know.",
      },
      {
        q: "Can I apply to be a contestant before a Denver date is announced?",
        a: "Yes. Apply now. Applications stay active for 12 months and Denver applicants will be prioritized when we confirm a date.",
      },
    ],
  },
};
