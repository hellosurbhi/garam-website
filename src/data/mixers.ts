import { SOCIAL_URLS } from "@/data/socials";

/**
 * Single source of truth for the next singles mixer. Both /cuffing-season
 * (the share link for this specific event) and /singles-mixers (the
 * evergreen SEO page) import from here. Kept out of events.ts on purpose:
 * that file feeds /tickets, /links and the sitemap, and would publish the
 * Partiful URL ungated on all three (see src/data/CLAUDE.md never-delete
 * rule, which does not apply here since this is not a show date).
 */
export const NEXT_MIXER = {
  partifulUrl: "https://partiful.com/e/BQGqChQwErz6r3PmmTjD",
  name: "Cuffing Season Singles Mixer",
  isoDate: "2026-09-14",
  startTime: "18:00",
  endTime: "21:00",
  neighborhood: "West Village",
  venueName: "Romae Cucina Italo Argentina",
  streetAddress: "57 7th Ave S",
  city: "New York",
  state: "NY",
  country: "US",
  free: true,
} as const;

/** Shared localStorage key: a lead who signed up on either page skips the form on return visits to either page. */
export const MIXER_STORAGE_KEY = "gmd-mixer-rsvped";

export interface MixerFaq {
  q: string;
  a: string;
}

export const SINGLES_MIXERS = {
  meta: {
    title: "Singles Mixers in NYC | Garam Masala Dating",
    description:
      "Free singles mixers in NYC from Garam Masala Dating, the live comedy dating show that has set up more than 40 couples this year. Get the next mixer's date and location.",
  },
  hero: {
    eyebrow: "Singles Mixers in NYC",
    headline: "Not ready for the stage? Come to the mixer instead.",
    sub: "Garam Masala Dating is the live comedy dating show that has set up more than 40 couples this year. If two strangers going on a blind date in front of a crowd is not your thing, we also throw regular singles mixers. No stage, no spotlight, just a room full of people who are actually looking.",
    ctaLabel: "Get the Next Mixer Date",
  },
  form: {
    heading: "Get the next mixer's date and location",
    sub: "Drop your name and email and we will send you the details.",
    namePlaceholder: "Your name",
    emailPlaceholder: "Your email",
    submitLabel: "Send Me the Details",
    submittingLabel: "Sending...",
    nameError: "Please enter your name.",
    errorMessage: "Something went wrong. Try again.",
    successHeadingUpcoming: "You're on the list.",
    successBodyUpcoming:
      "Check your email for the details. You can also open the invite right now.",
    successLinkLabel: "Open the Invite",
    successHeadingPast: "You're on the list.",
    successBodyPast: "We will email you the moment the next mixer is set.",
  },
  whoWeAre: {
    eyebrow: "Who We Are",
    heading: "America's number one live comedy dating show",
    bodyHtml: `About 250 people pack a room every week to watch two strangers go on a blind date live on stage. It is part dating show, part stand up set, part group therapy, and it has set up more than 40 couples this year alone. Watch full episodes on <a href="${SOCIAL_URLS.youtube}">our YouTube channel</a> to see what you are getting into.`,
  },
  twoWays: {
    heading: "Two ways to meet someone through Garam Masala Dating",
    showBodyHtml:
      'Come watch a live show. <a href="/tickets">Grab tickets</a> and you get comedy, a real blind date playing out in front of you, and a singles mixer with the whole room right after. You do not have to be on stage to be part of it.',
    mixerBodyHtml:
      'Or skip the show and come straight to a <a href="#mixer-form">standalone singles mixer</a> like the one below. Same track record, no crowd of 250 watching you talk to someone.',
    closingLine:
      "Come to one. Come to both. Either way you are not doing this alone anymore.",
  },
  nextEventCard: {
    eyebrowUpcoming: "The Next One",
    headingPast: "The Next One Is Coming",
    bodyPast:
      "We just wrapped a mixer at Romae in the West Village. Get on the list below and you will be the first to hear about the next one.",
  },
  finePrint:
    "Must be 21 or older. Space is limited, so get on the list before the day of the event.",
  faqs: [
    {
      q: "Do I have to get on stage at a singles mixer?",
      a: 'No. Our singles mixers have no stage and no spotlight. That is the live comedy dating show\'s job, and being a contestant there is a completely separate, optional thing. If you are curious about that too, you can <a href="/apply">apply here</a>.',
    },
    {
      q: "Is there a cover charge?",
      a: "No. Entry is free, and the first 50 singles through the door get two free drinks. Bring yourself.",
    },
    {
      q: "Do I need to come with a group?",
      a: "Most people show up solo. That is kind of the point. You will end up talking to people you do not already know.",
    },
    {
      q: "Who actually comes to these mixers?",
      a: "Singles in New York City, mostly in their twenties and thirties, who want to meet someone in person instead of swiping. Many of them have also come to a Garam Masala Dating show.",
    },
    {
      q: "How is this different from a random singles event?",
      a: "We are the team behind the number one live comedy dating show, not a mixer company running a random event. We have a track record: more than 40 couples set up this year.",
    },
    {
      q: "What happens after I sign up?",
      a: "You get sent straight to the event page with the exact time and address, and we will email you the details too.",
    },
  ] satisfies MixerFaq[],
};
