import { Router } from "express";
import {
  deleteMessageImage,
  getConversation,
  getConversations,
  uploadMessageImage,
} from "../controllers/message.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { uploadImage } from "../utils/upload";

const router = Router();

router.use(authMiddleware);

// GET /api/v1/messages/conversations
router.get("/conversations", getConversations);

// POST /api/v1/messages/upload-image  (multipart/form-data field: "image")
router.post("/upload-image", uploadImage, uploadMessageImage);

// DELETE /api/v1/messages/image  — remove a previously uploaded image file
router.delete("/image", deleteMessageImage);

// GET /api/v1/messages/:otherUserId?before=<ISO date>&limit=<n>  (must be last — wildcard)
router.get("/:otherUserId", getConversation);

export default router;
