import { z } from "zod";

export const LocationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  coordinates: z
    .tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
    .describe("[lng, lat]"),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, "Phone must be in E.164 format"),
  gender: z.enum(["male", "female"]).default("male"),
  email: z.string().email().toLowerCase().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  gender: z.enum(["male", "female"]).optional(),
  email: z.string().email().toLowerCase().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
