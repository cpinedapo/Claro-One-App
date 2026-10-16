ALTER TABLE "lead_imports" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_imports" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "lead_imports" ADD CONSTRAINT "lead_imports_deleted_by_empleado_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."empleado"("id") ON DELETE no action ON UPDATE no action;