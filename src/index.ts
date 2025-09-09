import express from "express";

// Import routers
import userRoutes from "./AllTables/Auth/auth.routes";
import wishlistRoutes from "./AllTables/Wishlists/wishlist.routes";
import itemRoutes from "./AllTables/Items/item.routes";
import paymentRoutes from "./AllTables/Payments/payment.routes";

const app = express();

// ==========================
// Middleware
// ==========================
app.use(express.json());

// ==========================
// Routes
// ==========================

// Root test route
app.get("/", (req, res) => {
  res.send("Hello Express! 🚀");
});

// API routes with versioning
app.use("/api/v1", userRoutes);
app.use("/api/v1", wishlistRoutes);
app.use("/api/v1", itemRoutes);
app.use("/api/v1", paymentRoutes);

// ==========================
// Start server
// ==========================
app.listen(3000, () => {
  console.log("✅ Server is running on http://localhost:3000");
});
