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
    "Most corporate events are forgettable. A live South Asian comedy dating show in front of your team is not. We've turned Diwali dinners, company anniversaries, client appreciation nights, and team offsites into the kind of event people still bring up months later.",
  heroCta: "Book a Private Show",
  heroNote:
    "Caleb is our dedicated manager. He handles all private bookings personally — expect a response within 24 hours with availability, pricing, and next steps.",
  showFormatHeadline: "Real singles. Real dates. Your crowd loses their minds.",
  showFormatBody: [
    "We bring the full Garam Masala Dating show to your event. That means real singles — either from your group or people we cast — go on blind dates on stage while our hosts Surbhi and Wyatt run the entire thing live: the comedy, the crowd work, the audience voting, and the real-time matchmaking.",
    "Here's what the night actually looks like: your guests arrive and mingle. The lights go down. Surbhi opens with stand-up that roasts the audience into submission. Then the dates start — each one is a 5–7 minute round where two contestants sit on stage, answer questions, and the whole room reacts in real time. Wyatt narrates like a sports commentator. The audience votes on who should go on a second date. By the third round, the room is electric.",
    "Nobody has to do anything they don't want to. The show is designed so the entire room is part of the experience whether someone's on stage or sitting in the back row. But fair warning: once the energy kicks in, people always volunteer. That's the magic. The room warms up in about four minutes flat.",
    "Every show ends with a structured post-show mixer where the audience actually meets each other — not the awkward corporate networking where everyone stares at their phone. Think speed-round conversations, Surbhi playing matchmaker in real time, and people exchanging numbers before they leave.",
  ],
  ctaHeadline: "Ready to Book?",
  ctaBody:
    "Email Caleb — our manager — with your date, approximate guest count, venue (or if you need venue help), and anything you want us to know about your group. He'll come back within 24 hours with availability, a custom quote, and ideas for how to make it unforgettable.",
  ctaNote:
    'Use the subject line "Private Show Inquiry" and it goes straight to Caleb.',
} as const;

export interface AudienceTier {
  range: string;
  label: string;
  description: string;
  ideal: string;
}

export const AUDIENCE_TIERS: AudienceTier[] = [
  {
    range: "50–100",
    label: "Intimate",
    description:
      "Full show energy in a tight-knit room. Everyone feels like they're in on the joke. The dates feel more personal, the crowd work hits harder, and the mixer at the end means everyone actually meets everyone. This is the format where someone on your team will definitely end up on stage — and they'll love it.",
    ideal:
      "Team dinners, milestone celebrations, birthday parties, small client events",
  },
  {
    range: "100–175",
    label: "Mid-Size",
    description:
      "Our most popular format for corporate bookings. Big enough to feel like a real show with genuine energy and anticipation, but small enough that Surbhi and Wyatt can work the crowd personally. The room stays personal while the production feels polished. This is the sweet spot.",
    ideal:
      "Company holiday parties, Diwali celebrations, department offsites, client appreciation nights",
  },
  {
    range: "175–250",
    label: "Full House",
    description:
      "The complete Garam Masala experience — the same energy as our public shows in Manhattan. Standing ovations, chaotic audience voting, genuine matchmaking, and the kind of collective energy that only happens when you pack 200+ people into a room and give them something real to react to. This is a show.",
    ideal:
      "Company-wide events, launch parties, annual celebrations, multi-team gatherings",
  },
];

export interface InclusionItem {
  title: string;
  description: string;
}

