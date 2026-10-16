ALTER TABLE "baselines" DROP CONSTRAINT "baselines_kind";--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_kind" CHECK ("baselines"."kind" IN ('carrier', 'state', 'lob', 'cargo', 'area'));--> statement-breakpoint
-- Las áreas de la organización que pasó el negocio (2026-10-13). Son el área de cada persona; los
-- permisos y el menú siguen con las áreas del kit (decisión de la usuaria, H-018).
INSERT INTO "baselines" ("kind", "code", "name") VALUES
  ('area', 'BOB & Commissions', 'BOB & Commissions'),
  ('area', 'Service', 'Service'),
  ('area', 'Contracting', 'Contracting'),
  ('area', 'Quality', 'Quality'),
  ('area', 'Finance', 'Finance'),
  ('area', 'Strategy', 'Strategy'),
  ('area', 'Legal', 'Legal'),
  ('area', 'Commercial', 'Commercial');
--> statement-breakpoint
-- Cada persona pasa del área del kit a la de la organización. Plataforma (Administrador) no tiene
-- equivalente y se queda como está.
UPDATE "empleado" SET "area_id" = CASE
  WHEN "area_id" IN ('bob-commissions', 'commissions', 'bob', 'reconciliations') THEN 'BOB & Commissions'
  WHEN "area_id" IN ('broker-support', 'cos', 'cms') THEN 'Service'
  WHEN "area_id" IN ('contracting-telco', 'telco', 'contracting') THEN 'Contracting'
  WHEN "area_id" = 'quality' THEN 'Quality'
  WHEN "area_id" IN ('vpf', 'financial', 'accounting') THEN 'Finance'
  WHEN "area_id" IN ('ceo', 'vp-strategy', 'coo', 'bpl', 'product') THEN 'Strategy'
  WHEN "area_id" IN ('ceo-commercial', 'new-business', 'gr', 'comercial', 'internal-sales-dtc') THEN 'Commercial'
  ELSE "area_id" END;
