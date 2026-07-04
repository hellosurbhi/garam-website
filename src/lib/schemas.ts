import { z } from "zod";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeRequiredString(min: number, max: number) {
  return z.preprocess(trimString, z.string().min(min).max(max));
}

function normalizeOptionalString(max: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().max(max).optional());
}

const emailSchema = z.preprocess(trimString, z.email().max(320));
const httpsUrlSchema = z.preprocess(
  trimString,
  z.url({ protocol: /^https$/ }).max(2048),
);

export const ApplicationNotificationSchema = z.object({
  name: normalizeRequiredString(1, 100),
  age: z.number().int().min(18).max(99),
  gender: normalizeRequiredString(1, 50),
  orientation: normalizeRequiredString(1, 50),
  city: normalizeOptionalString(100),
  state: normalizeOptionalString(100),
  country: normalizeOptionalString(100),
  email: emailSchema,
  phone: normalizeOptionalString(30),
  instagram: normalizeRequiredString(1, 100),
  community: normalizeOptionalString(100),
  income: normalizeOptionalString(50),
  applicationType: z.enum(["Self", "Nomination"]),
  referrerName: normalizeOptionalString(100),
  pitch: normalizeOptionalString(2000),
  photoUrl: httpsUrlSchema,
});

export const LeadPayloadSchema = z.object({
  email: emailSchema,
  phone: normalizeOptionalString(30),
  city: normalizeOptionalString(100),
  source: normalizeRequiredString(1, 100),
  sourcePage: normalizeRequiredString(1, 200),
  landingPage: normalizeRequiredString(1, 200),
  referrerHost: normalizeOptionalString(255),
  utmSource: normalizeOptionalString(100),
  utmMedium: normalizeOptionalString(100),
  utmCampaign: normalizeOptionalString(150),
  utmContent: normalizeOptionalString(150),
  utmTerm: normalizeOptionalString(150),
  posthogDistinctId: normalizeOptionalString(200),
  sourceCitySlug: normalizeOptionalString(100),
  geoCity: normalizeOptionalString(100),
  geoRegion: normalizeOptionalString(100),
  geoCountry: normalizeOptionalString(100),
  geoTimezone: normalizeOptionalString(100),
  company: normalizeOptionalString(200),
});

export const UpdateLeadSchema = z.object({
  phone: normalizeRequiredString(1, 30),
  updateToken: normalizeRequiredString(1, 512),
});

export const ContestantClaimSchema = z.object({
  inviteId: normalizeRequiredString(1, 100),
  firstName: normalizeRequiredString(1, 50),
  lastName: normalizeRequiredString(1, 50),
  email: emailSchema,
  phone: normalizeRequiredString(1, 30),
  waiverAgreed: z.boolean(),
  signature: normalizeRequiredString(1, 100),
  waiverVersion: normalizeRequiredString(1, 30),
  mailingListOptIn: z.boolean(),
});

export const ContestantShowClaimSchema = z.object({
  showId: normalizeRequiredString(1, 100),
  role: z.enum(["female", "male", "spectator"]),
  firstName: normalizeRequiredString(1, 50),
  lastName: normalizeRequiredString(1, 50),
  email: emailSchema,
  phone: normalizeRequiredString(1, 30),
  waiverAgreed: z.boolean(),
  signature: normalizeRequiredString(1, 100),
  waiverVersion: normalizeRequiredString(1, 30),
  mailingListOptIn: z.boolean(),
});

export const ContestantOpenClaimSchema = z.object({
  role: z.enum(["female", "male"]),
  firstName: normalizeRequiredString(1, 50),
  lastName: normalizeRequiredString(1, 50),
  email: emailSchema,
  phone: normalizeRequiredString(1, 30),
  waiverAgreed: z.boolean(),
  signature: normalizeRequiredString(1, 100),
  waiverVersion: normalizeRequiredString(1, 30),
  mailingListOptIn: z.boolean(),
});

export const StageWaiverSchema = z.object({
  firstName: normalizeRequiredString(1, 50),
  lastName: normalizeRequiredString(1, 50),
  email: emailSchema,
  phone: normalizeRequiredString(1, 30),
  waiverAgreed: z.boolean(),
  signature: normalizeRequiredString(1, 100),
  waiverVersion: normalizeRequiredString(1, 30),
  mailingListOptIn: z.boolean(),
  showId: normalizeOptionalString(100),
  portalToken: normalizeOptionalString(2048),
});

export const AdminApplicationPatchSchema = z
  .object({
    id: normalizeRequiredString(1, 200),
    patch: z
      .object({
        status: z.enum(["New", "Contacted", "Cast", "Rejected"]).optional(),
        notes: z.string().max(5000).optional(),
        deletedAt: z.enum(["now"]).or(z.null()).optional(),
      })
      .strict()
      .refine((patch) => Object.keys(patch).length > 0, {
        message: "At least one application field must be provided",
      }),
  })
  .strict();

export type ApplicationNotification = z.infer<
  typeof ApplicationNotificationSchema
>;
export type LeadPayload = z.infer<typeof LeadPayloadSchema>;
export type UpdatePayload = z.infer<typeof UpdateLeadSchema>;
export type ContestantClaimPayload = z.infer<typeof ContestantClaimSchema>;
export type ContestantShowClaimPayload = z.infer<
  typeof ContestantShowClaimSchema
>;
export type ContestantOpenClaimPayload = z.infer<
  typeof ContestantOpenClaimSchema
>;
export type StageWaiverPayload = z.infer<typeof StageWaiverSchema>;
export type AdminApplicationPatchPayload = z.infer<
  typeof AdminApplicationPatchSchema
>;
