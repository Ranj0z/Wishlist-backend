import { relations } from "drizzle-orm";
import { serial, boolean, varchar, text, date, decimal, integer, pgTable, pgEnum, timestamp } from "drizzle-orm/pg-core";

// Enums
export const RoleEnum = pgEnum("role", ["admin", "user"]);
export const StatusEnum = pgEnum("status", ["Pending", "In Progress", "Closed"]);
export const PaymentStatusEnum = pgEnum("payment_status", ["Pending", "Completed", "Failed"]);
// "eWallet" doubles as "pay with your own wallet balance" (see PaymentPurposeEnum: WalletSpend).
export const PaymentMethodEnum = pgEnum("payment_method", ["Stripe", "MPesa", "eWallet"]);
// What a payment row is actually for. ItemPurchase = checkout on a wishlist.
// WalletDonation = open-amount top-up of someone's wallet. WalletSpend = paying
// for items using the payer's own wallet balance instead of a gateway.
export const PaymentPurposeEnum = pgEnum("payment_purpose", ["ItemPurchase", "WalletDonation", "WalletSpend"]);
export const WalletTxTypeEnum = pgEnum("wallet_tx_type", ["Donation", "Spend", "Withdrawal"]);
export const WithdrawalStatusEnum = pgEnum("withdrawal_status", ["Pending", "Paid", "Rejected"]);

