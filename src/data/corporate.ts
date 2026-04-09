/**
 * All content for the /corporate private & corporate events page.
 * Never hardcode any of this in the component.
 */

export const CORPORATE_COPY = {
  agentEmail: "caleb@garammasaladating.com",
  agentName: "Caleb",
  partnerEmail: "partnerships@garammasaladating.com",
} as const;

export interface AudienceTier {
  range: string;
  label: string;
  description: string;
}

export const AUDIENCE_TIERS: AudienceTier[] = [
  {
    range: "50–100",
    label: "Intimate",
    description:
      "Full show energy in a tight-knit setting. Everyone feels like they're in on the joke. Great for team dinners and milestone celebrations.",
  },
  {
    range: "100–175",
    label: "Mid-Size",
    description:
      "Our most popular format. Big enough to feel electric, small enough that the room stays personal. Works for company parties and client events.",
  },
  {
    range: "175–250",
    label: "Full House",
    description:
      "The complete Garam Masala experience — standing ovations, chaos, genuine matchmaking. For companies that want to go all out.",
  },
];

export interface InclusionItem {
  title: string;
  description: string;
}

export const INCLUSIONS: InclusionItem[] = [
  {
    title: "Professional Hosts",
    description:
      "Surbhi and Wyatt run the entire show — from crowd work and comedy to contestant introductions and post-date debrief. No awkward silences. No dead air. Just a room that stays alive.",
  },
  {
    title: "Full Production",
    description:
      "Show structure, pacing, sound, and scripted segments are all handled. You just show up. We turn your venue into a dating show set.",
  },
  {
    title: "Venue Coordination",
    description:
      "We've worked with venues all over Manhattan and know exactly what makes a space work for a live show. We handle logistics, setup, and the inevitable last-minute stuff.",
  },
  {
    title: "Post-Show Mixer",
    description:
      "Every show ends with a structured mixer where the audience actually meets each other. Less awkward cocktail party, more 'I can't believe I met her here.'",
  },
];

export interface CorporateTestimonial {
  quote: string;
  author: string;
  role: string;
}

export const CORPORATE_TESTIMONIALS: CorporateTestimonial[] = [
  {
    quote:
      "We booked GMD for our Diwali team dinner and it was the best corporate event we've ever done. 80 people, all laughing within five minutes. Still talking about it three months later.",
    author: "Priya M.",
    role: "Engineering Lead, NYC Tech",
  },
  {
    quote:
      "I've planned 50+ corporate events. This is the only one where nobody checked their phone once. The energy Surbhi and Wyatt bring is genuinely unmatched.",
    author: "Aisha K.",
    role: "Culture & Belonging, Financial Services",
  },
  {
    quote:
      "We did it as a client entertainment night instead of the usual rooftop bar situation. Our clients asked when we're doing it again before the night was even over.",
    author: "Rohan V.",
    role: "Partner, Consulting Firm",
  },
];

export interface CorporateFaq {
  q: string;
  a: string;
}

export const CORPORATE_FAQS: CorporateFaq[] = [
  {
    q: "Do guests have to participate?",
    a: "No. All contestant participation is 100% voluntary. The show is designed so the entire room is entertained whether someone's on stage or sitting in the back row — the audience is always part of the experience.",
  },
  {
    q: "What venues can host a private show?",
    a: "We can work with your venue, or recommend spaces we've partnered with in Manhattan and Brooklyn. The minimum requirement is room for your guests seated plus a small open area for the stage. We've made surprisingly compact spaces work.",
  },
  {
    q: "How far in advance do we need to book?",
    a: "Four to six weeks is ideal for the best availability and to give us time to customize the show for your group. That said, reach out even if your timeline is tighter — we'll let you know what's possible.",
  },
  {
    q: "Is the show customizable for our company or event?",
    a: "Yes. We can incorporate your company name, internal jokes, team dynamics, and custom segments built around your group. The more you tell us about your team, the better the show gets. We've done Diwali parties, company anniversaries, team offsites, and client nights — each one different.",
  },
];
