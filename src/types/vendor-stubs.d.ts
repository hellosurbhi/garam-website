/**
 * Ambient module stubs for packages used by the contestant portal / email / rate-limiting
 * features recovered from the bugs branch. Install these packages before activating those
 * features in production:
 *   npm install @react-email/components @upstash/redis @upstash/ratelimit
 */

declare module "@react-email/components";
declare module "@upstash/redis";
declare module "@upstash/ratelimit";
