ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_qty_positive" CHECK ("sale_lines"."qty" > 0);--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_unit_price_nonnegative" CHECK ("sale_lines"."unit_price" >= 0);--> statement-breakpoint
ALTER TABLE "sale_lines" ADD CONSTRAINT "sale_lines_unit_cost_nonnegative" CHECK ("sale_lines"."unit_cost" >= 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sale_no_positive" CHECK ("sales"."sale_no" > 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_total_nonnegative" CHECK ("sales"."total" >= 0);--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_payment_method_valid" CHECK ("sales"."payment_method" in ('cash', 'gcash', 'maya', 'card'));