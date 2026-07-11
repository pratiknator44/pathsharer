import { string, z } from "zod";

const LocationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  coordinates: z
    .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
    .describe("[lng, lat]"),
});

export const updateJourneyMetadataSchema = z.object({
  userId: z.string().length(24, "Invalid userId"),
  isActive: z.boolean(),
  source: LocationSchema,
  destination: LocationSchema,
  name: z.string().optional()
});

export type UpdateJourneyMetadataInput = z.infer<typeof updateJourneyMetadataSchema>;

// Schema for POST /active-user — userId comes from the JWT, not the body
export const upsertActiveUserSchema = z.object({
  isActive: z.boolean().default(true),
  source: LocationSchema,
  destination: LocationSchema,
});

export type UpsertActiveUserInput = z.infer<typeof upsertActiveUserSchema>;

