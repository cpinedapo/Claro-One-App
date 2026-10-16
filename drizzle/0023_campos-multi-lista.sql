ALTER TABLE "area_fields" DROP CONSTRAINT "area_fields_type";--> statement-breakpoint
ALTER TABLE "area_fields" ADD COLUMN "source" text DEFAULT 'propias' NOT NULL;--> statement-breakpoint
ALTER TABLE "area_fields" ADD CONSTRAINT "area_fields_source" CHECK ("area_fields"."source" IN ('propias', 'lob', 'carrier', 'state'));--> statement-breakpoint
ALTER TABLE "area_fields" ADD CONSTRAINT "area_fields_type" CHECK ("area_fields"."type" IN ('texto', 'numero', 'fecha', 'si-no', 'lista', 'multi-lista'));