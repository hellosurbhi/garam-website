/**
 * Journal data aggregator.
 * Imports all category files and exports a unified array.
 */
export type {
  PostBlock,
  JournalFaq,
  JournalPost,
  RankedItem,
  AppReview,
} from "./types";
import type { JournalPost } from "./types";
import { isPublished } from "../../utils/date";
import { corePosts } from "./core";
import { appAlternativesPosts } from "./app-alternatives";
import { datingCulturePosts } from "./dating-culture";
import { identityPosts } from "./identity";
import { entertainmentPosts } from "./entertainment";
import { eventsPosts } from "./events";
import { seasonalPosts } from "./seasonal";
import { matrimonyPosts } from "./matrimony";
import { communitySinglesPosts } from "./community-singles";
import { bollywoodPosts } from "./bollywood";
import { crossCulturalPosts } from "./cross-cultural";
import { toxicPatternsPosts } from "./toxic-patterns";
import { casteClassPosts } from "./caste-class";
import { arrangedMarriagePosts } from "./arranged-marriage";
import { communityDeepDivesPosts } from "./community-deep-dives";
import { tipsPosts } from "./tips";
import { liveShowsPosts } from "./live-shows";

/** All journal posts combined */
export const journalPosts: JournalPost[] = [
  ...corePosts,
  ...appAlternativesPosts,
  ...datingCulturePosts,
  ...identityPosts,
  ...entertainmentPosts,
  ...eventsPosts,
  ...seasonalPosts,
  ...matrimonyPosts,
  ...communitySinglesPosts,
  ...bollywoodPosts,
  ...crossCulturalPosts,
  ...toxicPatternsPosts,
  ...casteClassPosts,
  ...arrangedMarriagePosts,
  ...communityDeepDivesPosts,
  ...tipsPosts,
  ...liveShowsPosts,
];

/** Sorted newest-first by datePublished. */
export const journalPostsSorted = [...journalPosts].sort(
  (a, b) =>
    new Date(b.datePublished).getTime() - new Date(a.datePublished).getTime(),
);

/** Only posts whose datePublished is today or earlier. */
export const journalPostsPublished = journalPostsSorted.filter((p) =>
  isPublished(p.datePublished),
);

export function getPostBySlug(slug: string): JournalPost | undefined {
  return journalPosts.find((p) => p.slug === slug);
}
