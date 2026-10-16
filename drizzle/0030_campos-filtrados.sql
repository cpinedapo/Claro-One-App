ALTER TABLE "area_fields" ADD COLUMN "filter_by" bigint;--> statement-breakpoint
-- H-041 · Regla del negocio (2026-10-15): On field = Sí → Estados → Territorios, y los estados filtran los territorios.
-- «Estados» va entre «On field» y «Territorios»: los de después corren un lugar.
UPDATE "area_fields" SET "position" = "position" + 1
WHERE "area" = 'Commercial' AND "valid_to" IS NULL
  AND "position" > (SELECT "position" FROM "area_fields" WHERE "area" = 'Commercial' AND "label" = 'On field' AND "valid_to" IS NULL);--> statement-breakpoint
WITH on_field AS (
  SELECT "id", "position" FROM "area_fields" WHERE "area" = 'Commercial' AND "label" = 'On field' AND "valid_to" IS NULL
), estados AS (
  INSERT INTO "area_fields" ("area", "label", "type", "source", "required", "position", "for_roles", "for_subareas", "depends_on", "depends_value")
  SELECT 'Commercial', 'Estados', 'multi-lista', 'state', true, "position" + 1, '{doer}', '{"New Business",Growth}', "id", 'si'
  FROM on_field
  RETURNING "id"
)
UPDATE "area_fields" SET "filter_by" = (SELECT "id" FROM estados)
WHERE "area" = 'Commercial' AND "label" = 'Territorios' AND "valid_to" IS NULL;
