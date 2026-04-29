import { z } from "zod";
import { LocationSchema } from "./user.validator";

export const createUserJourneySchema = z.object({
  journeyId: z.string().length(24, "Invalid journeyId"),
  userId: z.string().length(24, "Invalid userId"),
  source: LocationSchema,
  destination: LocationSchema,
  distanceMeters: z.number().min(0),
});

export const updateUserJourneySchema = z.object({
  destination: LocationSchema.optional(),
  distanceMeters: z.number().min(0).optional(),
  costMinor: z.number().int().min(0).optional(),
});

export type CreateUserJourneyInput = z.infer<typeof createUserJourneySchema>;
export type UpdateUserJourneyInput = z.infer<typeof updateUserJourneySchema>;
