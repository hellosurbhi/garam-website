/**
 * All content for the /desi-events South Asian private events page.
 * Never hardcode any of this in the component.
 */

export const DESI_EVENTS_COPY = {
  bookingEmail: "contact@garammasaladating.com",
  heroEyebrow: "South Asian Events & Celebrations",
  heroHeadline:
    "Set Up Your Single Cousins. Your Kids. Your Grandkids. Live on Stage.",
  heroSub:
    "Sangeet. Roka. Engagement party. Indian wedding reception. Desi birthday. Desi retirement. We bring the full live dating show to your family celebration. No recording. Complete privacy. Flat fee.",
  heroNote:
    "Email us with your occasion, date and guest count. We respond within 24 hours.",
  noCameraNote:
    "Private show only. No recording, no streaming, no published content. Perfect for family events where everyone deserves complete privacy.",
  showFormatBody: [
    "We bring the full Garam Masala Dating show to your event. Surbhi and Wyatt host real blind dates on stage while they run the comedy, crowd work and matchmaking live. Your family isn't watching a performance. They're in it.",
    "The format is simple. Real singles from your group go on short blind dates in front of the room. The audience reacts, debates and cheers. By the third date the aunties are yelling opinions and the uncles are invested in the outcome. Nobody expected to care this much.",
    "After the show, Surbhi stays in the room playing matchmaker. People are already warmed up. Conversations that might have taken months happen in the next hour. That's the whole point.",
  ],
  ctaHeadline: "Ready to Book?",
  ctaBody:
    "Email us with your occasion, date, venue and guest count. We reply within 24 hours with a flat-fee quote.",
  ctaNote:
    'Subject "South Asian Event Inquiry" gets a response within 24 hours.',
} as const;

export interface DesiOccasionType {
  icon: string;
  label: string;
  description: string;
}

export const DESI_OCCASION_TYPES: DesiOccasionType[] = [
  {
    icon: "✨",
    label: "Sangeet",
    description:
      "The most fun sangeet entertainment that isn't choreographed dance. Live blind dates on stage, crowd work and pure energy. No rehearsal required.",
  },
  {
    icon: "💍",
    label: "Roka Ceremony",
    description:
      "Celebrate the couple. Set up their single cousins and friends. The most memorable roka activity anyone in your family has ever seen.",
  },
  {
    icon: "🎊",
    label: "Engagement Party",
    description:
      "A live dating show at an engagement party hits different. The room already believes in love. We give them a show to match.",
  },
  {
    icon: "🥂",
    label: "Indian Wedding Reception",
    description:
      "After the ceremony and the pheras, the reception is the party. A live dating show takes it somewhere the DJ can't.",
  },
  {
    icon: "🎂",
    label: "Desi Milestone Birthday",
    description:
      "Set up the single family members and friends. The birthday person picks who goes on stage. The room picks who they like.",
  },
  {
    icon: "🥳",
    label: "Desi Retirement Party",
    description:
      "The retiree's grandkids need love. Their nieces and nephews need love. We put them on stage and the whole family plays matchmaker.",
  },
];

export interface DesiInclusion {
  title: string;
  description: string;
}

export const DESI_INCLUSIONS: DesiInclusion[] = [
  {
    title: "The Full Show",
    description:
      "Surbhi and Wyatt run the entire show. Real blind dates on stage, crowd work, comedy and live matchmaking. 40+ shows. Zero dead air.",
  },
  {
    title: "Complete Privacy",
    description:
      "We do not record, stream or publish the show. No cameras at your family event. Nothing from your celebration ends up online.",
  },
  {
    title: "Your Singles on Stage",
    description:
      "You send us a list of who needs to be set up. We handle the casting, the introductions and the pacing. Your family does the cheering.",
  },
  {
    title: "Flat Fee Pricing",
    description:
      "One price covers everything. No per-head charges. Email us for a quote specific to your occasion and guest count.",
  },
  {
    title: "Cultural Customization",
    description:
      "Sangeet energy, Bollywood playlist, Hindi punchlines, family-specific inside moments. Every private show is built around your occasion.",
  },
  {
    title: "Post-Show Mixer",
    description:
      "After the show Surbhi stays in the room playing matchmaker. Aunties approve. Uncles weigh in. The conversations that follow are real.",
  },
];

export interface DesiTestimonial {
  quote: string;
  author: string;
  role: string;
}

export const DESI_TESTIMONIALS: DesiTestimonial[] = [
  {
    quote:
      "We had it at our sangeet instead of a DJ set. My cousins went on stage as contestants. The aunties were screaming. My naniji picked a favorite and refused to change her opinion. It was the best night of the whole wedding weekend.",
    author: "Anjali R.",
    role: "Bride, NJ",
  },
  {
    quote:
      "My parents were worried about the recording thing because it's a family event. They genuinely don't record anything. My single brother went on stage and came off with a number. My mom has not stopped talking about it.",
    author: "Rohan K.",
    role: "Son of the Birthday Boy, NYC",
  },
  {
    quote:
      "We did it for a roka party and it completely changed the energy. Instead of the usual dinner and speeches, we had the whole family invested in who was going to end up with whom. Everyone stayed two hours longer than planned.",
    author: "Priya M.",
    role: "Maid of Honor, Queens",
  },
];

export interface DesiFaq {
  q: string;
  a: string;
}

export const DESI_FAQS: DesiFaq[] = [
  {
    q: "Is this appropriate for a family event with elders?",
    a: "Yes. The show is fun and irreverent but not explicit. The comedy works because it's warm and relatable, not because it's edgy. We've had grandparents in the front row who ended up being the loudest people in the room.",
  },
  {
    q: "Can we do this at a sangeet if we already have performers?",
    a: "Absolutely. The show works great as a standalone segment before or after performers. Most sangeets run the dating show for 60 to 75 minutes as the main entertainment event, then transition to dancing.",
  },
  {
    q: "Is it really completely private with no recording?",
    a: "Completely. We do not bring cameras or recording equipment. We do not post content from private shows. Nothing ends up on YouTube, Instagram or anywhere else. That's a commitment, not a policy.",
  },
  {
    q: "How far in advance do we need to book?",
    a: "Four to six weeks is ideal. We've done it in two. Email contact@garammasaladating.com with your date and we'll check availability right away.",
  },
  {
    q: "Can the show be in Hindi or mix languages?",
    a: "Surbhi speaks Hindi and can mix languages throughout the show for the right audience. Let us know your crowd when you email and we'll make sure the show fits.",
  },
  {
    q: "What does the flat fee include?",
    a: "Everything: Surbhi, Wyatt, the full show, the post-show mixer, cultural customization for your occasion, and travel within the NYC metro area. No per-head charges. Email us for a specific quote.",
  },
];
