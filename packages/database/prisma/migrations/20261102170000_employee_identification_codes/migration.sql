BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE hr_employees IN ACCESS EXCLUSIVE MODE;
ALTER TABLE hr_employees ADD COLUMN "identification_code" varchar(7);
WITH ranked AS (
  SELECT id, (2000000 + row_number() OVER (ORDER BY "created_at", id))::text AS code
  FROM hr_employees
)
UPDATE hr_employees c SET "identification_code" = r.code FROM ranked r WHERE c.id = r.id;
CREATE UNIQUE INDEX "hr_employees_identification_code_key" ON hr_employees("identification_code");
ALTER TABLE hr_employees ADD CONSTRAINT employee_identification_code_format CHECK ("identification_code" IS NOT NULL AND "identification_code" ~ '^2[0-9]{6}$');
CREATE SEQUENCE employee_identification_code_seq MINVALUE 2000001 MAXVALUE 2999999 NO CYCLE;
SELECT setval('employee_identification_code_seq', COALESCE((SELECT max("identification_code"::bigint) FROM hr_employees), 2000001), EXISTS(SELECT 1 FROM hr_employees));
CREATE FUNCTION assign_employee_identification_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."identification_code" IS NOT NULL THEN RAISE EXCEPTION 'Employee identification code must be generated'; END IF;
    NEW."identification_code" := nextval('employee_identification_code_seq')::text;
  ELSIF NEW."identification_code" IS DISTINCT FROM OLD."identification_code" THEN
    RAISE EXCEPTION 'Employee identification code is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employee_identification_code BEFORE INSERT OR UPDATE ON hr_employees FOR EACH ROW EXECUTE FUNCTION assign_employee_identification_code();
COMMIT;
