CREATE TYPE "public"."status" AS ENUM('Pending', 'In Progress', 'Closed');--> statement-breakpoint
CREATE TABLE "ticket" (
	"TicketID" serial PRIMARY KEY NOT NULL,
	"UserID" integer NOT NULL,
	"subject" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"status" "status" DEFAULT 'Pending',
	"created_date" date NOT NULL,
	"updated_date" date
);
--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_UserID_users_user_id_fk" FOREIGN KEY ("UserID") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;