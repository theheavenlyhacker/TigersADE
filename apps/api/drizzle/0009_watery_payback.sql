CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"shift_start" time NOT NULL,
	"shift_end" time NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "staff_member_id" uuid;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_staff_member_id_staff_members_id_fk" FOREIGN KEY ("staff_member_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;