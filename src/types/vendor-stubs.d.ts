/**
 * Ambient module stubs for packages used by the contestant portal / email / rate-limiting
 * features recovered from the bugs branch. Install these packages before activating those
 * features in production:
 *   npm install @react-email/components @upstash/redis @upstash/ratelimit
 */

declare module "@react-email/components";
declare module "@react-email/render";

declare module "@upstash/redis" {
  export class Redis {
    constructor(config: { url: string; token: string });
  }
}

declare module "@upstash/ratelimit" {
  export class Ratelimit {
    constructor(config: { redis: unknown; limiter: unknown; prefix?: string });
    static slidingWindow(
      requests: number,
      window: string,
    ): { kind: "sliding_window" };
    limit(identifier: string): Promise<{
      success: boolean;
      limit: number;
      remaining: number;
      reset: number;
    }>;
  }
}
