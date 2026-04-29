import { z } from "zod";

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
});

export type UpdateJourneyMetadataInput = z.infer<typeof updateJourneyMetadataSchema>;
