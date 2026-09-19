import { Request, Response } from "express";
import {
  createTicketService,
  getAllTicketsService,
  getTicketByIDService,
  getTicketsByUserIDService,
  updateTicketStatusService,
} from "./ticket.service";

// ==========================
// Ticket Controllers
// ==========================

// Create Ticket
// NOTE: no auth middleware yet — UserID must be passed explicitly in the
// body (same pattern as wishlists/items). Frontend's ticketsAPI currently
// only sends { subject, description } — it needs to add UserID to match.
export const createTicketController = async (req: Request, res: Response) => {
  try {
    const { UserID, subject, description } = req.body;

    if (!UserID || !subject || !description) {
      return res
        .status(400)
        .json({ message: "UserID, subject and description are required" });
    }

    const created = await createTicketService({ UserID, subject, description });

    if (!created) {
      return res.status(400).json({ message: "Ticket not created" });
    }

    return res.status(201).json({ message: "Ticket created successfully ✅", data: created });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get All Tickets (admin)
export const getAllTicketsController = async (req: Request, res: Response) => {
  try {
    const tickets = await getAllTicketsService();
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({ message: "No tickets found" });
    }
    return res.status(200).json({ data: tickets });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Ticket By ID
export const getTicketByIDController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const ticket = await getTicketByIDService(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    return res.status(200).json({ data: ticket });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Get Tickets by User ID
export const getTicketsByUserIDController = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const tickets = await getTicketsByUserIDService(userId);
    if (!tickets || tickets.length === 0) {
      return res.status(404).json({ message: "No tickets found for this user" });
    }

    return res.status(200).json({ data: tickets });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Update Ticket Status By ID (admin)
export const updateTicketStatusController = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const { ticketStatus } = req.body;
    if (!ticketStatus) {
      return res.status(400).json({ message: "ticketStatus is required" });
    }

    const updated = await updateTicketStatusService(id, ticketStatus);
    if (!updated) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Frontend expects the raw ticket (not wrapped in `data`) from this endpoint.
    return res.status(200).json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
