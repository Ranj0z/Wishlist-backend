import { Request, Response } from "express";
import {
  createWithdrawalRequestService,
  getWalletBalanceService,
  getWalletTransactionsService,
  getWithdrawalRequestsByUserService,
  getWithdrawalRequestsService,
  InsufficientBalanceError,
  markWithdrawalPaidService,
  rejectWithdrawalService,
  WithdrawalAlreadyProcessedError,
  WithdrawalRequestNotFoundError,
} from "./wallet.service";

// Get own wallet balance (requireAuth applied in routes)
export const getWalletBalanceController = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }
    const wallet = await getWalletBalanceService(userId);
    if (!wallet) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ data: wallet });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getWalletTransactionsController = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }
    const transactions = await getWalletTransactionsService(userId);
    return res.status(200).json({ data: transactions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Submit a withdrawal request against the caller's own wallet balance.
// Body: { amount, destinationPhone }
export const createWithdrawalRequestController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Login required" });

    const { amount, destinationPhone } = req.body;
    if (!amount || !destinationPhone) {
      return res.status(400).json({ message: "amount and destinationPhone are required" });
    }

    const request = await createWithdrawalRequestService({
      userId,
      amount: String(amount),
      destinationPhone,
    });

    return res.status(201).json({ message: "Withdrawal requested ✅", data: request });
  } catch (error: any) {
    if (error instanceof InsufficientBalanceError) {
      return res.status(402).json({ message: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const getMyWithdrawalRequestsController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Login required" });
    const requests = await getWithdrawalRequestsByUserService(userId);
    return res.status(200).json({ data: requests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Admin: list withdrawal requests, optionally filtered by ?status=Pending
export const getWithdrawalRequestsController = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as "Pending" | "Paid" | "Rejected" | undefined;
    const requests = await getWithdrawalRequestsService(status);
    return res.status(200).json({ data: requests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Admin: confirm a payout already made out-of-band
export const markWithdrawalPaidController = async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ message: "Invalid request ID format" });
    }
    const adminUserId = req.user!.userId;
    const updated = await markWithdrawalPaidService(requestId, adminUserId);
    return res.status(200).json({ message: "Withdrawal marked as paid ✅", data: updated });
  } catch (error: any) {
    if (error instanceof WithdrawalRequestNotFoundError) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }
    if (error instanceof WithdrawalAlreadyProcessedError) {
      return res.status(409).json({ message: "Only Pending requests can be processed" });
    }
    return res.status(500).json({ error: error.message });
  }
};

// Admin: reject a request, releasing the held funds back to the balance
export const rejectWithdrawalController = async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.id);
    if (isNaN(requestId)) {
      return res.status(400).json({ message: "Invalid request ID format" });
    }
    const adminUserId = req.user!.userId;
    const updated = await rejectWithdrawalService(requestId, adminUserId);
    return res.status(200).json({ message: "Withdrawal rejected ✅", data: updated });
  } catch (error: any) {
    if (error instanceof WithdrawalRequestNotFoundError) {
      return res.status(404).json({ message: "Withdrawal request not found" });
    }
    if (error instanceof WithdrawalAlreadyProcessedError) {
      return res.status(409).json({ message: "Only Pending requests can be processed" });
    }
    return res.status(500).json({ error: error.message });
  }
};
