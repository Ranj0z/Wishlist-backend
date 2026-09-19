import { eq } from "drizzle-orm";
import db from "../../Drizzle/db";
import { userSupportTicketsTable, TIUserSupportTickets } from "../../Drizzle/schema";

// ==========================
// Ticket Services
// ==========================

// Create Ticket
export const createTicketService = async (
  newTicket: Pick<TIUserSupportTickets, "UserID" | "subject" | "description">
) => {
  const today = new Date().toISOString().slice(0, 10);

  const [created] = await db
    .insert(userSupportTicketsTable)
    .values({ ...newTicket, created_at: today })
    .returning();

  return created;
};

// Get All Tickets (admin)
export const getAllTicketsService = async () => {
  return await db.query.userSupportTicketsTable.findMany();
};

// Get Ticket By ID
export const getTicketByIDService = async (ticketId: number) => {
  return await db.query.userSupportTicketsTable.findFirst({
    where: eq(userSupportTicketsTable.TicketID, ticketId),
  });
};

// Get Tickets By User ID
export const getTicketsByUserIDService = async (userId: number) => {
  return await db.query.userSupportTicketsTable.findMany({
    where: eq(userSupportTicketsTable.UserID, userId),
  });
};

// Update Ticket Status By ID (admin)
export const updateTicketStatusService = async (
  ticketId: number,
  ticketStatus: TIUserSupportTickets["ticketStatus"]
) => {
  const today = new Date().toISOString().slice(0, 10);

  const [updated] = await db
    .update(userSupportTicketsTable)
    .set({ ticketStatus, updated_at: today })
    .where(eq(userSupportTicketsTable.TicketID, ticketId))
    .returning();

  return updated;
};
