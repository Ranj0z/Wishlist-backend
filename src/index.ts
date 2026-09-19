import express from "express";
import cors from "cors";

// Import routers
import userRoutes from "./AllTables/Auth/auth.routes";
import wishlistRoutes from "./AllTables/Wishlists/wishlist.routes";
import itemRoutes from "./AllTables/Items/item.routes";
import paymentRoutes from "./AllTables/Payments/payment.routes";
import ticketRoutes from "./AllTables/Tickets/ticket.routes";

const app = express();

// ==========================
// Middleware
// ==========================
app.use(express.json());

app.use(cors({ origin: "https://wishlist-client-lime.vercel.app" }));

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
app.use(paymentRoutes);
app.use(ticketRoutes);

// ==========================
// Start server
// ==========================
app.listen(3000, () => {
  console.log("✅ Server is running on http://localhost:3000");
});