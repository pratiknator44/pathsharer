import { NextFunction, Request, Response } from "express";
import { User } from "../models/user.model";
import { getWebPushPublicKey } from "../services/web-push.service";
import {
  deleteWebPushSubscriptionSchema,
  webPushSubscriptionSchema,
} from "../validators/web-push.validator";

export function getPublicKey(_req: Request, res: Response): void {
  const publicKey = getWebPushPublicKey();
  if (!publicKey) {
    res.status(503).json({ error: "Web push is not configured" });
    return;
  }
  res.json({ publicKey });
}

export async function saveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = webPushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid web push subscription" });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    user.webPushSubscriptions = user.webPushSubscriptions.filter(
      (subscription) => subscription.endpoint !== parsed.data.endpoint
    );
    user.webPushSubscriptions.push(parsed.data);
    await user.save();
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = deleteWebPushSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid web push endpoint" });
      return;
    }

    await User.updateOne(
      { _id: req.userId },
      { $pull: { webPushSubscriptions: { endpoint: parsed.data.endpoint } } }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}