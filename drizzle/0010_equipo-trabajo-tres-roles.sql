-- El equipo de trabajo de Claro queda con tres roles: COS, GS (Growth Specialist) y LOB specialist
-- (pedido del negocio, 2026-10-13). Las asignaciones vigentes con un rol que sale se CIERRAN hoy, no
-- se borran: su historia queda. El CHECK solo exige el catálogo nuevo a lo vigente.
UPDATE agency_work_team SET valid_to = CURRENT_DATE
  WHERE valid_to IS NULL AND role NOT IN ('cos', 'growth-specialist', 'lob-specialist');
--> statement-breakpoint
ALTER TABLE agency_work_team DROP CONSTRAINT agency_work_team_role_valido;
--> statement-breakpoint
ALTER TABLE agency_work_team ADD CONSTRAINT agency_work_team_role_valido
  CHECK (valid_to IS NOT NULL OR role IN ('cos', 'growth-specialist', 'lob-specialist'));
