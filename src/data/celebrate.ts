/**
 * All content for the /celebrate private party & celebration events page.
 * Never hardcode any of this in the component.
 */

export const CELEBRATE_COPY = {
  bookingEmail: "contact@garammasaladating.com",
  heroEyebrow: "Parties & Private Celebrations",
  heroHeadline: "Set Up Your Single Friends. No Cameras. Just the Show.",
  heroSub:
    "Birthday. Bachelor party. Bachelorette. Rehearsal dinner. Wedding reception. Retirement. We bring the full live dating show to your celebration. No recording. No content. Flat fee.",
  heroNote:
    "Email us with your occasion, date and guest count. We respond within 24 hours.",
  noCameraNote:
    "This is a private show. We do not record, stream or capture any content. Complete privacy. What happens at your party stays at your party.",
  showFormatBody: [
    "We bring the full Garam Masala Dating show to your event. Surbhi and Wyatt host live blind dates on stage while they run the comedy, crowd work and matchmaking in real time. Your guests aren't watching a performance. They're part of one.",
    "The format is simple. Real singles from your group go on short blind dates on stage. The audience watches, reacts, and votes. By the third date the room is electric. Nobody is checking their phone. People who've never spoken are suddenly very loud about who should pick whom.",
    "After the show, Surbhi stays in the room playing matchmaker. The barriers are already down. The conversations that happen in the next hour are real. That's the whole point.",
  ],
  ctaHeadline: "Ready to Make It Happen?",
  ctaBody:
    "Email us with your occasion, date, venue and guest count. We reply within 24 hours with a flat-fee quote.",
  ctaNote: 'Subject "Private Party Inquiry" gets a response within 24 hours.',
} as const;

export interface OccasionType {
  icon: string;
  label: string;
  description: string;
}

export const OCCASION_TYPES: OccasionType[] = [
  {
    icon: "🥂",
    label: "Bachelor Party",
    description:
      "Your crew's single friends go on real blind dates on stage. The bachelor watches. The room loses its mind. Nobody forgets it.",
  },
  {
    icon: "👑",
    label: "Bachelorette Party",
    description:
      "Surbhi sets up whoever needs setting up. The bride-to-be calls every shot. The room gets very invested very fast.",
  },
  {
    icon: "🎂",
    label: "Milestone Birthday",
    description:
      "30s, 40s, 50s. Pick the single friends who need a push. We put them on stage and let the room decide.",
  },
  {
    icon: "🍾",
    label: "Rehearsal Dinner",
    description:
      "The night before the wedding. The whole wedding party is in one room. The single ones are right there. Set them up.",
  },
  {
    icon: "🎊",
    label: "Wedding Reception",
    description:
      "After the ceremony the room is already in party mode. A live dating show takes the energy somewhere a DJ can't.",
  },
  {
    icon: "🥳",
    label: "Retirement Party",
    description:
      "The retiree's kids need love. Their grandkids need love. We put them on stage and the whole room plays matchmaker.",
  },
  {
    icon: "💕",
    label: "Anniversary Party",
    description:
      "Celebrate the couple. Give their single friends hope. The best anniversary party their friends have ever attended.",
  },
];

export interface CelebrateInclusion {
  title: string;
  description: string;
}

export const CELEBRATE_INCLUSIONS: CelebrateInclusion[] = [
  {
    title: "The Full Show",
    description:
      "Surbhi and Wyatt run the entire show. Real blind dates on stage, crowd work, comedy and live matchmaking. 40+ shows. Zero dead air.",
  },
  {
    title: "Complete Privacy",
    description:
      "We do not record, stream or publish the show. No cameras. No content. What happens at your party stays there.",
  },
  {
    title: "Your Singles on Stage",
    description:
      "We cast contestants exclusively from your group. You tell us who needs to be set up. We make it happen.",
  },
  {
    title: "Flat Fee Pricing",
    description:
      "One price covers everything. No per-head charges, no hidden costs. Email us for a quote specific to your occasion.",
  },
  {
    title: "Custom Event Elements",
    description:
      "Birthday callouts, retirement roasts, reception playlists. Every private show is built around your occasion.",
  },
  {
    title: "Post-Show Mixer",
    description:
      "After the show Surbhi stays in the room playing matchmaker. People are warmed up. The conversations that follow are real.",
  },
];

export interface CelebrateTestimonial {
  quote: string;
  author: string;
  role: string;
}

export const CELEBRATE_TESTIMONIALS: CelebrateTestimonial[] = [
  {
    quote:
      "We did it for my brother's bachelor party. He picked his three single groomsmen as contestants. By the end of the night two of them had numbers. The whole group was screaming at the stage for two hours.",
    author: "Kiran S.",
    role: "Best Man, NYC",
  },
  {
    quote:
      "I threw a 40th birthday party and was nervous about the privacy thing since it was mostly family. They genuinely do not record anything. The birthday girl cried laughing. Everyone is still talking about it.",
    author: "Neha P.",
    role: "Party Host, Brooklyn",
  },
  {
    quote:
      "We had it at our wedding reception after dinner. The guests who were single went on stage. By the end of the night the DJ was playing to a room that had already found each other.",
    author: "Priya & Arjun",
    role: "Newlyweds, Manhattan",
  },
];

export interface CelebrateFaq {
  q: string;
  a: string;
}

export const CELEBRATE_FAQS: CelebrateFaq[] = [
  {
    q: "How is this different from the corporate show?",
    a: "Same format, different energy. The corporate show is for teams and companies. The celebration show is for your people: friends, family, wedding parties, reunion groups. The humor is warmer. The stakes are more personal. The crowd gets more invested.",
  },
  {
    q: "Can we guarantee specific people go on stage?",
    a: "Yes. You send us a list of who you want as contestants. We handle the casting, the introductions and the pacing. You just show up.",
  },
  {
    q: "What occasions work best?",
    a: "Bachelor and bachelorette parties are our most popular celebration format. Birthday parties and wedding receptions are close behind. The show works best when there are at least a few single people in the room who are game for it.",
  },
  {
    q: "How far in advance do we need to book?",
    a: "Four to six weeks is ideal. We've done it in two. Email contact@garammasaladating.com with your date and we'll check availability.",
  },
  {
    q: "Is it really completely private with no recording?",
    a: "Completely. We do not bring cameras or recording equipment. We do not post content from private shows. Nothing from your event ends up online. That's a commitment, not a policy.",
  },
  {
    q: "What does the flat fee cover?",
    a: "Everything: Surbhi, Wyatt, the full show, the post-show mixer, custom elements for your occasion, and travel within the NYC metro area. No per-head charges. Email us for a specific quote.",
  },
];
