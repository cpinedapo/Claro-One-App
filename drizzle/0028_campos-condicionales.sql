ALTER TABLE "area_fields" DROP CONSTRAINT "area_fields_source";--> statement-breakpoint
ALTER TABLE "area_fields" ADD COLUMN "for_roles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "area_fields" ADD COLUMN "for_subareas" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "area_fields" ADD COLUMN "depends_on" bigint;--> statement-breakpoint
ALTER TABLE "area_fields" ADD COLUMN "depends_value" text;--> statement-breakpoint
ALTER TABLE "area_fields" ADD CONSTRAINT "area_fields_source" CHECK ("area_fields"."source" IN ('propias', 'lob', 'carrier', 'state', 'territorio'));--> statement-breakpoint
-- H-040 · Regla del negocio (2026-10-15): a un Doer de New Business o Growth se le pregunta si es On field; si lo es,
-- se le piden sus territorios (de Datos base). Quedan como campos de Commercial, configurables desde «Campos del área».
WITH on_field AS (
  INSERT INTO "area_fields" ("area", "label", "type", "required", "position", "for_roles", "for_subareas")
  VALUES ('Commercial', 'On field', 'si-no', true,
          (SELECT coalesce(max("position"), 0) + 1 FROM "area_fields" WHERE "area" = 'Commercial' AND "valid_to" IS NULL),
          '{doer}', '{"New Business",Growth}')
  RETURNING "id", "position"
)
INSERT INTO "area_fields" ("area", "label", "type", "source", "required", "position", "for_roles", "for_subareas", "depends_on", "depends_value")
SELECT 'Commercial', 'Territorios', 'multi-lista', 'territorio', true, "position" + 1, '{doer}', '{"New Business",Growth}', "id", 'si'
FROM on_field;
