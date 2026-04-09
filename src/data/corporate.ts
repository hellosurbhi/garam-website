/**
 * All content for the /corporate private & corporate events page.
 * Never hardcode any of this in the component.
 */

export const CORPORATE_COPY = {
  agentEmail: "caleb@garammasaladating.com",
  agentName: "Caleb",
  agentTitle: "Manager",
  heroHeadline: "Your Team Deserves a Better Happy Hour",
  heroSub:
    "The #1 live South Asian comedy dating show for your team, your clients, or your next milestone. 50 to 250 guests. We handle everything.",
  heroNote:
    "Caleb is our manager. He handles all private bookings and responds within 24 hours.",
  showFormatBody: [
    "We bring the full Garam Masala Dating show to your event. Real singles go on blind dates on stage while Surbhi and Wyatt run the comedy, the crowd work, and the matchmaking live.",
    "Your guests arrive. The lights go down. By the third date, the room is electric. Nobody checks their phone. People who've never spoken outside of Slack are suddenly screaming at contestants to pick each other.",
    "Every show ends with a mixer where people actually meet each other. Not awkward corporate networking. Real conversations, real connections, real number exchanges.",
  ],
  ctaHeadline: "Ready to Book?",
  ctaBody:
    "Email Caleb, our manager, with your date, guest count, and venue. He'll respond within 24 hours.",
  ctaNote: 'Subject line "Private Show Inquiry" goes straight to Caleb.',
} as const;

export interface AudienceTier {
  range: string;
  label: string;
  description: string;
}

export const AUDIENCE_TIERS: AudienceTier[] = [
  {
    range: "50 to 100",
    label: "Intimate",
    description:
      "Tight room, personal energy. Great for team dinners, birthdays, and milestone celebrations.",
  },
  {
    range: "100 to 175",
    label: "Mid-Size",
    description:
      "Our most popular corporate format. Big enough for real show energy, small enough for Surbhi and Wyatt to work the crowd personally.",
  },
  {
    range: "175 to 250",
    label: "Full House",
    description:
      "The full Garam Masala experience. Standing ovations, chaos, and the kind of energy you only get with 200+ people in a room.",
  },
];

export interface InclusionItem {
  title: string;
  description: string;
}

export const INCLUSIONS: InclusionItem[] = [
  {
    title: "Surbhi & Wyatt",
    description:
      "Our hosts run the entire show. Stand-up, crowd work, matchmaking, and the post-date debrief. 40+ shows. Zero dead air.",
  },
  {
    title: "Full Production",
    description:
      "Sound, lighting, show structure, and pacing. You provide the space and guests. We turn it into a dating show set.",
  },
  {
    title: "Venue Coordination",
    description:
      "We've produced shows at venues across Manhattan, Brooklyn, and Jersey City. Have a venue? We'll make it work. Need one? We'll recommend one.",
  },
  {
    title: "Post-Show Mixer",
    description:
      "Structured mingling where people actually talk. Surbhi plays matchmaker, Wyatt keeps the energy up. The best networking your company has ever done.",
  },
  {
    title: "Custom Show Elements",
    description:
      "We build custom segments around your team, your inside jokes, and your event theme. Diwali parties, company milestones, client nights. Every private show is different.",
  },
  {
    title: "Contestant Casting",
    description:
      "We can cast contestants from your group or bring in singles we've vetted. Either way, the dates are real and the audience goes wild.",
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
      "80 engineers in a private room in the East Village. Within five minutes the entire room was screaming at the contestants. Three months later it's still the only company event anyone talks about.",
    author: "Priya M.",
    role: "Engineering Lead, NYC Tech",
  },
  {
    quote:
      "I've planned 50+ corporate events. This is the only one where nobody checked their phone once. Our CEO said it was the best thing we've ever done for team culture.",
    author: "Aisha K.",
    role: "Head of Culture & Belonging, Financial Services",
  },
  {
    quote:
      "We did it for a client night instead of the usual rooftop bar. Our clients asked when we're doing it again before the night was over.",
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
    a: "No. All participation is voluntary. The show is designed so the whole room is entertained whether someone's on stage or in the back row.",
  },
  {
    q: "What venues work?",
    a: "Restaurant private rooms, rooftop bars, coworking spaces, hotel ballrooms. We need seating for your group plus a small stage area. If you need a venue, Caleb can recommend one.",
  },
  {
    q: "How far in advance do we need to book?",
    a: "Four to six weeks is ideal. We've done it in two. Email caleb@garammasaladating.com and he'll check availability.",
  },
  {
    q: "How much does it cost?",
    a: "Depends on audience size, venue, and customization. Email caleb@garammasaladating.com with your details and Caleb, our manager, will send a custom quote within 24 hours.",
  },
  {
    q: "Can you customize the show?",
    a: "Yes. Company name, team jokes, event themes, cultural moments. We build custom segments around your group. Every private show is different.",
  },
  {
    q: "What happens during the post-show mixer?",
    a: "After the main show (usually 60 to 90 minutes), Surbhi and Wyatt stay in the room facilitating introductions and playing matchmaker. People are already warmed up from the show so the barriers are down. It runs 30 to 45 minutes.",
  },
];
