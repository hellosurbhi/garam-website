/** YouTube video ID for the show highlight reel embedded on the homepage. */
export const YOUTUBE_VIDEO_ID = "AXDhphHBUj4";

/** JSON-LD ready metadata for the show highlight reel used in VideoObject structured data. */
export const VIDEO_METADATA = {
  // TODO: verify exact upload date in YouTube Studio before launch
  title: "Garam Masala Dating: NYC's #1 Live Desi Comedy Dating Show",
  description:
    "Watch highlights from Garam Masala Dating, New York City's #1 live desi dating show. Two real South Asian singles go on a blind date in front of 250 people. Hosted by comedians Surbhi and Wyatt.",
  uploadDate: "2024-06-01",
  // TODO: verify exact duration in YouTube Studio (ISO 8601 PT format)
  duration: "PT4M32S",
} as const;

/** Curated Instagram reel URLs displayed in the social proof section of the homepage. */
export const INSTAGRAM_REEL_URLS = [
  "https://www.instagram.com/p/C79Pohcxu4j/",
  "https://www.instagram.com/p/DWeM47lkTXS/",
  "https://www.instagram.com/reel/DWuAL_REcJD/",
];
