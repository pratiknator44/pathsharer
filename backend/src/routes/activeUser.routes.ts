import { Router } from "express";
import { getNearbyUsers, upsertActiveUser } from "../controllers/activeUser.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// All routes here require a valid JWT
router.use(authMiddleware);

router.get("/nearby", getNearbyUsers);
router.post("/", upsertActiveUser);

export default router;