export const INCLUSIONS: InclusionItem[] = [
  {
    title: "Professional Hosts — Surbhi & Wyatt",
    description:
      "Our hosts run the entire show from start to finish — the stand-up, the crowd work, the contestant introductions, the audience voting, and the post-date debrief. Surbhi brings the chaos and the charm. Wyatt brings the commentary and the comedic pacing. Together they've hosted 40+ live shows and kept rooms of 250 people completely engaged for 90 minutes straight. No awkward silences. No dead air. Just a room that stays alive from the first joke to the last number exchange.",
  },
  {
    title: "Full Production Setup",
    description:
      "Show structure, pacing, scripted segments, sound, lighting, and stage management are all handled by our team. We bring a full run-of-show with timed segments, audience interaction beats, and transitions that keep the energy moving. You don't need to provide anything except the space and the guests. We turn your venue into a dating show set — and we've done it in rooftop bars, restaurant private rooms, event halls, and coworking spaces.",
  },
  {
    title: "Venue Coordination",
    description:
      "We've produced shows at venues all over Manhattan, Brooklyn, and Jersey City — we know exactly what layout, sound setup, and seating arrangement works for a live show. If you have a venue, we'll work with your event coordinator to make it show-ready. If you need a venue, we'll recommend spaces we've partnered with and handle the logistics end-to-end: capacity, AV requirements, stage setup, bar coordination, load-in timing, and day-of management.",
  },
  {
    title: "Post-Show Mixer & Networking",
    description:
      "Every show ends with a structured mixer designed to get people actually talking — not the awkward standing-around that happens at most corporate events. Surbhi plays real-time matchmaker, Wyatt keeps the energy up, and we run structured conversation prompts that give people a reason to approach each other. For corporate events, this doubles as the best networking session your company has ever run — because people are already laughing and loose from the show.",
  },
  {
    title: "Custom Show Elements",
    description:
      "We tailor every private show to the group. That means incorporating your company name, team inside jokes, cultural references, and custom segments built around your event's theme. Doing a Diwali party? We'll weave in cultural moments. Celebrating a company milestone? We'll roast your CEO (gently). The more context you give us about your team, the better the show gets. Every private show is different — that's the point.",
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
      "We booked Garam Masala Dating for our Diwali team dinner — 80 engineers, designers, and PMs in a private room in the East Village. Within five minutes the entire room was screaming at the contestants to pick each other. People who had never spoken outside of Slack were suddenly in a group chat planning their next team night. Three months later, it's still the only company event anyone talks about. We've already rebooked for next quarter.",
    author: "Priya M.",
    role: "Engineering Lead, NYC Tech Company",
  },
  {
    quote:
      "I've planned over 50 corporate events in my career — holiday parties, team retreats, speaker series, you name it. This is the only one where nobody checked their phone once. Not once. Surbhi had the whole room eating out of her hand in the first three minutes, and Wyatt's commentary had people genuinely crying laughing. Our CEO pulled me aside after and said it was the best thing we've ever done for team culture. That's never happened before.",
    author: "Aisha K.",
    role: "Head of Culture & Belonging, Financial Services Firm",
  },
  {
    quote:
      "We did it as a client entertainment night instead of the usual rooftop cocktail situation. Twelve of our biggest clients in a room, watching real people go on dates while two comedians narrate the whole thing live. The energy was unreal. By the end of the night our clients were exchanging numbers with each other and asking us when the next one is. We've never gotten that kind of engagement from a client event — not even close. Already planning the next one for Q3.",
    author: "Rohan V.",
    role: "Partner, Management Consulting Firm",
  },
];

export interface CorporateFaq {
  q: string;
  a: string;
}

export const CORPORATE_FAQS: CorporateFaq[] = [
  {
    q: "Do guests have to participate or go on dates?",
    a: "No — all contestant participation is 100% voluntary. Nobody is forced on stage. The show is designed so the entire room is entertained and involved whether someone's a contestant, voting from the audience, or sitting in the back row with a drink. That said, once the energy kicks in, people almost always volunteer. We've never had a show where we couldn't find willing contestants.",
  },
  {
    q: "What venues work for a private show?",
    a: "We've done shows in restaurant private rooms, rooftop bars, coworking event spaces, hotel ballrooms, and dedicated comedy venues. The minimum requirement is room for your guests seated plus a small open area for the stage — roughly 8×6 feet. We need basic sound (a mic and speaker) and some control over lighting. If your venue has AV, great. If not, we bring our own. If you don't have a venue yet, our manager Caleb can recommend partner spaces in Manhattan, Brooklyn, and Jersey City that we know work perfectly for the show format.",
  },
  {
    q: "How far in advance do we need to book?",
    a: "Four to six weeks is ideal — it gives us time to customize the show for your group, coordinate with your venue, and cast contestants if needed. That said, we've pulled off shows in as little as two weeks when the timing works. Reach out to Caleb at caleb@garammasaladating.com as early as you can and he'll let you know what's possible for your timeline.",
  },
  {
    q: "How much does a private show cost?",
    a: "Pricing depends on your audience size, venue, and any custom elements you want. Caleb — our manager — will put together a custom quote based on your specific event. Email caleb@garammasaladating.com with your guest count, date, and any details about the event and he'll respond within 24 hours with pricing and availability.",
  },
  {
    q: "Can we customize the show for our company or event theme?",
    a: "Absolutely — and we strongly encourage it. We can weave in your company name, team culture, inside jokes, and event-specific themes. We've done Diwali-themed shows with cultural moments, company anniversary shows where we roasted the founding team, and client nights with industry-specific humor. We'll ask you for context about your team during the planning process, and our writers build custom segments around what you give us. Every private show is genuinely different.",
  },
  {
    q: "What happens during the post-show mixer?",
    a: "After the main show (usually 60–90 minutes), we transition into a structured mixer. This isn't the awkward 'mingle with strangers' format — Surbhi and Wyatt stay active in the room, facilitating introductions, running mini-games, and playing real-time matchmaker. We use structured conversation prompts to give people a reason to approach each other. For corporate events, this is where the real networking happens — people are already warmed up and laughing from the show, so the barriers are down. It typically runs 30–45 minutes.",
  },
];
