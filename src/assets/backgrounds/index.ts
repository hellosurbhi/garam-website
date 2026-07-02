import type { ImageMetadata } from "astro";

// Shared hero background for apply.astro and links.astro
import heroImg from "./hero.webp";

// Journal pool — same order as HF_IMAGES in src/data/images.ts
import hf01 from "./ai-art/hf-01.webp";
import hf02 from "./ai-art/hf-02.webp";
import hf03 from "./ai-art/hf-03.webp";
import hf04 from "./ai-art/hf-04.webp";
import hf05 from "./ai-art/hf-05.webp";
import hf06 from "./ai-art/hf-06.webp";
import hf07 from "./ai-art/hf-07.webp";
import hf08 from "./ai-art/hf-08.webp";
import hf09 from "./ai-art/hf-09.webp";
import hf10 from "./ai-art/hf-10.webp";
import hf11 from "./ai-art/hf-11.webp";
import hf12 from "./ai-art/hf-12.webp";
import hf13 from "./ai-art/hf-13.webp";
import hf14 from "./ai-art/hf-14.webp";
import hf15 from "./ai-art/hf-15.webp";
import hf16 from "./ai-art/hf-16.webp";
import hf17 from "./ai-art/hf-17.webp";
import hf18 from "./ai-art/hf-18.webp";
import hf19 from "./ai-art/hf-19.webp";
import hf20 from "./ai-art/hf-20.webp";
import hf21 from "./ai-art/hf-21.webp";
import hf22 from "./ai-art/hf-22.webp";
import hf23 from "./ai-art/hf-23.webp";
import hf24 from "./ai-art/hf-24.webp";
import hf25 from "./ai-art/hf-25.webp";
import hf26 from "./ai-art/hf-26.webp";
import hf27Img from "./ai-art/hf-27.webp";

/** AI-generated host images for journal post hero photos (same order as HF_IMAGES in src/data/images.ts) */
export const HF_IMAGES_ASSETS: ImageMetadata[] = [
  hf01,
  hf02,
  hf03,
  hf04,
  hf05,
  hf06,
  hf07,
  hf08,
  hf09,
  hf10,
  hf11,
  hf12,
  hf13,
  hf14,
  hf15,
  hf16,
  hf17,
  hf18,
  hf19,
  hf20,
  hf21,
  hf22,
  hf23,
  hf24,
  hf25,
  hf26,
  hf27Img,
];

// City pool — same order as SHOW_IMAGES in src/data/images.ts
import show01 from "./show/show-01.webp";
import show02 from "./show/show-02.webp";
import show03 from "./show/show-03.webp";
import show04 from "./show/show-04.webp";
import show05 from "./show/show-05.webp";
import onStageImg from "./promo/on-stage.webp";
import theMatchImg from "./promo/the-match.webp";
import theCrowdImg from "./promo/the-crowd.webp";
import pureChaosImg from "./promo/pure-chaos.webp";
import afterPartyImg from "./promo/after-party.webp";
import magicMomentImg from "./promo/magic-moment.webp";
import testimonialReactionImg from "./promo/testimonial-reaction.webp";

/** Real show photos for city page hero images (same order as SHOW_IMAGES in src/data/images.ts) */
export const SHOW_IMAGES_ASSETS: ImageMetadata[] = [
  show01,
  show02,
  show03,
  show04,
  show05,
  onStageImg,
  theMatchImg,
  theCrowdImg,
  pureChaosImg,
  afterPartyImg,
  magicMomentImg,
  testimonialReactionImg,
];

export { heroImg, hf27Img };
