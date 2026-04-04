export interface PostBlock {
  type: "p" | "h2" | "h3";
  text: string;
}

export interface JournalFaq {
  q: string;
  a: string;
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
  faqs?: JournalFaq[];
}

export const journalPosts: JournalPost[] = [
  {
    slug: "the-only-live-desi-dating-show-in-nyc",
    title:
      "The Only Live Desi Dating Show in NYC (And What Actually Happens There)",
    metaDescription:
      "Garam Masala Dating is the only weekly live desi dating show in NYC. Here\u2019s what actually happens at the show, who can come, and how it compares to Indian Matchmaking.",
    datePublished: "2026-04-04",
    dateModified: "2026-04-04",
    author: "Garam Masala Dating",
    excerpt:
      "Garam Masala Dating is a weekly live desi dating show in New York City. Real singles go on blind dates on stage in front of 250 people at a Manhattan comedy club.",
    faqs: [
      {
        q: "Where is the live desi dating show in NYC?",
        a: "Garam Masala Dating takes place weekly at Top Secret Comedy Club in Manhattan. Monthly shows also run in Jersey City, New Jersey. Visit garammasaladating.com for the full schedule and tickets.",
      },
      {
        q: "How much are tickets to Garam Masala Dating?",
        a: "Ticket prices vary by show. General admission includes the live dating show and the singles mixer before and after. Buy tickets on Eventbrite or at garammasaladating.com/tickets.",
      },
      {
        q: "Can I apply to be on the live dating show?",
        a: "Yes. Apply at garammasaladating.com/apply. We cast based on personality and chemistry potential. Being funny, honest, or a little chaotic significantly helps your chances.",
      },
    ],
    body: [
      {
        type: "p",
        text: "Garam Masala Dating is a weekly live desi dating show in New York City. Real singles go on blind dates on stage in front of 250 people at a Manhattan comedy club. It\u2019s part comedy show, part real matchmaking, and it\u2019s the only live South Asian dating show running in NYC right now.",
      },
      {
        type: "h2",
        text: "What happens at a live desi dating show?",
      },
      {
        type: "p",
        text: "Two singles meet for the first time on stage. The hosts introduce them, ask questions, and the audience reacts in real time. Each date runs about 15 minutes. There\u2019s no script, no teleprompter, and nobody feeding lines through an earpiece. What you see is what actually happened.",
      },
      {
        type: "p",
        text: "The format is straightforward. Contestants arrive early for a quick briefing. They have no idea who they\u2019re being paired with. When it\u2019s their turn, they walk out, see their date for the first time, and figure it out live. The hosts keep things moving, the audience gets loud, and the room has an energy you genuinely cannot manufacture.",
      },
      {
        type: "p",
        text: "After the dates wrap, the venue turns into a singles mixer. The crowd stays, people actually talk to each other, and the contestants come back into the room. Some of the best connections we\u2019ve seen didn\u2019t happen on stage. They happened at the bar after.",
      },
      {
        type: "h2",
        text: "Do you have to be South Asian to go?",
      },
      {
        type: "p",
        text: "No. Garam Masala Dating is open to everyone. The audience is a mix of South Asian, desi diaspora, and anyone who likes comedy and meeting new people. You don\u2019t need to be Indian, Pakistani, Bangladeshi, or Sri Lankan to buy a ticket or apply as a contestant.",
      },
      {
        type: "p",
        text: "The show is rooted in desi culture but it\u2019s not a closed door. We\u2019ve had contestants from every background. The comedy works whether or not you grew up eating dal for dinner. If you enjoy watching real people be genuinely awkward in front of a crowd, you\u2019re going to have a good time.",
      },
      {
        type: "h2",
        text: "Is it like Indian Matchmaking?",
      },
      {
        type: "p",
        text: "Not really. Indian Matchmaking is a produced Netflix show with editors, story arcs, and Sima Aunty making house calls. Garam Masala Dating happens live in front of 250 people. No cameras follow you home. Nobody is crafting a narrative. What happens on stage is the whole story.",
      },
      {
        type: "p",
        text: "The comparison comes up constantly and we get it. Both involve South Asians looking for someone. But the vibe is completely different. Our show is loud. People yell from the audience. Nobody\u2019s parents are involved (unless they bought a ticket, which has happened). The dates are real, the reactions are real, and there\u2019s no editor deciding which moments make the cut.",
      },
      {
        type: "h2",
        text: "How is it different from a regular comedy show?",
      },
      {
        type: "p",
        text: "You\u2019re not watching comedians perform rehearsed bits. You\u2019re watching two real people try to figure out if they like each other while 250 strangers react to every single word. The comedy comes from the honesty. Nobody writes jokes for the contestants. The funny moments happen because the situation is genuinely absurd.",
      },
      {
        type: "p",
        text: "At a regular comedy show, you sit, laugh, and leave. Here, you\u2019re part of it. The audience shapes the date. When the crowd gasps, the contestants feel it. When 250 people cheer at once, it changes someone\u2019s entire energy on stage. You\u2019re not a passive viewer. You\u2019re a participant. Technically you\u2019re 250 people on a group date and only two of you are sitting on the stools.",
      },
      {
        type: "h2",
        text: "Frequently asked questions about the desi dating show",
      },
      {
        type: "h3",
        text: "Where is the live desi dating show in NYC?",
      },
      {
        type: "p",
        text: "Garam Masala Dating takes place weekly at Top Secret Comedy Club in Manhattan. Monthly shows also run in Jersey City, New Jersey. Visit garammasaladating.com for the full schedule and tickets.",
      },
      {
        type: "h3",
        text: "How much are tickets to Garam Masala Dating?",
      },
      {
        type: "p",
        text: "Ticket prices vary by show. General admission includes the live dating show and the singles mixer before and after. Buy tickets on Eventbrite or at garammasaladating.com/tickets.",
      },
      {
        type: "h3",
        text: "Can I apply to be on the live dating show?",
      },
      {
        type: "p",
        text: "Yes. Apply at garammasaladating.com/apply. We cast based on personality and chemistry potential. Being funny, honest, or a little chaotic significantly helps your chances.",
      },
      {
        type: "p",
        text: "Garam Masala Dating runs every week in NYC. Get tickets at garammasaladating.com.",
      },
    ],
  },
  {
    slug: "south-asian-singles-events-nyc",
    title:
      "South Asian Singles Events in NYC: What\u2019s Actually Worth Going To",
    metaDescription:
      "A guide to South Asian singles events in NYC, from desi mixers to live dating shows. What\u2019s actually worth your time and what to skip.",
    datePublished: "2026-04-04",
    dateModified: "2026-04-04",
    author: "Garam Masala Dating",
    excerpt:
      "Yes, there are South Asian singles events in NYC. And the options have gotten significantly better in the last few years.",
    faqs: [
      {
        q: "What is the best South Asian singles event in NYC?",
        a: "Garam Masala Dating is a weekly live comedy dating show and singles mixer in Manhattan. It combines a live dating show with a post-show mixer where the full audience meets and connects. Tickets at garammasaladating.com.",
      },
      {
        q: "Is Garam Masala Dating only for South Asians?",
        a: "No. The show is rooted in desi culture but open to everyone. The audience and contestants include people from all backgrounds who enjoy comedy, dating culture, and meeting new people.",
      },
      {
        q: "How do I meet South Asian singles in NYC?",
        a: "Attend a South Asian singles event like Garam Masala Dating, which runs weekly in Manhattan. You can also check desi-focused dating apps, cultural meetups, and community events. For live events, visit garammasaladating.com for tickets.",
      },
    ],
    body: [
      {
        type: "p",
        text: "Yes, there are South Asian singles events in NYC. And the options have gotten significantly better in the last few years. From desi singles mixers to speed dating nights to full-blown live dating shows, the scene has grown well beyond awkward banquet hall setups. The best ones don\u2019t feel like networking events. They feel like a night out.",
      },
      {
        type: "h2",
        text: "What kinds of South Asian singles events exist in NYC?",
      },
      {
        type: "p",
        text: "There are speed dating events, cultural mixers, app-organized meetups, and live dating shows happening regularly across the city. The formats range from structured one-on-one rotations to open bar hangs where you hope someone talks to you. Quality varies wildly.",
      },
      {
        type: "p",
        text: "Speed dating events are the most common. You sit across from someone for five minutes, make small talk, rotate, and repeat. Some people love the efficiency. Others find it exhausting and formulaic. The good ones keep the energy up. The bad ones feel like job interviews with cocktails.",
      },
      {
        type: "p",
        text: "Desi mixer events tend to be more relaxed. A bar, a DJ, maybe a theme. The vibe depends entirely on who shows up and whether the organizers thought about the ratio. Some of these are great. Some are 200 people standing in a circle checking their phones.",
      },
      {
        type: "h2",
        text: "What makes a singles event actually worth going to?",
      },
      {
        type: "p",
        text: "The best South Asian singles events in NYC share a few things. They have structure without being rigid. They attract people who actually want to meet someone. And they give you something to do besides stand around with a drink. The ones that work have a reason for people to interact, not just a reason to be in the same room.",
      },
      {
        type: "p",
        text: "Garam Masala Dating works because it gives the audience a shared experience. You watch real dates unfold, you react together, and then you meet each other at the mixer after. You already have something to talk about. You already laughed at the same moments. That\u2019s a completely different starting point than \u201Cso, what do you do?\u201D",
      },
      {
        type: "h2",
        text: "Why most desi singles events feel the same",
      },
      {
        type: "p",
        text: "Because most of them are. A venue, a drink minimum, a loose theme, and a hope that chemistry will spontaneously generate. The organizers handle logistics and leave the rest to chance.",
      },
      {
        type: "p",
        text: "That\u2019s not inherently bad. Some people thrive in open-format social settings. But if you\u2019ve been to three or four of these and they all blur together, it\u2019s because the format doesn\u2019t give you a reason to remember any specific one. The events that stand out are the ones with a point of view. They\u2019re the ones where someone decided what the experience should feel like and built around that instead of just booking a bar and hoping for the best.",
      },
      {
        type: "h2",
        text: "Where does Garam Masala Dating fit in?",
      },
      {
        type: "p",
        text: "Garam Masala Dating is a weekly live comedy dating show and singles mixer in Manhattan. It\u2019s not a networking event. It\u2019s not speed dating. Two real contestants go on blind dates on stage in front of 250 people. The audience watches, reacts, and then mixes afterward.",
      },
      {
        type: "p",
        text: "The show gives you an experience first. You\u2019re watching real people be vulnerable and funny and awkward, and then you\u2019re in a room full of people who just shared that with you. It\u2019s a different kind of ice-breaker than \u201Cthe DJ is playing too loud to talk.\u201D Weekly shows run at Top Secret Comedy Club in Manhattan. Monthly shows in Jersey City.",
      },
      {
        type: "h2",
        text: "Frequently asked questions about South Asian singles events",
      },
      {
        type: "h3",
        text: "What is the best South Asian singles event in NYC?",
      },
      {
        type: "p",
        text: "Garam Masala Dating is a weekly live comedy dating show and singles mixer in Manhattan. It combines a live dating show with a post-show mixer where the full audience meets and connects. Tickets at garammasaladating.com.",
      },
      {
        type: "h3",
        text: "Is Garam Masala Dating only for South Asians?",
      },
      {
        type: "p",
        text: "No. The show is rooted in desi culture but open to everyone. The audience and contestants include people from all backgrounds who enjoy comedy, dating culture, and meeting new people.",
      },
      {
        type: "h3",
        text: "How do I meet South Asian singles in NYC?",
      },
      {
        type: "p",
        text: "Attend a South Asian singles event like Garam Masala Dating, which runs weekly in Manhattan. You can also check desi-focused dating apps, cultural meetups, and community events. For live events, visit garammasaladating.com for tickets.",
      },
      {
        type: "p",
        text: "Find your next South Asian singles event. Get tickets to Garam Masala Dating at garammasaladating.com.",
      },
    ],
  },
  {
    slug: "desi-dating-show-vs-dating-apps",
    title:
      "Desi Dating Show vs. Dating Apps: What 4 Years of Running One Taught Me",
    metaDescription:
      "After four years of running Garam Masala Dating, here\u2019s what a live desi dating show taught me about chemistry, connection, and why apps can\u2019t replicate what happens on stage.",
    datePublished: "2026-04-04",
    dateModified: "2026-04-04",
    author: "Surbhi",
    excerpt:
      "A live desi dating show puts two people in front of a crowd and asks them to be real. Dating apps let you curate a version of yourself from behind a screen.",
    faqs: [
      {
        q: "Is Garam Masala Dating better than dating apps?",
        a: "They solve different problems. Dating apps give you reach and convenience. Garam Masala Dating gives you a live, in-person experience where chemistry happens in real time. Many people use both. The show is for people who want to feel something, not just scroll.",
      },
      {
        q: "Can you find a real relationship at a comedy dating show?",
        a: "Yes. Garam Masala Dating has led to real relationships and couples who are still together. The live format creates genuine connections because there is no way to fake chemistry in front of 250 people.",
      },
      {
        q: "What city is Garam Masala Dating in?",
        a: "Garam Masala Dating runs weekly in Manhattan, New York City and monthly in Jersey City, New Jersey. Visit garammasaladating.com for show dates, tickets, and contestant applications.",
      },
    ],
    body: [
      {
        type: "p",
        text: "A live desi dating show puts two people in front of a crowd and asks them to be real. Dating apps let you curate a version of yourself from behind a screen. After four years of running Garam Masala Dating in NYC, the biggest difference is simple: apps let you hide. A live show won\u2019t let you.",
      },
      {
        type: "h2",
        text: "What a live dating show gets right that apps can\u2019t",
      },
      {
        type: "p",
        text: "A dating app gives you a photo, a bio, and a chat window. A live dating show gives you a person. Right there. Reacting to you in real time. You can\u2019t filter your laugh. You can\u2019t draft and redraft your response. You just have to be there and be yourself.",
      },
      {
        type: "p",
        text: "I\u2019ve watched hundreds of live dates at Garam Masala Dating and the thing that strikes me every time is how fast you can tell. In person, with a live audience, the chemistry question gets answered in about 90 seconds. On an app, people go back and forth for weeks before meeting and still don\u2019t know.",
      },
      {
        type: "p",
        text: "The apps aren\u2019t broken, exactly. They do what they\u2019re designed to do, which is generate options. But options aren\u2019t connections. And the thing I\u2019ve learned running a live show is that connection happens in the moments you can\u2019t plan for. It happens when someone says something unexpected and the other person matches the energy instead of retreating.",
      },
      {
        type: "h2",
        text: "Why the audience changes everything",
      },
      {
        type: "p",
        text: "This is the part people don\u2019t expect. The audience at Garam Masala Dating isn\u2019t just watching. They\u2019re participating. When 250 people gasp at the same moment, the person on stage feels it. When the room goes quiet because someone said something unexpectedly real, that silence has weight.",
      },
      {
        type: "p",
        text: "The audience creates accountability. You can ghost someone on Hinge with zero consequences. You cannot ghost someone in front of a live crowd. The social pressure is actually productive here. It pushes people to be more honest, more present, and more themselves than they\u2019d ever be on a first date at a coffee shop. I didn\u2019t design it this way on purpose. It just turned out that giving people witnesses makes them braver.",
      },
      {
        type: "h2",
        text: "What actually makes two people click in person",
      },
      {
        type: "p",
        text: "It\u2019s not what people think. It\u2019s not looks (though that doesn\u2019t hurt). It\u2019s not shared hobbies. It\u2019s not even shared values, at least not in the first five minutes.",
      },
      {
        type: "p",
        text: "What makes two people click on stage is timing. One person says something unexpected. The other person matches the energy instead of retreating. There\u2019s a rhythm to it. You can hear it in the room when it\u2019s working. The audience feels it before the contestants do, usually.",
      },
      {
        type: "p",
        text: "On dating apps, you can\u2019t feel rhythm. You\u2019re reading words on a screen, deciding whether a sentence sounds interesting enough to respond to. In person, with a microphone and a crowd, the feedback is instant. The room tells you whether it\u2019s working. And the two people on stage can feel every bit of it.",
      },
      {
        type: "h2",
        text: "Is a live dating show better than Hinge for South Asians?",
      },
      {
        type: "p",
        text: "Depends what you\u2019re looking for. If you want volume, use Hinge. You\u2019ll get 50 profiles in an hour. If you want to actually feel something, come to a show.",
      },
      {
        type: "p",
        text: "I\u2019m biased, obviously. I run a live dating show. But after four years of watching desi singles on apps versus desi singles on stage, the difference is clear. The people on stage take bigger swings. They say the real thing. They take risks they\u2019d never take in a DM because the moment demands it.",
      },
      {
        type: "p",
        text: "Dating apps work for a lot of people. Genuinely. But they reward caution. A live show rewards honesty. And for a community that already has a complicated relationship with vulnerability and dating out loud, that shift matters more than you\u2019d think.",
      },
      {
        type: "h2",
        text: "Frequently asked questions about desi dating shows",
      },
      {
        type: "h3",
        text: "Is Garam Masala Dating better than dating apps?",
      },
      {
        type: "p",
        text: "They solve different problems. Dating apps give you reach and convenience. Garam Masala Dating gives you a live, in-person experience where chemistry happens in real time. Many people use both. The show is for people who want to feel something, not just scroll.",
      },
      {
        type: "h3",
        text: "Can you find a real relationship at a comedy dating show?",
      },
      {
        type: "p",
        text: "Yes. Garam Masala Dating has led to real relationships and couples who are still together. The live format creates genuine connections because there is no way to fake chemistry in front of 250 people.",
      },
      {
        type: "h3",
        text: "What city is Garam Masala Dating in?",
      },
      {
        type: "p",
        text: "Garam Masala Dating runs weekly in Manhattan, New York City and monthly in Jersey City, New Jersey. Visit garammasaladating.com for show dates, tickets, and contestant applications.",
      },
      {
        type: "p",
        text: "Think you\u2019d be better on stage than on an app? Apply to be a contestant at garammasaladating.com/apply.",
      },
    ],
  },
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
