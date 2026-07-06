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
      {
        q: "Is this better than Indian speed dating in NYC?",
        a: "Different animal. Speed dating is eight awkward mini interviews with a timer. Here you watch real blind dates on stage for 90 minutes, laugh with 250 people and then mingle in a room that is already warmed up. The connections happen because the pressure is gone, not scheduled.",
      },
      {
        q: "Is the show a good date night if I'm not single?",
        a: "Yes, and about half the room agrees with you. Couples and friend groups come for the comedy and the secondhand adrenaline of watching strangers flirt in public. Singles get the mixer. Everyone gets the show.",
      },
      {
        q: "Can I come alone?",
        a: "Please do. Solo attendees have the best mixer outcomes because they actually talk to new people instead of huddling with their friends. The show gives everyone the same 90 minutes of shared material, so you will never be stuck without an opener.",
      },
    ],
    sections: [
      {
        heading: "The best singles event in NYC is a comedy show",
        paragraphs: [
          "Manhattan's singles infrastructure is enormous and mostly bad. Speed dating with lanyards, app-brand pop-ups, rooftop mixers where everyone stares at the skyline instead of each other. The problem is always the same: you walk in cold and the entire burden of meeting someone is on you. Our format flips it. Two real singles go on a blind date on stage, the room reacts together for 90 minutes and by the time the mixer starts the whole audience shares a night's worth of inside jokes. Talking to a stranger stops being brave and starts being obvious.",
          "The East Village location does half the work too. Doors open 30 minutes early, drinks flow through the show and Avenue A gives you ten backup plans for wherever the night goes after.",
        ],
      },
      {
        heading: "Who you'll actually meet at the Manhattan show",
        paragraphs: [
          "The stereotype is that desi events in NYC are either fresh-off-the-boat student nights or aunty-run matrimonial mixers. This room is neither. Expect consultants who moved from Bombay via business school, second gen Jersey kids who commute in, doctors escaping their residencies for one night, artists, founders and roughly forty percent non desi friends, partners and the culturally curious. The common thread is that everyone chose a live show over another night of swiping.",
          "Tickets sell out most weeks, so grab a seat now, and if watching makes you want the stage, apply to be a contestant. Half our best daters started in the audience.",
        ],
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
      {
        q: "Is there Indian speed dating in Jersey City?",
        a: "Hudson County's desi singles mostly get pointed at Manhattan events. This is the local alternative: a live comedy dating show and mixer on your side of the river, sized so you actually meet the people you noticed across the room.",
      },
      {
        q: "Where do South Asian singles in Hudson County meet?",
        a: "Newport happy hours, India Square on Newark Avenue, Hoboken bar crawls where the desi crowd finds itself by accident. Community is everywhere, but a room built for meeting someone did not exist here until this show.",
      },
      {
        q: "Is the JC show good for a first date or a group night?",
        a: "Both. Watching strangers navigate a blind date is elite first date material because it hands you two hours of conversation. Groups love it for the same reason. Singles should stay for the mixer either way.",
      },
    ],
    sections: [
      {
        heading: "Jersey City's desi scene deserves better than a PATH ride",
        paragraphs: [
          "Hudson County quietly became one of the most desi places in America. India Square anchors Newark Avenue, the Newport and Exchange Place towers fill every year with young South Asian professionals priced out of Manhattan and Hoboken adds its own crowd two stops away. What the neighborhood never had was a singles event of its own, so everyone's dating life ran through Manhattan logistics: the 11pm PATH math, the shared cab negotiations, the slow death of momentum somewhere under the Hudson.",
          "A local show removes the tax. You can meet someone who lives eight minutes away, at a venue you can walk home from, in a room where 'I'm also in JC' is the best pickup line available.",
        ],
      },
      {
        heading: "Why the smaller room works in your favor",
        paragraphs: [
          "The Laugh Tour runs more intimate than our 250 seat Manhattan show, and intimate is an advantage when the goal is actually meeting people. You see everyone. Everyone sees you. The mixer after the show is dense with locals instead of a diaspora of boroughs, and the follow-up date is a neighborhood walk instead of a calendar negotiation.",
          "Monthly dates post on the events page and the smaller room means tickets genuinely run out. Grab yours early, or apply to be a contestant and let Hudson County watch you flirt.",
        ],
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
        a: "Hit the waitlist button and drop your email. San Diego waitlist members get presale ticket access and casting consideration ahead of the general public when we confirm a UTC or Mira Mesa venue.",
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
    status: "active",
    badgeLabel: "Upcoming Show",
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
      {
        q: "Is there Indian speed dating in Los Angeles?",
        a: "LA gets occasional desi speed dating and Bollywood nights, scattered across a metro that takes 90 minutes to cross. A live comedy dating show gives the whole scene one room and one reason to show up, which matters more here than in any other city we play.",
      },
      {
        q: "Where do South Asian singles in LA actually meet?",
        a: "Artesia's Little India for food, Culver City and Koreatown happy hours, industry parties if you are lucky and the same three apps everyone else is tired of. Half a million South Asians, no dedicated singles night. That is the gap.",
      },
      {
        q: "Will the LA show have the same energy as New York?",
        a: "The format travels because the cast is local. LA supplies its own daters, its own volunteers and its own specific chaos. Based on our waitlist, the LA shows skew slightly more entertainment industry and slightly more shameless, which is exactly what the stage wants.",
      },
    ],
    sections: [
      {
        heading: "LA's desi dating problem is 40 miles wide",
        paragraphs: [
          "Greater Los Angeles holds one of the largest South Asian populations in the country, and it is spread across a geography that punishes spontaneity. Artesia's Pioneer Boulevard is the cultural anchor, but the singles live everywhere from Santa Monica to Pasadena to Irvine, and a promising app match who lives across two freeways is functionally long distance. The community has food, festivals and film connections everywhere. What it lacks is gravity: one recurring event strong enough to pull the scattered scene into a single room.",
          "That is exactly what a live show is. One night, one venue, several hundred desi singles who all decided the drive was worth it. The mixer handles the rest.",
        ],
      },
      {
        heading: "What an LA Garam Masala night looks like",
        paragraphs: [
          "Two LA singles who have never met, a screenwriter from Silver Lake and a UCLA researcher maybe, on a blind date on stage while a room full of people who understand both auntie pressure and pilot season react in real time. Comedian hosts steer, the audience votes and the mixer after finally introduces the Westside to the 626 without a wedding involved.",
          "Dates are being scheduled now and waitlist volume moves the calendar. Get on the list for first access to tickets, or apply to be a contestant and give LA a love story with no development notes.",
        ],
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
    badgeLabel: "Upcoming Show",
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
      { label: "Join the SF Waitlist", href: "#waitlist" },
    ],
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
      {
        q: "Is there Indian speed dating in San Francisco?",
        a: "The Bay's desi speed dating events exist and they feel like a series of coffee chats with a bell. Our format warms up the entire room with 90 minutes of live blind dates and comedy first, so the mingling starts itself. Different physics, better outcomes.",
      },
      {
        q: "Where do South Asian singles in SF actually meet?",
        a: "Work, climbing gyms, run clubs and apps whose pools everyone exhausted in 2023. The city's desi singles are surrounded by more single desis than almost anywhere on earth and still report having nowhere to meet. The show is the fix for exactly that.",
      },
      {
        q: "Is the SF show worth it if I live in the South Bay or East Bay?",
        a: "Yes, and you will not be alone: every SF show pulls a caravan from Fremont, Sunnyvale and Oakland. If the trek is genuinely impossible, join the San Jose waitlist too, because South Bay demand decides how fast that show happens.",
      },
    ],
    sections: [
      {
        heading:
          "The Bay has the highest desi density and the lowest date conversion",
        paragraphs: [
          "San Francisco's South Asian singles live inside a statistical paradox. The Bay Area holds one of the largest desi populations in the country, the median single here is employed, interesting and gym-adjacent, and yet everyone describes the same dating life: three apps, recycled matches and months between actual dates. The problem is not supply. It is that the Bay's social life runs through work and hobby silos where everyone is either coupled, a coworker or both.",
          "A live dating show breaks the silo problem by brute force. Nobody in the room is your coworker, everyone chose a singles-forward night and the show gives you 90 minutes of shared jokes before you have to say a word.",
        ],
      },
      {
        heading: "What the Haight Street show is actually like",
        paragraphs: [
          "The Faight Collective room runs closer and louder than a standard comedy club, which suits this format perfectly. Two Bay Area singles who have never met go on a live first date, hosts Surbhi and Wyatt run the chaos, the audience votes and the mixer after fills the space with people comparing notes on what they just watched. It is the rare SF event where phones stay in pockets because the room is more interesting.",
          "Tickets move fast in this market, so buy early, and if you have ever narrated your own dating life in a sprint retro, apply to be a contestant. The stage was built for you.",
        ],
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

  philadelphia: {
    slug: "philadelphia",
    displayName: "Philadelphia",
    titleTag: "Philly Desi Singles Night",
    metaDescription:
      "Garam Masala Dating is now in Philly. Live desi dating show and mixer at Next In Line Comedy. Penn, Drexel, Main Line, Cherry Hill. Grab tickets.",
    h1: "Live Comedy Dating for South Asian Singles in Philly",
    status: "active",
    badgeLabel: "Upcoming Show",
    bodyParagraphs: [
      "Philadelphia has four major universities, a massive medical community, and a South Asian population that stretches from Center City out to King of Prussia, Exton, and across the bridge into Cherry Hill. Penn, Drexel, Temple, Villanova. The talent pool is deep. The dating scene for desi singles? Not so much.",
      "Garam Masala Dating is now running shows in Philadelphia. Real contestants go on live dates on stage while a packed room watches, reacts, and picks favorites. Before and after, the entire crowd mingles. The format that sells out in New York every few weeks, now in your city.",
      "Shows are at Next In Line Comedy, 1025 Hamilton Street in Philadelphia. Grab tickets for the next one below. The King of Prussia and Main Line suburbs, Cherry Hill, University City, Center City: everyone is welcome and the room is exactly what you think it is.",
      "If you want to be on stage instead of in the audience, apply to be a contestant. You already know how to rep your city.",
    ],
    ctas: [
      { label: "Join the Philly Waitlist", href: "#waitlist" },
      {
        label: "Apply to Be a Contestant",
        href: "/apply?city=Philadelphia&state=PA",
      },
    ],
    areaServed: "Philadelphia, Pennsylvania",
    addressLocality: "Philadelphia",
    addressRegion: "PA",
    addressCountry: "US",
    venueName: "Next In Line Comedy",
    region: "US Northeast",
    nearbyCities: [
      "edison",
      "manhattan",
      "jersey-city",
      "baltimore",
      "pittsburgh",
    ],
    communityStats:
      "Philadelphia's South Asian community spans Penn, Drexel, Temple, and the Main Line suburbs out to King of Prussia and Cherry Hill",
    relatedArticleSlugs: [
      "guide-to-indian-dating-culture-america",
      "comedy-dating-show-unique-date-idea",
      "first-gen-indian-american-dating",
    ],
    faqItems: [
      {
        q: "Where is the Philadelphia show held?",
        a: "At Next In Line Comedy, 1025 Hamilton Street, Philadelphia, PA 19123. Check the tickets section on this page for the latest show dates.",
      },
      {
        q: "Will the show be in Center City or the suburbs?",
        a: "Next In Line Comedy on Hamilton Street is accessible from Center City, University City, and the surrounding neighborhoods. The Main Line and Cherry Hill are a short drive.",
      },
      {
        q: "How do I apply to be a contestant for the Philly show?",
        a: "Apply on our apply page and select Philadelphia as your preferred city. Philadelphia applicants are prioritized for Philly show dates.",
      },
      {
        q: "Is there Indian speed dating in Philadelphia?",
        a: "Rarely, and when it happens it is a quiet room near a university. Philly's desi singles deserve a night with actual energy: live blind dates on stage, a crowd with opinions and a mixer where the ice is already broken. That is this show.",
      },
      {
        q: "Where do South Asian singles in Philly actually meet?",
        a: "Penn and Drexel grad circles, med campus friend groups, Chinatown Karaoke birthdays and the King of Prussia community events your parents know about before you do. All community, no singles night. We fixed that.",
      },
      {
        q: "Is the show worth the trip from the Main Line or Cherry Hill?",
        a: "The room regularly includes South Jersey and Main Line plates in the parking equation, yes. Hamilton Street is a short ride from 30th Street Station and the mixer alone beats anything running closer to home.",
      },
    ],
    sections: [
      {
        heading: "Philly's desi scene is younger than you think",
        paragraphs: [
          "Philadelphia's South Asian story gets told as a suburbs story, King of Prussia and Cherry Hill families two generations deep, but the singles map looks completely different. Penn, Drexel, Temple and Jefferson pump thousands of desi students, residents and researchers into Center City and University City every year, and most of them spend their Philly years dating through apps aimed at New York. The city has the crowd. It just never had the room.",
          "Our Philadelphia shows exist because the DMs would not stop. The first rooms proved the point: this city shows up loud, votes hard and stays late at the mixer.",
        ],
      },
      {
        heading: "What the Hamilton Street show is like",
        paragraphs: [
          "Next In Line Comedy gives the show a proper standup room: low ceiling, close seats, zero places for a blind date to hide. Two Philly singles meet on stage for the first time, the hosts run the date, the crowd reacts like it has money on the outcome and the mixer after collapses the distance between University City, Fishtown and the suburbs into one bar.",
          "Grab tickets below before the next one sells through, or apply to be a contestant and show the city what confident looks like north of Washington Avenue.",
        ],
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
