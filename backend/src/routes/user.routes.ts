import { Router } from "express";
import { createUser, getUser, getUserByPhone, updateJourneyMetadata, updateUser } from "../controllers/user.controller";

const router = Router();

router.post("/", createUser);
router.get("/by-phone", getUserByPhone);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.post("/journey-metadata", updateJourneyMetadata);

export default router;
