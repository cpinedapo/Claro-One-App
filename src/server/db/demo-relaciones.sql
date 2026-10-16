-- Demo (H-017): direcciones, líneas de negocio, labels y equipo de trabajo de las agencias de demostración.
-- Lo ejecuta `pnpm db:seed` cuando agency_lobs está vacía. Inventado: ninguna dirección es de una agencia real.
UPDATE agencies SET address_street='1200 Brickell Ave, Suite 1500', address_city='Miami', address_state='FL', address_zip='33131' WHERE name LIKE 'Distribuidora Claro%';
UPDATE agencies SET address_street='8800 NW 36th St', address_city='Doral', address_state='FL', address_zip='33178' WHERE name='Sol Insurance';
UPDATE agencies SET address_street='2500 N Military Trl', address_city='Boca Raton', address_state='FL', address_zip='33431' WHERE name LIKE 'Sol Insurance — Florida%';
UPDATE agencies SET address_street='4100 W Flagler St', address_city='Miami', address_state='FL', address_zip='33134' WHERE name='Agencia Vista Sur';
UPDATE agencies SET address_street='700 S Rosemary Ave', address_city='West Palm Beach', address_state='FL', address_zip='33401' WHERE name='Costa Brava Insurance';
UPDATE agencies SET address_street='390 N Orange Ave', address_city='Orlando', address_state='FL', address_zip='32801' WHERE name='Red Insurance';
UPDATE agencies SET address_street='5300 W Cypress St', address_city='Tampa', address_state='FL', address_zip='33607' WHERE name='Andes Coverage Group';
INSERT INTO agency_lobs (agency_id, lob, valid_from)
SELECT a.id, l.lob, DATE '2025-01-15' FROM agencies a JOIN (VALUES
  ('Sol Insurance','Medicare'),('Sol Insurance','Life'),('Sol Insurance','P&C'),
  ('Agencia Vista Sur','Life'),('Agencia Vista Sur','Discount Medical Plans'),
  ('Red Insurance','Medicare'),('Red Insurance','ACA'),
  ('Costa Brava Insurance','Life')) AS l(agencia, lob) ON a.name = l.agencia
WHERE NOT EXISTS (SELECT 1 FROM agency_lobs x WHERE x.agency_id = a.id AND x.lob = l.lob AND x.valid_to IS NULL);
INSERT INTO agency_labels (agency_id, label, valid_from)
SELECT a.id, l.label, DATE '2026-09-10' FROM agencies a JOIN (VALUES
  ('Sol Insurance','Cuenta prioritaria'),('Sol Insurance','Retención 30% en revisión'),
  ('Costa Brava Insurance','Onboarding en curso')) AS l(agencia, label) ON a.name = l.agencia
WHERE NOT EXISTS (SELECT 1 FROM agency_labels x WHERE x.agency_id = a.id AND x.label = l.label AND x.valid_to IS NULL);
INSERT INTO agency_work_team (agency_id, employee_id, role, valid_from)
SELECT a.id, w.emp, w.rol, DATE '2025-02-01' FROM agencies a JOIN (VALUES
  ('Sol Insurance','emp-lucia-ramos','cos'),('Sol Insurance','emp-jorge-nieto','lob-specialist'),
  ('Agencia Vista Sur','emp-diego-paredes','growth-specialist'),('Agencia Vista Sur','emp-lucia-ramos','cos'),
  ('Red Insurance','emp-carlos-mora','lob-specialist')) AS w(agencia, emp, rol) ON a.name = w.agencia
WHERE EXISTS (SELECT 1 FROM empleado e WHERE e.id = w.emp)
  AND NOT EXISTS (SELECT 1 FROM agency_work_team x WHERE x.agency_id = a.id AND x.employee_id = w.emp AND x.role = w.rol AND x.valid_to IS NULL);
