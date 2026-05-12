import { Request, Response, Router } from "express";
import { env } from "../config/env";

const router = Router();

// Public endpoint — no auth required
// Returns app metadata that the frontend About screen consumes
router.get("/", (_req: Request, res: Response) => {
  res.json({
    contactEmail: env.CONTACT_EMAIL,
    whatsappNumber: env.WHATSAPP_NUMBER,
    playStoreUrl: env.PLAY_STORE_URL,
  });
});

export default router;
