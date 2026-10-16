-- Custom SQL migration file, put your code below! ---- H-040 · Regla del negocio (2026-10-15): a un Doer de New Business o Growth también se le pregunta qué tipo de
-- clientes atiende. Campo de Commercial, configurable desde «Campos del área».
INSERT INTO "area_fields" ("area", "label", "type", "source", "options", "required", "position", "for_roles", "for_subareas")
VALUES ('Commercial', 'Tipo de clientes que atiende', 'multi-lista', 'propias',
        '{Agente,Agencias,"Vendedor sin NPN","Benefit coordinator"}', true,
        (SELECT coalesce(max("position"), 0) + 1 FROM "area_fields" WHERE "area" = 'Commercial' AND "valid_to" IS NULL),
        '{doer}', '{"New Business",Growth}');
