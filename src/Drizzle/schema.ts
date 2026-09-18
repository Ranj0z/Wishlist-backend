import { relations } from "drizzle-orm";
import { serial, boolean, varchar, text, date, decimal, integer, pgTable, pgEnum, timestamp } from "drizzle-orm/pg-core";

// Enums
export const RoleEnum = pgEnum("role", ["admin", "user"]);
export const StatusEnum = pgEnum("status", ["Pending", "In Progress", "Closed"]);
export const PaymentStatusEnum = pgEnum("payment_status", ["Pending", "Completed", "Failed"]);
export const PaymentMethodEnum = pgEnum("payment_method", ["Stripe", "MPesa", "eWallet"]);

// Users Table
export const usersTable = pgTable("users", {
  userId: serial("user_id").primaryKey(),
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  email: varchar("email", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  imageUrl: text("image_url"),
  eWallet: varchar("e_wallet", { length: 100 }),
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
  quantity: integer("quantity").notNull(),
  productStatus: boolean("product_status").default(false).notNull(), // false = active, true = completed
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payments Table
export const paymentsTable = pgTable("payments", {
  paymentId: serial("payment_id").primaryKey(),
  itemId: integer("item_id").references(() => itemsTable.itemId, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => usersTable.userId, { onDelete: "cascade" }).notNull(),
  quantityPaid: integer("quantity_paid").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: PaymentStatusEnum("payment_status").default("Pending").notNull(),
  paymentMethod: PaymentMethodEnum("payment_method").notNull(),
  transactionID: varchar("transaction_id", { length: 255 }), // holds the gateway's mpesaReceipt on success
  gatewayReference: varchar("gateway_reference", { length: 255 }), // gateway's CheckoutRequestID
  phone: varchar("phone", { length: 20 }), // normalized MSISDN (2547XXXXXXXX), used by the retry flow
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
}));

export const WishlistRelations = relations(wishlistsTable, ({ many, one }) => ({
  items: many(itemsTable),
  user: one(usersTable, {
    fields: [wishlistsTable.userId],
    references: [usersTable.userId],
  }),
}));

export const ItemRelations = relations(itemsTable, ({ many, one }) => ({
  payments: many(paymentsTable),
  wishlist: one(wishlistsTable, {
    fields: [itemsTable.wishlistId],
    references: [wishlistsTable.wishlistId],
  }),
}));

//User to UserSupportTickets Table  - one to many
export const UserTicketsRelations = relations(usersTable, ({many}) =>({
    userSupportTickets: many (userSupportTicketsTable)
}))

export const PaymentRelations = relations(paymentsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [paymentsTable.userId],
    references: [usersTable.userId],
  }),
  item: one(itemsTable, {
    fields: [paymentsTable.itemId],
    references: [itemsTable.itemId],
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

export type TSUserLoginInput = {
  email: string;
  password: string;
};

export type TSUserVerifyInput = {
  email: string;
  verificationCode: string;
};