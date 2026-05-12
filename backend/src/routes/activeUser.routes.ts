import { Router } from "express";
import { deleteActiveUser, getNearbyUsers, upsertActiveUser } from "../controllers/activeUser.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// All routes here require a valid JWT
router.use(authMiddleware);

router.get("/nearby", getNearbyUsers);
router.post("/", upsertActiveUser);
router.delete("/me", deleteActiveUser);

export default router;
