import { Router } from "express";
import journeyRoutes from "./journey.routes";
import userRoutes from "./user.routes";
import userJourneyRoutes from "./userJourney.routes";

const router = Router();

router.use("/users", userRoutes);
router.use("/journeys", journeyRoutes);
router.use("/user-journeys", userJourneyRoutes);

export default router;
