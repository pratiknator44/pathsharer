import { Router } from "express";
import {
    bookExistingJourney,
    createJourney,
    getJourney,
    getNearbyMatches,
    getOpenJourneys,
    joinExistingJourney,
    updateStatus,
} from "../controllers/journey.controller";

const router = Router();

router.get("/open", getOpenJourneys);
router.post("/matches", getNearbyMatches);
router.post("/", createJourney);
router.get("/:id", getJourney);
router.post("/:id/join", joinExistingJourney);
router.post("/:id/book", bookExistingJourney);
router.patch("/:id/status", updateStatus);

export default router;
