-- El catálogo de roles del equipo de trabajo de Claro también en la base (H-017).
-- Ampliarlo = una migración nueva (y sumar el rol en ROLES_EQUIPO_CLARO y en los textos).
ALTER TABLE agency_work_team ADD CONSTRAINT agency_work_team_role_valido
  CHECK (role IN ('cos', 'growth-specialist', 'account-executive', 'remote-bdr', 'customer-service'));
