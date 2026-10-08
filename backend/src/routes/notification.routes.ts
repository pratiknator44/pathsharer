import { Router } from "express";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller";
import { notifyAtAirport } from "../controllers/airport-location.controller";
import {
  deleteSubscription,
  getPublicKey,
  saveSubscription,
} from "../controllers/web-push.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Public endpoints
// POST /api/v1/notifications/airport-location { userId, lat, lng, expoPushToken? }
router.post("/airport-location", notifyAtAirport);
router.get("/web-push/key", getPublicKey);

router.use(authMiddleware);

// Authenticated endpoints
router.post("/web-push/subscription", saveSubscription);
router.delete("/web-push/subscription", deleteSubscription);

// GET /api/v1/notifications?before=<ISO date>
router.get("/", getNotifications);

// PATCH /api/v1/notifications/read-all
router.patch("/read-all", markAllNotificationsRead);

// PATCH /api/v1/notifications/:id/read
router.patch("/:id/read", markNotificationRead);

// DELETE /api/v1/notifications/:id
router.delete("/:id", deleteNotification);

export default router;
