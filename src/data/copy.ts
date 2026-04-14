/**
 * Site-wide copy and content strings.
 * All user-facing text should live here or in other data/ files,
 * never hardcoded in components.
 */

export const SITE = {
  name: "Garam Masala Dating",
  tagline: "NYC's #1 Live South Asian Dating Show",
  description:
    "Garam Masala Dating is NYC's #1 live desi dating show where South Asian singles go on a blind date in front of a packed house. Our hosts Surbhi and Wyatt guide the chaos with stand-up, crowd work, and genuine matchmaking instincts. Every show ends with a singles mixer where the audience gets to continue the experiment.",
  shortDescription:
    "New York City's #1 live desi comedy dating show. Real singles. Real dates. 250-person audience. Bi-weekly in Manhattan.",
  footerLine: "NYC's #1 live desi dating show. Hosted by Surbhi & Wyatt.",
  hosts: "Surbhi & Wyatt",
  ogImageAlt: "Garam Masala Dating: NYC's #1 live desi dating show",
} as const;

export const STATS = [
  { num: "40+", label: "Shows" },
  { num: "2K+", label: "Audience" },
  { num: "100%", label: "One Night Stand Rate" },
  { num: "13", label: "Couples Matched" },
  { num: "10M+", label: "Views" },
] as const;

export interface Testimonial {
  quote: string;
  author: string;
  location: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I came alone expecting a chill Friday night out. I left with someone's number and a story I've now told forty times.",
    author: "Priya, 27",
    location: "New York City",
  },
  {
    quote:
      "Surbhi and Wyatt are genuinely unhinged in the best way. Laughed until I cried. Best live comedy show in NYC right now.",
    author: "Dev, 31",
    location: "Chicago",
  },
  {
    quote:
      "Best date night we've had in years, and we're already dating. The energy in that room was something else entirely.",
    author: "Ava & Rohan",
    location: "Audience, NYC",
  },
];

export interface FaqItem {
  q: string;
  short: string;
  long: string;
}

export const HOME_FAQS: FaqItem[] = [
  {
    q: "What is Garam Masala Dating?",
    short:
      "Garam Masala Dating is NYC's #1 live desi dating show. A 90-minute live event where two real singles go on a first date on stage in front of a live audience, hosted by comedians Surbhi and Wyatt.",
    long: "The show combines stand-up comedy, live matchmaking, and audience participation. Two strangers meet for the first time on stage. They go through a date full of questions, games, and genuine moments with a packed house watching. At the end, the audience votes on whether they should get a second date. Then we throw a singles mixer in the same venue so the audience can continue the magic themselves. It\u2019s part comedy show, part reality TV, part social experiment, and entirely unforgettable.",
  },
  {
    q: "How do I get on stage as a dater?",
    short:
      'Apply through our <a href="/apply">casting form</a> and we\u2019ll reach out if you\u2019re selected. You can also <a href="/tickets">buy a ticket</a> and steal your way on stage from the audience. We pull brave souls up at every show.',
    long: "We receive hundreds of applications per season and review every one. We look for people who are genuinely single, comfortable with being the center of attention, and up for an unpredictable night. If you\u2019re not selected in advance, don\u2019t worry. At every show, Surbhi asks the audience for volunteers. Some of our most memorable moments have come from people who decided to raise their hand on the night.",
  },
  {
    q: "Is the show only for South Asian / desi people?",
    short:
      "Absolutely not. Everyone is welcome. The show has a desi cultural flavor, but love and comedy are universal. We\u2019ve matched people of every background.",
    long: "Our audience is beautifully mixed. While the show draws heavily from New York\u2019s South Asian diaspora, roughly 40% of our audience at every show is non-desi. Our daters have been from India, Pakistan, Sri Lanka, Bangladesh, the US, the UK, and beyond. If you think love and chaos are interesting regardless of your background, you belong here.",
  },
  {
    q: "Do I have to participate if I buy a ticket?",
    short:
      "Not at all. Most of our audience comes to watch, drink, and laugh. Participation is entirely voluntary. No one gets pulled up without agreeing.",
    long: "Audience voting is the only thing everyone does, and that\u2019s just raising your hand. Beyond that, nothing is required. About 95% of attendees watch from their seats the whole evening. The other 5% raise their hands when Surbhi asks for volunteers, and from there it\u2019s their choice entirely.",
  },
  {
    q: "How long is the show and what happens after?",
    short:
      "The show runs approximately 90 minutes, followed by a free singles mixer at the same venue where the show took place.",
    long: "Doors open 30 minutes before showtime. The main show is 90 minutes of live comedy and dating. After the final curtain, we transition into a singles mixer. Same space, music comes on, and the energy from the show carries everyone forward. The mixer runs for about an hour and is included with your ticket. It\u2019s where a surprising number of actual connections happen.",
  },
];

export const MARQUEE_ITEMS = [
  "NYC's #1 Live Desi Dating Show",
  "40+ Sold-Out Shows",
  "10M+ Views on Social",
  "13 Couples Matched",
  "250-Person Live Audience",
  "Free Singles Mixer After Every Show",
];

/** Page-level content strings that aren't tied to a data model. */
export const PAGES = {
  home: {
    description:
      "Garam Masala Dating is New York City's #1 live desi dating show. Watch real South Asian singles go on blind dates on stage in front of 250 people. Hosted by comedians Surbhi & Wyatt. Tickets available now.",
  },
  tickets: {
    intro:
      "Garam Masala Dating is the #1 live desi dating show and South Asian singles mixer. Grab tickets on Eventbrite.",
  },
  links: {
    subtitle: "NYC's hottest live desi dating show 🌶️",
  },
} as const;

export const APPLY_PAGE = {
  subtitle: "NYC's #1 live desi dating show 🌶️",
  introText:
    "Garam Masala is a dating show where sparks fly, secrets slip, and matches are made. We're casting bold, funny, attractive personalities who are down to flirt, overshare, and maybe fall in love… or at least cause chaos. Whether you're straight, queer, unsure, or just here for the plot, we want personality!",
  requirements: [
    "18+",
    "Comfortable on camera",
    "Single (for the night 👀)",
  ] as readonly string[],
  noConsentWarning:
    "Selecting No means you will not be considered. You must be okay going viral to apply.",
} as const;

export const EVENTS = {
  ticketCta: "Grab My Spot",
} as const;

export const EXPERIENCE_STEPS = [
  {
    title: "Arrive & Settle In",
    text: "Doors open 30 minutes early. Grab a drink, find your seat, and settle into the energy. The venue is intimate  with 250 seats, come early to grab one with the best view.",
  },
  {
    title: "The Main Event",
    text: "Two real singles meet for the first time on stage. Surbhi and Wyatt guide the date with stand-up, games, and crowd work. The audience drives the chaos.",
  },
  {
    title: "The Decision",
    text: "At the end of the date, the audience votes. Then the daters decide: second date or not? The room erupts either way.",
  },
  {
    title: "Singles Mixer",
    text: "After the show, the venue transforms into a singles mixer. Same room, live DJ, and the energy from the show carries everyone forward. Included with your ticket.",
  },
];
