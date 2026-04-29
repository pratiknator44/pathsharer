import { z } from "zod";
import { LocationSchema } from "./user.validator";

export const createJourneySchema = z.object({
  userId: z.string().length(24, "Invalid userId"),
  source: LocationSchema,
});

export const bookJourneySchema = z.object({
  bookedBy: z.string().length(24, "Invalid userId"),
  totalCostMinor: z.number().int().min(0),
});

export const updateJourneyStatusSchema = z.object({
  status: z.enum(["cancelled", "completed"]),
});

export type CreateJourneyInput = z.infer<typeof createJourneySchema>;
export type BookJourneyInput = z.infer<typeof bookJourneySchema>;
