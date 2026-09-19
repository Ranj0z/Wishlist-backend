import express from "express";

// Import routers
import userRoutes from "./AllTables/Auth/auth.routes";
import wishlistRoutes from "./AllTables/Wishlists/wishlist.routes";
import itemRoutes from "./AllTables/Items/item.routes";
import paymentRoutes from "./AllTables/Payments/payment.routes";
import ticketRoutes from "./AllTables/Tickets/ticket.routes";
import walletRoutes from "./AllTables/Wallet/wallet.routes";
import { expireStalePendingPaymentsService } from "./AllTables/Payments/payment.service";

const app = express();
import cors from "cors";
import { logger } from './middleware/logger';

// ==========================
// Middleware
// ==========================
// `verify` captures the raw request body alongside express.json()'s parsed
// body — the gateway webhook's HMAC signature must be checked against the
// exact bytes that were sent, not a re-serialized JSON.stringify of req.body.
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  },
}));


app.use(logger);

  app.use(cors({
    origin: "https://wishlist-client-lime.vercel.app",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
  }));

// ==========================
// Routes
// ==========================

// Root test route
app.get("/", (req, res) => {
  res.send("Hello Express! 🚀");
});

// API routes (flat, no version prefix — frontend calls these paths directly)
app.use(userRoutes);
app.use(wishlistRoutes);
app.use(itemRoutes);
// paymentRoutes registers directly on `app` (it needs both GET and POST on
// the same path, e.g. /payments) rather than exporting an Express Router,
// so it must be *called* with app — `app.use(paymentRoutes)` would treat the
// registration function itself as middleware and silently break every
// payment route.
paymentRoutes(app);
app.use(ticketRoutes);
app.use(walletRoutes);

// ==========================
// Stale payment sweep
// ==========================
// Releases stock holds for ItemPurchase payments the gateway never confirmed
// (abandoned STK prompt, dropped network, etc.) — see PENDING_HOLD_TTL_MS in
// payment.service.ts for the cutoff. A single Node process running
// setInterval is fine for one instance; if you ever run this behind a
// multi-instance/serverless deploy, move this to an external scheduler
// hitting POST /payments/expire-stale instead, so it only runs once per tick.
const STALE_PAYMENT_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(async () => {
  try {
    const { expiredCount } = await expireStalePendingPaymentsService();
    if (expiredCount > 0) {
      console.log(`🧹 Expired ${expiredCount} stale pending payment(s), stock released`);
    }
  } catch (error) {
    console.error("Stale payment sweep failed:", error);
  }
}, STALE_PAYMENT_SWEEP_INTERVAL_MS);

// ==========================
// Start server
// ==========================
app.listen(3000, () => {
  console.log("✅ Server is running on http://localhost:3000");
});