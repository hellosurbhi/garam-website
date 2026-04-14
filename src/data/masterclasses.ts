export interface MasterclassSlide {
  type: "title" | "disclaimer" | "step" | "science" | "twist" | "bonus" | "cta";
  stepNumber?: string;
  stepLabel?: string;
  title: string;
  body: string;
  hotTake?: string;
}

export interface MasterclassPost {
  slug: string;
  title: string;
  metaDescription: string;
  datePublished: string;
  dateModified: string;
  author: string;
  excerpt: string;
  /** Prose text for the mid-article CTA banner (links are added by the template). */
  promoText?: string;
  /** Heading rendered above the FAQ list. */
  faqHeading: string;
  slides: MasterclassSlide[];
  faqs: { q: string; a: string }[];
  relatedSlugs: string[];
  category: "masterclass";
}

export const masterclassPosts: MasterclassPost[] = [
  {
    slug: "situationship-masterclass",
    title: "The Situationship Conversion Playbook",
    metaDescription:
      "7 steps to convert your situationship, by Surbhi from Garam Masala Dating. A toxic masterclass covering intermittent reinforcement and taking your power back.",
    datePublished: "2026-04-10",
    dateModified: "2026-04-10",
    author: "Surbhi",
    excerpt:
      "Yes, this is toxic. No, I don't care. A 7-step playbook for converting your situationship, ending with the one plot twist nobody sees coming.",
    relatedSlugs: [],
    category: "masterclass",
    promoText:
      "We host the #1 live dating show for South Asian singles, weekly in NYC.",
    faqHeading: "Frequently Asked Questions",
    faqs: [
      {
        q: "How do I convert a situationship into a relationship?",
        a: "Stop making yourself endlessly available. Create genuine distance by actually filling your life with other things. The psychology of intermittent reinforcement means unpredictable availability creates more emotional investment than constant presence. When you stop chasing, you shift the power dynamic.",
      },
      {
        q: "Why do people stay in situationships?",
        a: "Situationships thrive on ambiguity. Neither person has to commit to anything, which feels safe. The person avoiding commitment gets intimacy without responsibility. The person wanting more gets hope without clarity. Both parties get just enough to stay.",
      },
      {
        q: "What is intermittent reinforcement in dating?",
        a: "Intermittent reinforcement is when rewards like attention, affection, and connection arrive unpredictably rather than consistently. It is the same psychological mechanism behind slot machines. Unpredictable rewards create stronger behavioral responses than reliable ones, which is why hot-and-cold behavior creates obsession.",
      },
      {
        q: "How do I stop being someone's situationship?",
        a: "Become genuinely busy and emotionally unavailable. Fill your calendar with things that have nothing to do with them. Post content that shows you thriving. When they reach out, match their energy instead of over-responding. The goal is to stop being the safe option and become the intriguing one.",
      },
      {
        q: "Does going silent actually work on a situationship?",
        a: "Yes, when it is genuine. The key is actually filling that silence with a real life rather than just waiting by your phone. If you go silent while still obsessing over them, they will feel it. If you go silent because you are genuinely out living, they will feel that too. One creates anxiety in you. The other creates anxiety in them.",
      },
    ],
    slides: [
      {
        type: "title",
        title: "The Situationship Conversion Playbook",
        body: "a toxic masterclass by surbhi",
      },
      {
        type: "disclaimer",
        title: "Yes, this is toxic. No, I don't care.",
        body: "Every single time I've done this, I've <em>successfully converted them</em>. Every single time, <em>I didn't want them after</em>. It's not happening for a reason. Let the universe guide you. But also? I don't want you ever feeling like the hopeless one. <strong>Let's take that power back. Why should hoes have all the fun?</strong>",
      },
      {
        type: "step",
        stepNumber: "01",
        stepLabel: "Step One",
        title: "Stop Texting First. Like, Actually Stop.",
        body: 'Put the phone down. Not "wait 20 minutes." Not "double text but make it casual." I mean <em>go silent</em>. Let them wonder if you died or got hot and moved on. Both options terrify them.',
        hotTake: "The rule: if you typed it, delete it",
      },
      {
        type: "step",
        stepNumber: "02",
        stepLabel: "Step Two",
        title: "Post Thirst Traps That Aren't for Them",
        body: "But here's the key: <em>never look at the camera</em>. Candid energy. Laughing with someone they don't know. Outfit that says \"I have plans and they don't involve your couch.\" They will watch every single story. The algorithm will tell you.",
        hotTake: "Let the photo grid do the talking",
      },
      {
        type: "step",
        stepNumber: "03",
        stepLabel: "Step Three",
        title: "Become Genuinely Unavailable",
        body: "This is not a game. Actually fill your calendar. Take a pottery class. Go to a comedy show. Go on other dates. The energy of someone who is <em>actually busy</em> is intoxicating and absolutely cannot be faked.",
        hotTake: "Busy is the new sexy",
      },
      {
        type: "step",
        stepNumber: "04",
        stepLabel: "Step Four",
        title: 'The Strategic "I\'m So Happy Right Now" Phase',
        body: "Radiate joy that has nothing to do with them. Nothing makes a situationship partner spiral harder than watching you be <em>completely fine</em>. Bonus points if you casually mention a fun night out and don't invite them.",
        hotTake: "Unbothered is a weapon",
      },
      {
        type: "step",
        stepNumber: "05",
        stepLabel: "Step Five",
        title: 'The "Oh, I Thought We Were Casual" Card',
        body: "When they finally bring up plans or ask to hang, hit them with: <em>\"Oh yeah for sure, I just didn't want to assume anything since we're keeping it chill.\"</em> Watch them choke on their own commitment issues in real time.",
        hotTake: "Mirror their energy back to them",
      },
      {
        type: "step",
        stepNumber: "06",
        stepLabel: "Step Six",
        title: "Mention Someone Else. Casually. Once.",
        body: 'Not jealousy-bait. Just: <em>"Oh this person at the bar last night said the funniest thing..."</em> One mention. Let their imagination do the rest. The human brain fills in blanks with its worst fears. That\'s not your problem. You were just telling a story.',
        hotTake: "Plant the seed, water nothing",
      },
      {
        type: "step",
        stepNumber: "07",
        stepLabel: "Step Seven",
        title: "Master the Art of Leaving First",
        body: 'After hookups, plans, hangouts: <em>you leave first</em>. No lingering. No "should I stay?" energy. Kiss them goodbye like you have somewhere better to be. Because you do. It\'s your own bed and your own peace.',
        hotTake: "The one who leaves first has the power",
      },
      {
        type: "science",
        stepLabel: "The Science Bit",
        title: "Why This Works (Annoyingly Well)",
        body: "<strong>Intermittent reinforcement.</strong> It's literally the same psychology behind slot machines and Instagram likes. Unpredictable rewards create obsession. When you're always available, you're a vending machine. When you're not? <em>You're the casino.</em>",
        hotTake: "Be the casino, not the vending machine",
      },
      {
        type: "twist",
        title: "Here's the Plot Twist",
        body: "By the time they come crawling back with a \"so... what are we?\" you will have become the version of yourself that <em>doesn't need their answer</em>. That's the real conversion. Not them. <em>You.</em> You were never converting a situationship. You were converting yourself into someone who doesn't settle.",
      },
      {
        type: "bonus",
        stepLabel: "Bonus Round",
        title: "The Nuclear Options",
        body: "<strong>The Soft Launch:</strong> Post a hand or arm in your story. Not theirs. Anyone's. Your cousin's. Doesn't matter.<br><br><strong>The Glow-Up Post:</strong> New hair, new outfit, no caption. Let the photo commit even if they won't.<br><br><strong>The Read Receipt:</strong> Open their message. Don't reply. For exactly 7 hours.",
        hotTake: "Chaotic? Yes. Effective? Also yes.",
      },
      {
        type: "cta",
        title: "Come to My Dating Show",
        body: "Garam Masala Dating: a live comedy blind date on stage, plus a singles mixer where you might actually meet someone who <em>texts you back</em>. Every week in NYC. It's chaotic, it's hilarious, it's how adults should actually date.",
      },
    ],
  },
];
