import { Request, Response } from "express";
import {
  createPaymentService,
  deletePaymentService,
  getAllPaymentsService,
  getPaymentByIDService,
  getPaymentsByItemIDService,
  getPaymentsByUserIDService,
} from "./payment.service";

// ==========================
// Payment Controllers
// ==========================

// Create Payment
export const createPaymentController = async (req: Request, res: Response) => {
  try {
    const payment = req.body;
    const created = await createPaymentService(payment);

    if (!created) {
      return res.status(400).json({ message: "Payment not created" });
    }

    return res
      .status(201)
      .json({ message: "Payment created successfully ✅", data: created });
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
