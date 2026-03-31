export interface PostBlock {
  type: "p" | "h3";
  text: string;
}

export interface JournalPost {
  slug: string;
  title: string;
  metaDescription: string;
  datePublished: string;
  dateModified: string;
  author: string;
  /** First two sentences of the body — used on the index page. */
  excerpt: string;
  body: PostBlock[];
}

export const journalPosts: JournalPost[] = [
  {
    slug: "what-we-learned-from-100-desi-blind-dates",
    title: "What We Learned From 100 Desi Blind Dates",
    metaDescription:
      "After running Garam Masala Dating for over a year and watching hundreds of live blind dates unfold on stage, here's what we actually learned about South Asian dating.",
    datePublished: "2026-03-31",
    dateModified: "2026-03-31",
    author: "Garam Masala Dating",
    excerpt:
      "We've watched a lot of first dates. Not through an app, not on a reality show set — live, on stage, in front of a couple hundred people who have opinions and aren't shy about sharing them.",
    body: [
      {
        type: "p",
        text: "We've watched a lot of first dates. Not through an app, not on a reality show set — live, on stage, in front of a couple hundred people who have opinions and aren't shy about sharing them.",
      },
      {
        type: "p",
        text: "After running Garam Masala Dating for over a year, a few patterns have gotten impossible to ignore.",
      },
      {
        type: "h3",
        text: "The people who are the most \u201Cprepared\u201D almost always flop.",
      },
      {
        type: "p",
        text: "They\u2019ve thought about their answers. They know what they want to say. They\u2019ve workshopped their opener. And they land with a thud. The contestants who win the crowd \u2014 and usually the date \u2014 are the ones who just respond. No performance. The audience can feel the difference immediately.",
      },
      {
        type: "h3",
        text: "Desi dating has a specific brand of overthinking.",
      },
      {
        type: "p",
        text: "There\u2019s a version of this that plays out constantly: someone clearly likes the person across from them, but they\u2019re already running three steps ahead. Is this person serious? Would my parents like them? Is this wasting my time? You can watch someone talk themselves out of a connection in real time. It\u2019s fascinating and a little heartbreaking.",
      },
      {
        type: "h3",
        text: "The question \u201Cwhat do you do?\u201D kills more chemistry than anything else.",
      },
      {
        type: "p",
        text: "When we give contestants open time to ask each other anything, the boring ones ask about careers. The good dates ask something weird, personal, or risky. \u201CWhat do you do?\u201D is a LinkedIn opener. It signals that you\u2019re already evaluating instead of just being curious.",
      },
      {
        type: "h3",
        text: "Vulnerability beats banter every time.",
      },
      {
        type: "p",
        text: "The funny contestants aren\u2019t the ones who tell jokes. They\u2019re the ones who say something honest that happens to be funny because it\u2019s true. The formula is: be more specific, be more honest, and stop trying to land.",
      },
      {
        type: "h3",
        text: "The audience roots harder than you\u2019d expect.",
      },
      {
        type: "p",
        text: "We were worried that the crowd would be cruel \u2014 this is a comedy show, after all. The opposite is true. When a date is going well, the audience is genuinely invested. When it\u2019s going badly, they want someone to rescue the person on stage. People want other people to find something real. That hasn\u2019t changed in a single show.",
      },
      {
        type: "p",
        text: "If you want to see what this looks like live, come to the next one. Or apply to be on it. We promise to only embarrass you a little.",
      },
    ],
  },
  {
    slug: "how-to-prepare-for-a-live-matchmaking-show",
    title: "How to Prepare for a Live Matchmaking Show (Without Psyching Yourself Out)",
    metaDescription:
      "You got cast on Garam Masala Dating. Here\u2019s exactly how to prepare \u2014 what to wear, what to expect on stage, and how to not be the person who chokes in front of 250 people.",
    datePublished: "2026-03-31",
    dateModified: "2026-03-31",
    author: "Garam Masala Dating",
    excerpt:
      "So you applied, you got picked, and now you\u2019re going to go on a blind date in front of 250 strangers. Good.",
    body: [
      {
        type: "p",
        text: "So you applied, you got picked, and now you\u2019re going to go on a blind date in front of 250 strangers. Good. Here\u2019s how to not regret it.",
      },
      {
        type: "h3",
        text: "Know what you\u2019re walking into.",
      },
      {
        type: "p",
        text: "The format is simple: you get introduced to the audience, you meet your date on stage, the hosts ask questions, the audience reacts, and then the two of you decide how it ends. The whole thing runs about 15 minutes per pair. It\u2019s fast. You won\u2019t have time to be nervous for long.",
      },
      {
        type: "h3",
        text: "The golden rule is 20 to 30 second answers.",
      },
      {
        type: "p",
        text: "Not one word. Not a three-minute story. If someone asks what you\u2019re looking for in a partner, give them something real in under 30 seconds and stop. The audience will tell you if they want more \u2014 you\u2019ll hear it. Contestants who monologue lose the room fast.",
      },
      {
        type: "h3",
        text: "Dress like you\u2019re going on a real date.",
      },
      {
        type: "p",
        text: "Because you are. Bold colors work well on stage. Something you feel confident in. If you\u2019re debating between two outfits and one is safer, wear the other one.",
      },
      {
        type: "h3",
        text: "Prepare one thing you can actually do.",
      },
      {
        type: "p",
        text: "We\u2019ll ask if you have a talent. Not a skill. A talent \u2014 something you can demonstrate in 30 seconds. A song, a dance move, an impression, a magic trick. \u201CI\u2019m good at Excel\u201D is not a talent. Think about this ahead of time so you\u2019re not stalling on stage.",
      },
      {
        type: "h3",
        text: "Your opener matters more than your closer.",
      },
      {
        type: "p",
        text: "The first thing you say to your date sets the tone for everything that follows. A generic \u201Cnice to meet you\u201D is a wasted moment. You have an audience, you have a microphone, and you have a person standing in front of you who is also nervous. Use it.",
      },
      {
        type: "h3",
        text: "Being honest is always the right move.",
      },
      {
        type: "p",
        text: "If you\u2019re not feeling it, the audience already knows. Say something true. \u201CI\u2019m not sure we\u2019re compatible but I\u2019m enjoying this\u201D is better content than pretending. Audiences don\u2019t respect fakeness and your date doesn\u2019t deserve it.",
      },
      {
        type: "h3",
        text: "Show up on time.",
      },
      {
        type: "p",
        text: "Guys arrive at 5:20. Women arrive at 5:30. We go through logistics before the show starts and if you\u2019re late, you skip the briefing and go on cold. Don\u2019t do that to yourself.",
      },
      {
        type: "p",
        text: "The rest is just showing up. You\u2019ll be fine.",
      },
    ],
  },
];

/** Sorted newest-first by datePublished. */
export const journalPostsSorted = [...journalPosts].sort(
  (a, b) =>
    new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime()
);

export function getPostBySlug(slug: string): JournalPost | undefined {
  return journalPosts.find((p) => p.slug === slug);
}
