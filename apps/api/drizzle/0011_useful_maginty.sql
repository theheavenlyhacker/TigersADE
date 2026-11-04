CREATE TABLE "cash_closes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"opening_float" bigint NOT NULL,
	"cash_sales" bigint NOT NULL,
	"expected_cash" bigint NOT NULL,
	"counted_cash" bigint NOT NULL,
	"variance" bigint NOT NULL,
	"note" text,
	"submitted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_closes_branch_business_date_unique" UNIQUE("branch_id","business_date")
);
--> statement-breakpoint
ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;