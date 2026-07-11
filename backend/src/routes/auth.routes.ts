import { Router } from "express";
import { webGuestLogin } from "../controllers/auth.controller";

const router = Router();

/**
 * POST /api/v1/auth/web-guest
 * No auth required — returns a temporary JWT for web MVP users.
 */
router.post("/web-guest", webGuestLogin);

export default router;
