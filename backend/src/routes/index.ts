import { Router } from "express";
import activeUserRoutes from "./activeUser.routes";
import authRoutes from "./auth.routes";
import configRoutes from "./config.routes";
import journeyRoutes from "./journey.routes";
import messageRoutes from "./message.routes";
import notificationRoutes from "./notification.routes";
import userRoutes from "./user.routes";
import userJourneyRoutes from "./userJourney.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/config", configRoutes);
router.use("/users", userRoutes);
router.use("/journeys", journeyRoutes);
router.use("/user-journeys", userJourneyRoutes);
router.use("/active-users", activeUserRoutes);
router.use("/messages", messageRoutes);
router.use("/notifications", notificationRoutes);

export default router;
