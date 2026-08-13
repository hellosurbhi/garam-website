/**
 * Copy for the standalone /waiver page, the canonical on-stage waiver URL.
 * This is a legal signing surface: copy stays contract-like and focused, no
 * casual timing language and no marketing opt-ins (see LESSONS.md).
 */
export const WAIVER_PAGE = {
  title: "On-Stage Participation Waiver",
  metaDescription:
    "Sign the Garam Masala Dating on-stage participation waiver before joining the show on stage.",
  heading: "On-Stage Participation Waiver",
  intro:
    "Signing is required before you participate on stage. Read the full waiver below, then sign with your typed legal name.",
  scrollHint: "Scroll through the full waiver to enable agreement.",
  agreeLabel:
    "I have read and agree to the waiver. I understand the typed legal signature above is my electronic signature.",
  signatureLabel: "Type your full legal name as your signature",
  signatureMismatch: "Signature must match your legal name above.",
  submitLabel: "Sign Waiver",
  submittingLabel: "Signing...",
  successHeading: "Waiver signed",
  successBody:
    "You are all set. A copy of the signed waiver has been emailed to you. Show this confirmation to the production team if asked.",
  errorFallback:
    "Something went wrong saving your waiver. Please try again, or find a member of the production team at the venue.",
} as const;
