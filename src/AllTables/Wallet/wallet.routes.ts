import { Router } from "express";
import {
  createWithdrawalRequestController,
  getMyWithdrawalRequestsController,
  getWalletBalanceController,
  getWalletTransactionsController,
  getWithdrawalRequestsController,
  markWithdrawalPaidController,
  rejectWithdrawalController,
} from "./wallet.controller";
import { requireAdmin, requireAuth } from "../../middleware/tokenAuth";

const router = Router();

// ==========================
// Wallet Routes
// ==========================
// NOTE: donate-to-wallet lives in payment.routes.ts (POST /wallet/:targetUserId/donate)
// since it's a gateway payment like item checkout, not a wallet-internal action.

// Get a user's wallet balance / ledger
router.get("/wallet/:userId/balance", requireAuth, getWalletBalanceController);
router.get("/wallet/:userId/transactions", requireAuth, getWalletTransactionsController);

// Submit a withdrawal request against the caller's own balance
router.post("/wallet/withdraw-requests", requireAuth, createWithdrawalRequestController);
router.get("/wallet/withdraw-requests/mine", requireAuth, getMyWithdrawalRequestsController);

// Admin: review and process withdrawal requests
router.get("/admin/withdraw-requests", requireAuth, requireAdmin, getWithdrawalRequestsController);
router.patch("/admin/withdraw-requests/:id/paid", requireAuth, requireAdmin, markWithdrawalPaidController);
router.patch("/admin/withdraw-requests/:id/reject", requireAuth, requireAdmin, rejectWithdrawalController);

export default router;
