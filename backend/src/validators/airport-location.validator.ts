import { z } from "zod";

export const airportLocationSchema = z.object({
  userId: z.string().trim().min(1),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  expoPushToken: z.string().trim().min(1).max(200).optional(),
});