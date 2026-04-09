export interface GalleryPhoto {
  label: string;
  src: string;
  w: number;
  h: number;
  pos: string;
  span?: boolean;
  alt: string;
}

export const GALLERY_HEADING = "The Vibes";
export const GALLERY_SUBHEADING =
  "What happens when 250 strangers pick your date";

export const GALLERY_PHOTOS: readonly GalleryPhoto[] = [
  {
    label: "On Stage",
    src: "on-stage.webp",
    w: 1200,
    h: 800,
    pos: "center 40%",
    span: true,
    alt: "Contestants and hosts laughing during a blindfolded dating round at Top Secret Comedy Club",
  },
  {
    label: "The Match",
    src: "the-match.webp",
    w: 1200,
    h: 800,
    pos: "center 45%",
    alt: "A matched couple laughing together on stage after the blindfold reveal",
  },
  {
    label: "Hosts",
    src: "hosts.webp",
    w: 733,
    h: 1200,
    pos: "center 30%",
    alt: "Hosts Surbhi and Wyatt sitting together on stage",
  },
  {
    label: "The Crowd",
    src: "the-crowd.webp",
    w: 800,
    h: 1200,
    pos: "center 40%",
    alt: "Audience members laughing together during a Garam Masala Dating show",
  },
  {
    label: "Pure Chaos",
    src: "pure-chaos.webp",
    w: 1200,
    h: 800,
    pos: "center 35%",
    alt: "A contestant lifting another person on stage during a high-energy moment",
  },
  {
    label: "After Party",
    src: "after-party.webp",
    w: 1200,
    h: 800,
    pos: "center center",
    alt: "Audience clapping and celebrating during the show",
  },
  {
    label: "Magic Moment",
    src: "magic-moment.webp",
    w: 800,
    h: 1200,
    pos: "center 30%",
    alt: "A contestant sharing an intimate moment with their date on stage",
  },
];
