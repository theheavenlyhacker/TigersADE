CREATE TABLE "reorder_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"note" text,
	"requested_by" uuid NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reorder_requests_quantity_positive" CHECK ("reorder_requests"."quantity" > 0),
	CONSTRAINT "reorder_requests_status_valid" CHECK ("reorder_requests"."status" in ('requested','received','cancelled')),
	CONSTRAINT "reorder_requests_resolution_consistent" CHECK (("reorder_requests"."status" = 'requested') = ("reorder_requests"."resolved_by" is null and "reorder_requests"."resolved_at" is null))
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "reorder_request_id" uuid;--> statement-breakpoint
ALTER TABLE "reorder_requests" ADD CONSTRAINT "reorder_requests_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_requests" ADD CONSTRAINT "reorder_requests_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_requests" ADD CONSTRAINT "reorder_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_requests" ADD CONSTRAINT "reorder_requests_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reorder_requests_branch_status_idx" ON "reorder_requests" USING btree ("branch_id","status");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reorder_request_id_reorder_requests_id_fk" FOREIGN KEY ("reorder_request_id") REFERENCES "public"."reorder_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reorder_request_id_unique" UNIQUE("reorder_request_id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reorder_is_received" CHECK ("stock_movements"."reorder_request_id" is null or "stock_movements"."type" = 'received');