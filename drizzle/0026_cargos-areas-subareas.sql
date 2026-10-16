ALTER TABLE "baselines" ADD COLUMN "parent" text;--> statement-breakpoint
ALTER TABLE "baselines" ADD COLUMN "areas" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "empleado" ADD COLUMN "cargos" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- H-038 · Áreas con sub-áreas, cargos con su rol y su área, y personas con varios cargos (lista del negocio, 2026-10-15).
-- Áreas principales nuevas
INSERT INTO "baselines" ("kind", "code", "name") VALUES
  ('area', 'Operations', 'Operations'),
  ('area', 'Management CEO', 'Management CEO');--> statement-breakpoint
-- Sub-áreas nuevas
INSERT INTO "baselines" ("kind", "code", "name", "parent") VALUES
  ('area', 'Telecomunicaciones', 'Telecomunicaciones', 'Operations'),
  ('area', 'Growth', 'Growth', 'Commercial'),
  ('area', 'New Business', 'New Business', 'Commercial'),
  ('area', 'Marketing', 'Marketing', 'Strategy'),
  ('area', 'Technology', 'Technology', 'Strategy'),
  ('area', 'Product', 'Product', 'Strategy');--> statement-breakpoint
-- Las que eran áreas y ahora son sub-áreas de Operations
UPDATE "baselines" SET "parent" = 'Operations'
WHERE "kind" = 'area' AND "valid_to" IS NULL AND "code" IN ('BOB & Commissions', 'Service', 'Contracting', 'Quality');--> statement-breakpoint
-- Legal deja de ser un área: es un cargo de Management CEO. Se cierra, no se borra.
UPDATE "baselines" SET "valid_to" = CURRENT_DATE WHERE "kind" = 'area' AND "code" = 'Legal' AND "valid_to" IS NULL;--> statement-breakpoint
-- Cargos que salen de la lista
UPDATE "baselines" SET "valid_to" = CURRENT_DATE
WHERE "kind" = 'cargo' AND "valid_to" IS NULL AND "code" IN ('Agente AtoZ', 'Operational Contracting Specialist (Torre de control)');--> statement-breakpoint
-- Cargos nuevos
INSERT INTO "baselines" ("kind", "code", "name", "roles", "areas") VALUES
  ('cargo', 'Operational Contracting Coordinator', 'Operational Contracting Coordinator', '{coordinator}', '{Contracting}'),
  ('cargo', 'Legal', 'Legal', '{ceo-level}', '{"Management CEO"}');--> statement-breakpoint
-- Rol y área (o sub-áreas) de cada cargo
UPDATE "baselines" b SET "roles" = v.roles, "areas" = v.areas
FROM (VALUES
  ('Agent Service & Campaign Specialist', '{doer}'::text[], '{Service}'::text[]),
  ('BOB Analyst', '{doer}', '{"BOB & Commissions"}'),
  ('Commission Analyst', '{doer}', '{"BOB & Commissions"}'),
  ('Customer Operation Specialist', '{doer}', '{Service}'),
  ('Customer Operation Specialist AtoZ', '{doer}', '{Service}'),
  ('Financial Analyst', '{doer}', '{Finance}'),
  ('Life Specialist', '{doer}', '{Growth}'),
  ('Marketing Specialist', '{doer}', '{Marketing}'),
  ('Medicare Growth Specialist', '{doer}', '{Growth}'),
  ('Medicare New Business Specialist', '{doer}', '{"New Business"}'),
  ('New Business & Growth Specialist', '{doer}', '{"New Business",Growth}'),
  ('Operational Contracting Specialist', '{doer}', '{Contracting}'),
  ('P&C Specialist', '{doer}', '{Growth}'),
  ('Reconciliation Analyst', '{doer}', '{"BOB & Commissions"}'),
  ('Senior Accounting Analyst', '{doer}', '{Finance}'),
  ('Telco Analyst', '{doer}', '{Telecomunicaciones}'),
  ('Quality Coordinator', '{coordinator}', '{Quality}'),
  ('BOB & Commission Manager', '{manager}', '{"BOB & Commissions"}'),
  ('Contracting & Telco Manager', '{manager}', '{Contracting}'),
  ('Customer Operation Manager', '{manager}', '{Service}'),
  ('Life Manager', '{manager}', '{Growth}'),
  ('Medicare Manager', '{manager}', '{Growth}'),
  ('Administrative & Accounting Professional', '{manager}', '{Finance}'),
  ('Financial Professional (Commission Advance)', '{manager}', '{Finance}'),
  ('New Business & Growth Manager', '{manager}', '{"New Business",Growth}'),
  ('P&C Manager', '{manager}', '{Growth}'),
  ('CEO Manager', '{ceo-level}', '{"Management CEO"}'),
  ('Chief Growth Officer', '{ceo-level}', '{"Management CEO"}'),
  ('Chief Operating Officer', '{ceo-level}', '{"Management CEO"}'),
  ('President', '{ceo-level}', '{"Management CEO"}'),
  ('VP of Finance', '{ceo-level}', '{"Management CEO"}'),
  ('VP of Strategy', '{ceo-level}', '{"Management CEO"}'),
  ('Administrador IT', '{configurador-admin}', '{Technology}'),
  ('Administrador Proyectos', '{configurador-admin}', '{Product}')
) AS v(code, roles, areas)
WHERE b."kind" = 'cargo' AND b."valid_to" IS NULL AND b."code" = v.code;--> statement-breakpoint
-- Cada persona: su cargo de hoy pasa a la lista de cargos, y su área sale del cargo
UPDATE "empleado" e SET "cargos" = ARRAY[e."puesto"], "area_id" = b."areas"[1]
FROM "baselines" b
WHERE b."kind" = 'cargo' AND b."valid_to" IS NULL AND b."code" = e."puesto" AND cardinality(b."areas") > 0;
