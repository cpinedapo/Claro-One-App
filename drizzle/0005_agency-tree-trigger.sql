-- agency_tree es la tabla de clausura de la jerarquía de agencias. No se escribe a mano: se deriva de
-- agencies.parent_id, que es la única fuente de verdad.
--
-- 1. Antes de guardar un parent_id se impide un ciclo (una agencia no puede quedar debajo de sí misma).
-- 2. Después de cualquier cambio de jerarquía se reconstruye la clausura completa. Es una tabla
--    chica (cientos de agencias), así que reconstruir es más simple y más seguro que parchar.

CREATE OR REPLACE FUNCTION agencies_impedir_ciclo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND (
    NEW.parent_id = NEW.id
    OR EXISTS (SELECT 1 FROM agency_tree WHERE ancestor_id = NEW.id AND descendant_id = NEW.parent_id)
  ) THEN
    RAISE EXCEPTION 'La agencia % no puede quedar debajo de % : formaría un ciclo en la jerarquía.', NEW.id, NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION agencies_reconstruir_arbol() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM agency_tree;
  INSERT INTO agency_tree (ancestor_id, descendant_id, depth)
  WITH RECURSIVE t (ancestor_id, descendant_id, depth) AS (
    SELECT id, id, 0 FROM agencies
    UNION ALL
    SELECT t.ancestor_id, a.id, t.depth + 1
    FROM t JOIN agencies a ON a.parent_id = t.descendant_id
  )
  SELECT ancestor_id, descendant_id, depth FROM t;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER agencies_ciclo
  BEFORE INSERT OR UPDATE OF parent_id ON agencies
  FOR EACH ROW EXECUTE FUNCTION agencies_impedir_ciclo();
--> statement-breakpoint
CREATE TRIGGER agencies_tree_sync
  AFTER INSERT OR UPDATE OF parent_id OR DELETE ON agencies
  FOR EACH STATEMENT EXECUTE FUNCTION agencies_reconstruir_arbol();
--> statement-breakpoint
-- Los catálogos de agencies también en la base: ningún valor fuera de la lista entra, venga de la
-- app, de una migración de datos o de un script. Ampliar un catálogo = una migración nueva.
ALTER TABLE agencies ADD CONSTRAINT agencies_status_valido
  CHECK (status IN ('active', 'inactive', 'pending_contracting', 'pending_documents'));
--> statement-breakpoint
ALTER TABLE agencies ADD CONSTRAINT agencies_communications_scope_valido
  CHECK (communications_scope IS NULL OR communications_scope IN ('parent_agency', 'agency'));
--> statement-breakpoint
ALTER TABLE agencies ADD CONSTRAINT agencies_reports_scope_valido
  CHECK (reports_scope IS NULL OR reports_scope IN ('agency', 'agents_and_agency', 'agent'));
