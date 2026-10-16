-- Los cargos de Manager, C-Level y CEO que pasó el negocio (2026-10-13). El kit tiene un solo rol para el
-- nivel ejecutivo ('ceo-level'): C-Level y CEO van ahí. Base, no demo.
INSERT INTO "baselines" ("kind", "code", "name", "roles") VALUES
  ('cargo', 'BOB & Commission Manager', 'BOB & Commission Manager', ARRAY['manager']::text[]),
  ('cargo', 'Customer Operation Manager', 'Customer Operation Manager', ARRAY['manager']::text[]),
  ('cargo', 'Contracting & Telco Manager', 'Contracting & Telco Manager', ARRAY['manager']::text[]),
  ('cargo', 'New Business & Growth Manager', 'New Business & Growth Manager', ARRAY['manager']::text[]),
  ('cargo', 'Medicare Manager', 'Medicare Manager', ARRAY['manager']::text[]),
  ('cargo', 'P&C Manager', 'P&C Manager', ARRAY['manager']::text[]),
  ('cargo', 'Life Manager', 'Life Manager', ARRAY['manager']::text[]),
  ('cargo', 'Chief Operating Officer', 'Chief Operating Officer', ARRAY['ceo-level']::text[]),
  ('cargo', 'VP of Strategy', 'VP of Strategy', ARRAY['ceo-level']::text[]),
  ('cargo', 'VP of Finance', 'VP of Finance', ARRAY['ceo-level']::text[]),
  ('cargo', 'Chief Growth Officer', 'Chief Growth Officer', ARRAY['ceo-level']::text[]),
  ('cargo', 'President', 'President', ARRAY['ceo-level']::text[]),
  ('cargo', 'CEO Manager', 'CEO Manager', ARRAY['ceo-level']::text[]);
