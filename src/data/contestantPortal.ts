/**
 * All user-facing copy for the ContestantPortal component.
 * Keep this file the single source of truth — never hardcode portal prose
 * inside the component.
 */

/** Raw email address (no mailto: prefix) used for display text. */
export const PORTAL_CONTACT_EMAIL = "contact@garammasaladating.com";

export const ERROR_VIEW = {
  heading: "Something went wrong",
  supportLabel: "Questions? Email",
} as const;

export const EXPIRED_VIEW = {
  heading: "Thank you for being part of the show!",
  body: "You're welcome to attend anytime for free. Please email",
  bodyTail: "to let us know what event you'd like to be added to.",
} as const;

export const PACKET_HERO = {
  kicker: "You've been selected",
  heading: "Your Contestant Packet",
  body: "Congratulations. You've been selected for Garam Masala Dating. Complete this production packet to lock your spot and open your prep guide.",
} as const;

export const ROLE_SELECT = {
  legend: "Confirm your casting track",
  description:
    "This unlocks the correct call time and prep notes after you sign.",
} as const;

export const GOLDEN_RULES: ReadonlyArray<{ rule: string; detail: string }> = [
  {
    rule: "Keep answers to 20 to 30 seconds.",
    detail:
      "The sweet spot is conversational. Not one word, not a five-minute story.",
  },
  {
    rule: "Vulnerable beats funny every time.",
    detail:
      "A genuine moment lands harder than a polished joke. You don't need to entertain everyone; you need to be honest.",
  },
  {
    rule: "The audience is on your side.",
    detail: "They showed up wanting to see a real connection.",
  },
  {
    rule: "Focus on your date, not the crowd.",
    detail: "Your date is the only person that matters.",
  },
  {
    rule: "It's okay to not feel it.",
    detail: `"I'm not feeling the chemistry" is honest. Faking attraction is not.`,
  },
  {
    rule: "Two to three drinks maximum before you go on.",
    detail: "Relaxed, not impaired.",
  },
];

export const SAMPLE_QUESTIONS: ReadonlyArray<string> = [
  "What's your name, and what do you do?",
  "What are you actually looking for in a partner?",
  "What are your dealbreakers?",
  "What are your green flags?",
  "What's your biggest ick?",
  "Why did your last relationship end?",
  "Are you over your ex?",
  "What's your best quality? Your worst?",
  "Where would you take someone on a first date?",
  "How close are you to your family?",
  "What do you do for fun outside of work?",
  "How many serious relationships have you been in?",
  "How much do you make? (Yes, this comes up.)",
];

export const COME_PREPARED_WITH: ReadonlyArray<{
  prompt: string;
  detail: string;
}> = [
  {
    prompt: "One thoughtful question to ask your date.",
    detail: `Conversational, not interview-style. Good: "What makes you hard to date?" Bad: "What do you do?"`,
  },
  {
    prompt: "A talent or party trick (30 seconds).",
    detail: "The weirder and more specific to you, the better.",
  },
  {
    prompt: "A pickup line.",
    detail: "Cheesy is the point.",
  },
  {
    prompt: "Your 30-second elevator pitch.",
    detail:
      "Who are you, and why should someone want to date you? Practice it out loud once.",
  },
];

export const PORTAL_INTRO = {
  body: "You've been selected as a contestant on NYC's #1 live South Asian dating show. You'll be on stage, mic'd up, matched with someone you've never met, in front of a full audience. It's real, it's fast, and it's genuinely one of the most fun things you'll do. Read this packet before you arrive.",
  coreLine: "We don't need you to be funny. We need you to be real.",
} as const;

export const WARDROBE = {
  heading: "What to Wear",
  body: "Dress like you're going on a real first date. Bold colors, statement fits, sequins welcome. Whatever reads as confident on a lit stage in front of a full audience. Avoid office clothes, gym clothes, or anything that disappears under stage lighting.",
} as const;

export const DAY_OF = {
  heading: "Day Of",
  body: "Bring your friends. Having friendly faces in the crowd makes a real difference up there. They cheer louder, the room warms up faster, and you will feel less alone on stage. Your phone will be with you backstage, so you can look at notes if you need them.",
} as const;

export const ARRIVAL_NOTES = {
  heading: "Arrival & Notes",
  female: [
    "We keep you separate from the men before the show so your first impression of each other happens on stage.",
    `You have full permission to not like someone. You don't owe anyone chemistry, and you don't need to perform it. "I'm not really feeling the connection" is great content. The girls who are remembered are the ones who said exactly what they thought. Don't fake it. The audience always knows.`,
  ],
  male: [
    "We keep you separate from the women before the show so your first impression of each other happens on stage.",
    "Audiences on this show tend to root for the women. Don't compensate by playing up charm or confidence. It reads as cocky and always backfires. What actually works: being genuinely curious about your date, not taking yourself too seriously, and being a little self-deprecating. Confident but humble.",
  ],
} as const;

/**
 * Visible disclosure shown near the submit button.
 * Contestants are intentionally opted in to updates. This copy makes that
 * explicit so the opt-in is disclosed rather than silent.
 */
export const MAILING_LIST_DISCLOSURE =
  "By completing this packet, you agree to receive occasional updates from Garam Masala Dating. You can unsubscribe at any time.";

/**
 * Waiver panel copy. The signature input and the agreement checkbox stay
 * locked until the contestant scrolls to the end of the waiver, so the
 * instruction and the locked hint must both explain that requirement.
 */
export const WAIVER_PANEL = {
  instruction:
    "Please read the full waiver below. Scroll to the end to unlock the signature and agreement.",
  scrollHint: "Scroll to keep reading",
  endReached: "You have reached the end of the waiver. You can now sign below.",
  signatureLabel: "Type your full legal name as your electronic signature",
  signaturePlaceholder: "First Last",
  signatureLockedHint: "Signing unlocks after you read the full waiver above.",
  signatureMismatch: "Signature must match your legal name above.",
  checkboxLabel:
    "I have read and agree to the waiver. I understand the typed legal signature above is my electronic signature.",
} as const;

export function missingRoleError(email: string): string {
  return `This contestant packet link is missing its casting role. Email ${email} and we'll resend it.`;
}

export function claimErrorMessage(email: string): string {
  return `Could not finish signup. Please try again or email ${email}.`;
}
