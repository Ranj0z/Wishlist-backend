import { Request, Response } from "express";
import {
  checkoutService,
  deletePaymentService,
  donateToWalletService,
  EmptyCheckoutError,
  expireStalePendingPaymentsService,
  getAllPaymentsService,
  getPaymentByIDService,
  getPaymentsByItemIDService,
  getPaymentsByUserIDService,
  handleGatewayWebhookService,
  InsufficientStockError,
  InsufficientWalletBalanceError,
  PaymentAlreadyInitiatedError,
  PaymentNotFoundError,
  retryPaymentService,
  RetryTokenMismatchError,
  verifyGatewaySignature,
  WalletRequiresLoginError,
} from "./payment.service";

// ==========================
// Payment Controllers
// ==========================

// Checkout: pick multiple items from one wishlist, pay the total in one go.
// Body: { wishlistId, items: [{ itemId, quantity }], paymentMethod, phone?, guestName? }
// No login required (req.user is populated by optionalAuth when a token is present).
export const checkoutController = async (req: Request, res: Response) => {
  try {
    const { wishlistId, items, paymentMethod, phone, guestName } = req.body;

    if (!wishlistId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "wishlistId and a non-empty items array are required" });
    }

    const result = await checkoutService({
      wishlistId: Number(wishlistId),
      items,
      paymentMethod,
      userId: req.user?.userId,
      guestName,
      phone,
    });

    if ((result as any).status === 502) {
      return res.status(502).json(result);
    }
    return res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof EmptyCheckoutError) {
      return res.status(400).json({ message: "No items in checkout" });
    }
    if (error instanceof InsufficientStockError) {
      return res.status(409).json({ message: error.message, itemId: error.itemId });
    }
    if (error instanceof WalletRequiresLoginError) {
      return res.status(401).json({ message: error.message });
    }
    if (error instanceof InsufficientWalletBalanceError) {
      return res.status(402).json({ message: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};

// Donate an open amount to someone's wallet.
// Body: { targetUserId, amount, paymentMethod, phone?, guestName? }
export const donateController = async (req: Request, res: Response) => {
  try {
    const { targetUserId, amount, paymentMethod, phone, guestName } = req.body;

    if (!targetUserId || !amount) {
      return res.status(400).json({ message: "targetUserId and amount are required" });
    }

    const result = await donateToWalletService({
      targetUserId: Number(targetUserId),
      amount: String(amount),
      paymentMethod,
      userId: req.user?.userId,
      guestName,
      phone,
    });

    if ((result as any).status === 502) {
      return res.status(502).json(result);
    }
    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get All Payments
export const getAllPaymentsController = async (req: Request, res: Response) => {
  try {
    const payments = await getAllPaymentsService();
    if (!payments || payments.length === 0) {
      return res.status(404).json({ message: "No payments found" });
    }
    return res.status(200).json({ data: payments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Payment By ID
export const getPaymentByIDController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid Payment ID format" });
    }

    const payment = await getPaymentByIDService(id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    return res.status(200).json({ data: payment });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Payments by User ID
export const getPaymentsByUserController = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const payments = await getPaymentsByUserIDService(userId);
    if (!payments || payments.length === 0) {
      return res.status(404).json({ message: "No payments found for this user" });
    }

    return res.status(200).json({ data: payments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Payments by Item ID
export const getPaymentsByItemController = async (
  req: Request,
  res: Response
) => {
  try {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid Item ID format" });
    }

    const payments = await getPaymentsByItemIDService(itemId);
    if (!payments || payments.length === 0) {
      return res.status(404).json({ message: "No payments found for this item" });
    }

    return res.status(200).json({ data: payments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Delete Payment by ID
export const deletePaymentController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid Payment ID format" });
    }

    const deleted = await deletePaymentService(id);
    if (!deleted || deleted.length === 0) {
      return res
        .status(404)
        .json({ message: "Payment not found or already deleted" });
    }

    return res.status(200).json({ message: "Payment deleted successfully ✅" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Gateway Webhook (no auth — HMAC-verified via X-Signature)
export const gatewayWebhookController = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-signature"] as string | undefined;
    if (!verifyGatewaySignature((req as any).rawBody, signature)) {
      return res.status(401).json({ message: "Invalid signature" });
    }
    await handleGatewayWebhookService(req.body);
    return res.status(200).json({ message: "ok" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Retry a Failed Payment — open to whoever holds the retryToken issued at creation
export const retryPaymentController = async (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    if (isNaN(paymentId)) {
      return res.status(400).json({ message: "Invalid Payment ID format" });
    }

    const { retryToken } = req.body ?? {};
    const result = await retryPaymentService(paymentId, retryToken);
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof PaymentNotFoundError) {
      return res.status(404).json({ message: "Payment not found" });
    }
    if (error instanceof PaymentAlreadyInitiatedError) {
      return res.status(409).json({ message: "Only Failed payments can be retried" });
    }
    if (error instanceof RetryTokenMismatchError) {
      return res.status(403).json({ message: "Invalid or missing retry token" });
    }
    if (error instanceof InsufficientStockError) {
      return res.status(409).json({ message: "Item no longer available in the quantity requested", itemId: error.itemId });
    }
    return res.status(502).json({ error: error.response?.data?.error ?? error.message });
  }
};

// Admin/scheduler endpoint: release stock holds for Pending payments the
// gateway never confirmed (STK prompt abandoned, network drop, etc.).
// Intended to be called periodically by an external scheduler, not by users.
export const expireStalePaymentsController = async (req: Request, res: Response) => {
  try {
    const result = await expireStalePendingPaymentsService();
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
