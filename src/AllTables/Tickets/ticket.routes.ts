import { Router } from "express";
import {
  createTicketController,
  getAllTicketsController,
  getTicketByIDController,
  getTicketsByUserIDController,
  updateTicketStatusController,
} from "./ticket.controller";

const router = Router();

// ==========================
// Ticket Routes
// ==========================

// Create a new ticket
router.post("/tickets", createTicketController);

// Get all tickets (admin)
router.get("/tickets", getAllTicketsController);

// Get tickets by user ID — before "/tickets/:id" so it isn't shadowed
router.get("/tickets/users/:userId", getTicketsByUserIDController);

// Get ticket by ID
router.get("/tickets/:id", getTicketByIDController);

// Update ticket status by ID (admin)
router.patch("/tickets/:id", updateTicketStatusController);

export default router;