// Users Table
export const usersTable = pgTable("users", {
  userId: serial("user_id").primaryKey(),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  email: varchar("email", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  imageUrl: text("image_url"),
  eWallet: varchar("e_wallet", { length: 100 }),
  // Cached wallet balance. This is a read-optimization only — the source of
  // truth is walletTransactionsTable; every change to this column must happen
  // in the same statement/transaction as the matching ledger row insert.
  amount: varchar("amount", { length: 10 }).default('0.00').notNull(),
  phoneNumber: varchar("phone_number", { length: 15 }),
  dateOfBirth: date("date_of_birth"),
  role: RoleEnum("role").default("user").notNull(),

  // Email verification
  verificationCode: varchar("verification_code", { length: 10 }),
  verificationExpiresAt: timestamp("verification_expires_at"),
  isVerified: boolean("is_verified").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Wishlists Table
export const wishlistsTable = pgTable("wishlists", {
  wishlistId: serial("wishlist_id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.userId, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  deliveryLocation: text("delivery_location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Items Table
export const itemsTable = pgTable("items", {
  itemId: serial("item_id").primaryKey(),
  wishlistId: integer("wishlist_id").references(() => wishlistsTable.wishlistId, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  // Remaining stock. Decremented at checkout time (soft-reservation — see
  // payment.service.ts reserveItemStockService) and restored if the payment
  // fails or expires without ever reaching the gateway.
  quantity: integer("quantity").notNull(),
  productStatus: boolean("product_status").default(false).notNull(), // false = active, true = completed (quantity hit 0)
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payments Table
// One row per checkout / donation attempt. For ItemPurchase, the actual line
// items paid for live in paymentItemsTable (a payment can cover several items
// from one wishlist in a single go).
export const paymentsTable = pgTable("payments", {
  paymentId: serial("payment_id").primaryKey(),
  purpose: PaymentPurposeEnum("purpose").default("ItemPurchase").notNull(),

  // Set for ItemPurchase only (which wishlist was checked out).
  wishlistId: integer("wishlist_id").references(() => wishlistsTable.wishlistId, { onDelete: "cascade" }),

  // The payer, if logged in. Nullable — guest checkout requires no account.
  userId: integer("user_id").references(() => usersTable.userId, { onDelete: "set null" }),
  // Guest contact info, only populated when userId is null.
  guestName: varchar("guest_name", { length: 100 }),

  // Whose wallet is credited (WalletDonation) — irrelevant for the other purposes.
  targetUserId: integer("target_user_id").references(() => usersTable.userId, { onDelete: "cascade" }),

  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: PaymentStatusEnum("payment_status").default("Pending").notNull(),
  paymentMethod: PaymentMethodEnum("payment_method").notNull(),
  transactionID: varchar("transaction_id", { length: 255 }), // holds the gateway's mpesaReceipt on success
  gatewayReference: varchar("gateway_reference", { length: 255 }), // gateway's CheckoutRequestID
  phone: varchar("phone", { length: 20 }), // normalized MSISDN (2547XXXXXXXX), used by the retry flow
  retryToken: varchar("retry_token", { length: 64 }), // proof-of-possession secret returned at creation; required to retry without login
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payment Items Table — line items for an ItemPurchase payment.
export const paymentItemsTable = pgTable("payment_items", {
  paymentItemId: serial("payment_item_id").primaryKey(),
  paymentId: integer("payment_id").references(() => paymentsTable.paymentId, { onDelete: "cascade" }).notNull(),
  itemId: integer("item_id").references(() => itemsTable.itemId, { onDelete: "cascade" }).notNull(),
  quantity: integer("quantity").notNull(),
  // Price at the moment of checkout — protects the payer/receipt from a later
  // price edit on the item, and is what totalAmount is actually computed from.
  unitPriceSnapshot: decimal("unit_price_snapshot", { precision: 10, scale: 2 }).notNull(),
});

// Wallet Transactions Table — append-only ledger; usersTable.amount is a cache of this.
export const walletTransactionsTable = pgTable("wallet_transactions", {
  walletTxId: serial("wallet_tx_id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.userId, { onDelete: "cascade" }).notNull(),
  type: WalletTxTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  relatedPaymentId: integer("related_payment_id").references(() => paymentsTable.paymentId, { onDelete: "set null" }),
  // Not a DB-enforced FK (withdrawalRequestsTable is declared after this table);
  // application code is responsible for the link's integrity.
  relatedWithdrawalId: integer("related_withdrawal_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Withdrawal Requests Table
export const withdrawalRequestsTable = pgTable("withdrawal_requests", {
  requestId: serial("request_id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.userId, { onDelete: "cascade" }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  destinationPhone: varchar("destination_phone", { length: 20 }).notNull(),
  status: WithdrawalStatusEnum("status").default("Pending").notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => usersTable.userId, { onDelete: "set null" }),
});

//User Support Ticket Table
export const userSupportTicketsTable = pgTable("ticket", {
    TicketID: serial("TicketID").primaryKey(),
    UserID: integer("UserID").references(() =>usersTable.userId, {onDelete: "cascade"}).notNull(),
    subject : varchar("subject", { length: 50 }).notNull(),
    description: text("description").notNull(),
    ticketStatus: StatusEnum("status").default('Pending'), 
    created_at: date("created_date").notNull(),
    updated_at: date("updated_date"),
})


// ==========================
// Relations
// ==========================
export const UserRelations = relations(usersTable, ({ many }) => ({
  wishlists: many(wishlistsTable),
  payments: many(paymentsTable),
  walletTransactions: many(walletTransactionsTable),
  withdrawalRequests: many(withdrawalRequestsTable),
}));

export const WishlistRelations = relations(wishlistsTable, ({ many, one }) => ({
  items: many(itemsTable),
  payments: many(paymentsTable),
  user: one(usersTable, {
    fields: [wishlistsTable.userId],
    references: [usersTable.userId],
  }),
}));

export const ItemRelations = relations(itemsTable, ({ many, one }) => ({
  paymentItems: many(paymentItemsTable),
  wishlist: one(wishlistsTable, {
    fields: [itemsTable.wishlistId],
    references: [wishlistsTable.wishlistId],
  }),
}));

//User to UserSupportTickets Table  - one to many
export const UserTicketsRelations = relations(usersTable, ({many}) =>({
    userSupportTickets: many (userSupportTicketsTable)
}))

export const PaymentRelations = relations(paymentsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [paymentsTable.userId],
    references: [usersTable.userId],
  }),
  targetUser: one(usersTable, {
    fields: [paymentsTable.targetUserId],
    references: [usersTable.userId],
  }),
  wishlist: one(wishlistsTable, {
    fields: [paymentsTable.wishlistId],
    references: [wishlistsTable.wishlistId],
  }),
  items: many(paymentItemsTable),
}));

export const PaymentItemRelations = relations(paymentItemsTable, ({ one }) => ({
  payment: one(paymentsTable, {
    fields: [paymentItemsTable.paymentId],
    references: [paymentsTable.paymentId],
  }),
  item: one(itemsTable, {
    fields: [paymentItemsTable.itemId],
    references: [itemsTable.itemId],
  }),
}));

export const WalletTransactionRelations = relations(walletTransactionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [walletTransactionsTable.userId],
    references: [usersTable.userId],
  }),
  payment: one(paymentsTable, {
    fields: [walletTransactionsTable.relatedPaymentId],
    references: [paymentsTable.paymentId],
  }),
}));

export const WithdrawalRequestRelations = relations(withdrawalRequestsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [withdrawalRequestsTable.userId],
    references: [usersTable.userId],
  }),
  processor: one(usersTable, {
    fields: [withdrawalRequestsTable.processedBy],
    references: [usersTable.userId],
  }),
}));

// ==========================
// Types
// ==========================
export type TIUsers = typeof usersTable.$inferInsert;
export type TSUsers = typeof usersTable.$inferSelect;
export type TIUserSupportTickets= typeof userSupportTicketsTable.$inferInsert;
export type TSUserSupportTickets = typeof userSupportTicketsTable.$inferSelect;
export type TIWishlists = typeof wishlistsTable.$inferInsert;
export type TSWishlists = typeof wishlistsTable.$inferSelect;
export type TIItems = typeof itemsTable.$inferInsert;
export type TSItems = typeof itemsTable.$inferSelect;
export type TIPayments = typeof paymentsTable.$inferInsert;
export type TSPayments = typeof paymentsTable.$inferSelect;
export type TIPaymentItems = typeof paymentItemsTable.$inferInsert;
export type TSPaymentItems = typeof paymentItemsTable.$inferSelect;
export type TIWalletTransactions = typeof walletTransactionsTable.$inferInsert;
export type TSWalletTransactions = typeof walletTransactionsTable.$inferSelect;
export type TIWithdrawalRequests = typeof withdrawalRequestsTable.$inferInsert;
export type TSWithdrawalRequests = typeof withdrawalRequestsTable.$inferSelect;

export type TSUserLoginInput = {
  email: string;
  password: string;
};

export type TSUserVerifyInput = {
  email: string;
  verificationCode: string;
};
