-- Journal d'audit en ajout seul.
-- Même avec un accès applicatif compromis, une entrée déjà écrite ne peut
-- être ni modifiée, ni supprimée, ni effacée par TRUNCATE.

CREATE OR REPLACE FUNCTION stockely_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs est en ajout seul : modification interdite';
END;
$$;

CREATE TRIGGER audit_logs_reject_update_delete
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION stockely_reject_audit_mutation();

CREATE TRIGGER audit_logs_reject_truncate
BEFORE TRUNCATE ON "audit_logs"
FOR EACH STATEMENT
EXECUTE FUNCTION stockely_reject_audit_mutation();
