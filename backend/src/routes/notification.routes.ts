import { Router } from "express";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

// GET /api/v1/notifications?before=<ISO date>
router.get("/", getNotifications);

// PATCH /api/v1/notifications/read-all
router.patch("/read-all", markAllNotificationsRead);

// PATCH /api/v1/notifications/:id/read
router.patch("/:id/read", markNotificationRead);

// DELETE /api/v1/notifications/:id
router.delete("/:id", deleteNotification);

export default router;
