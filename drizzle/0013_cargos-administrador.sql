-- Los cargos del rol Administrador (Configurador / Admin en el kit) que pasó el negocio (2026-10-13).
INSERT INTO "baselines" ("kind", "code", "name", "roles") VALUES
  ('cargo', 'Administrador IT', 'Administrador IT', ARRAY['configurador-admin']::text[]),
  ('cargo', 'Administrador Proyectos', 'Administrador Proyectos', ARRAY['configurador-admin']::text[]);
