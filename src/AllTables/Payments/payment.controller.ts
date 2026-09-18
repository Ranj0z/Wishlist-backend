import { Request, Response } from "express";
import {
  createPaymentService,
  deletePaymentService,
  generateRetryToken,
  getAllPaymentsService,
  getPaymentByIDService,
  getPaymentsByItemIDService,
  getPaymentsByUserIDService,
  handleGatewayWebhookService,
  markPaymentFailedService,
  PaymentAlreadyInitiatedError,
  PaymentNotFoundError,
  retryPaymentService,
  RetryTokenMismatchError,
  setGatewayReferenceService,
  verifyGatewaySignature,
} from "./payment.service";
import { initiateGatewayStkPush } from "../../lib/paybillGateway";
import { normalizePhoneNumber } from "../../utils/normalizePhoneNumber";

// ==========================
// Payment Controllers
// ==========================

// Create Payment
export const createPaymentController = async (req: Request, res: Response) => {
  try {
    // `phone` is client-supplied and is not part of the original payment shape —
    // pull it out so it never reaches the insert as an unknown column.
    const { phone, ...payment } = req.body;
    const isMPesa = payment.paymentMethod === "MPesa";

    let normalizedPhone: string | undefined;
    if (isMPesa) {
      if (!phone) {
        return res
          .status(400)
          .json({ message: "phone is required for MPesa payments" });
      }
      try {
        normalizedPhone = normalizePhoneNumber(phone);
      } catch {
        return res.status(400).json({ message: "Invalid phone number format" });
      }
    }

    const created = await createPaymentService({
      ...payment,
      paymentStatus: "Pending",
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      ...(isMPesa ? { retryToken: generateRetryToken() } : {}),
    });

    if (!created) {
      return res.status(400).json({ message: "Payment not created" });
    }

    // Non-MPesa methods keep their existing behavior
    if (!isMPesa) {
      return res
        .status(201)
        .json({ message: "Payment created successfully ✅", data: created });
    }

    try {
      const { CheckoutRequestID } = await initiateGatewayStkPush({
        phone: normalizedPhone!,
        amount: Number(created.totalAmount),
        orderRef: String(created.paymentId),
        description: "Wishlist item payment",
      });

      const updated = await setGatewayReferenceService(
        created.paymentId,
        CheckoutRequestID
      );

      return res
        .status(201)
        .json({ message: "STK push sent ✅", data: updated ?? created });
    } catch (error: any) {
      // Keep the row for the audit trail, just mark it Failed
      const failed = await markPaymentFailedService(created.paymentId);
      return res.status(502).json({
        error: error.response?.data?.error ?? error.message,
        paymentId: created.paymentId,
        retryToken: failed?.retryToken ?? created.retryToken,
      });
    }
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
    return res.status(502).json({ error: error.response?.data?.error ?? error.message });
  }
};