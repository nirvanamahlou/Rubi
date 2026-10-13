-- Request results and financial command evidence are append-only.
CREATE FUNCTION accounting_guard_command_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'accounting command audit is immutable';
END $$;
CREATE TRIGGER accounting_command_immutable BEFORE UPDATE OR DELETE ON accounting_commands
FOR EACH ROW EXECUTE FUNCTION accounting_guard_command_audit();
