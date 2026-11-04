ALTER TABLE "sales" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_void_fields_consistent" CHECK (("sales"."voided_at" is null and "sales"."voided_by" is null and "sales"."void_reason" is null) or ("sales"."voided_at" is not null and "sales"."voided_by" is not null and "sales"."void_reason" is not null));