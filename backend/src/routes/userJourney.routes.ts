import { Router } from "express";
import {
    createUserJourney,
    getUserJourneyHistory,
    updateUserJourneyById,
} from "../controllers/userJourney.controller";

const router = Router();

router.post("/", createUserJourney);
router.patch("/:id", updateUserJourneyById);
router.get("/user/:id", getUserJourneyHistory);

export default router;
