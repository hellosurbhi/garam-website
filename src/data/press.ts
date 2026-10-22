export interface PressItem {
  title: string;
  source: string;
  url?: string;
  type: "podcast" | "article" | "press";
  /** Optional pull quote from the outlet. Only add for real, verifiable coverage. */
  quote?: string;
}

export const pressItems: PressItem[] = [
  {
    title: "Garam Masala Dating on Doctor Lawyer Comedian",
    source: "Doctor Lawyer Comedian",
    url: "https://www.youtube.com/watch?v=PyjeLMZohqY",
    type: "podcast",
  },
  {
    title: "Garam Masala Dating on Gen Zenophobic",
    source: "Gen Zenophobic",
    url: "https://www.youtube.com/watch?v=Es04TqhwkmY",
    type: "podcast",
  },
  {
    title: "Garam Masala Dating on Big Silly World",
    source: "Big Silly World",
    url: "https://www.youtube.com/watch?v=wEVFBODzYdI",
    type: "podcast",
  },
  {
    title: "Garam Masala Comedy Dating Show: Spilling Tea In Boston",
    source: "Time Out Boston",
    url: "https://www.timeout.com/boston/comedy/garam-masala-comedy-dating-show-spilling-tea-in-boston",
    type: "article",
    quote:
      "Dating shows have become their own form of live entertainment, but Garam Masala works because it treats the awkward moments as the punchline instead of chasing manufactured romance.",
  },
];
