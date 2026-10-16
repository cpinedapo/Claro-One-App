ALTER TABLE "baselines" DROP CONSTRAINT "baselines_kind";--> statement-breakpoint
ALTER TABLE "baselines" ADD COLUMN "roles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_kind" CHECK ("baselines"."kind" IN ('carrier', 'state', 'lob', 'cargo'));--> statement-breakpoint
-- Los cargos del rol Doer que pasó el negocio (2026-10-13). Dos son Doer / Manager. Base, no demo.
INSERT INTO "baselines" ("kind", "code", "name", "roles") VALUES
  ('cargo', 'Customer Operation Specialist', 'Customer Operation Specialist', ARRAY['doer']::text[]),
  ('cargo', 'Agent Service & Campaign Specialist', 'Agent Service & Campaign Specialist', ARRAY['doer']::text[]),
  ('cargo', 'Operational Contracting Specialist', 'Operational Contracting Specialist', ARRAY['doer']::text[]),
  ('cargo', 'Operational Contracting Specialist (Torre de control)', 'Operational Contracting Specialist (Torre de control)', ARRAY['doer']::text[]),
  ('cargo', 'Telco Analyst', 'Telco Analyst', ARRAY['doer']::text[]),
  ('cargo', 'BOB Analyst', 'BOB Analyst', ARRAY['doer']::text[]),
  ('cargo', 'Commission Analyst', 'Commission Analyst', ARRAY['doer']::text[]),
  ('cargo', 'Reconciliation Analyst', 'Reconciliation Analyst', ARRAY['doer']::text[]),
  ('cargo', 'Financial Analyst', 'Financial Analyst', ARRAY['doer']::text[]),
  ('cargo', 'Financial Professional (Commission Advance)', 'Financial Professional (Commission Advance)', ARRAY['doer', 'manager']::text[]),
  ('cargo', 'Senior Accounting Analyst', 'Senior Accounting Analyst', ARRAY['doer']::text[]),
  ('cargo', 'Administrative & Accounting Professional', 'Administrative & Accounting Professional', ARRAY['doer', 'manager']::text[]),
  ('cargo', 'Medicare Growth Specialist', 'Medicare Growth Specialist', ARRAY['doer']::text[]),
  ('cargo', 'Medicare New Business Specialist', 'Medicare New Business Specialist', ARRAY['doer']::text[]),
  ('cargo', 'Life Specialist', 'Life Specialist', ARRAY['doer']::text[]),
  ('cargo', 'P&C Specialist', 'P&C Specialist', ARRAY['doer']::text[]),
  ('cargo', 'New Business & Growth Specialist', 'New Business & Growth Specialist', ARRAY['doer']::text[]),
  ('cargo', 'Marketing Specialist', 'Marketing Specialist', ARRAY['doer']::text[]),
  ('cargo', 'Agente AtoZ', 'Agente AtoZ', ARRAY['doer']::text[]),
  ('cargo', 'Customer Operation Specialist AtoZ', 'Customer Operation Specialist AtoZ', ARRAY['doer']::text[]),
  ('cargo', 'Quality Coordinator', 'Quality Coordinator', ARRAY['doer']::text[]);
