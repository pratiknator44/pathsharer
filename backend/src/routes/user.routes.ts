import { Router } from "express";
import { createUser, deleteCurrentUser, getCurrentDisplayName, getUser, getUserByPhone, updateJourneyMetadata, updateUser, getRecentSearches, addRecentSearch } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", createUser);
router.get("/by-phone", getUserByPhone);
router.get("/me/display-name", authMiddleware, getCurrentDisplayName);
router.get("/me/recent-searches", authMiddleware, getRecentSearches);
router.post("/me/recent-searches", authMiddleware, addRecentSearch);
router.delete("/me", authMiddleware, deleteCurrentUser);
router.get("/:id", getUser);
router.patch("/:id", updateUser);
router.post("/journey-metadata", updateJourneyMetadata);

export default router;
