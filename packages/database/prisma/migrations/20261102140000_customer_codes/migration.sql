BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE customers IN ACCESS EXCLUSIVE MODE;
ALTER TABLE customers ADD COLUMN "customerCode" varchar(7);
WITH ranked AS (
  SELECT id, (4000000 + row_number() OVER (ORDER BY "createdAt", id))::text AS code
  FROM customers
)
UPDATE customers c SET "customerCode" = r.code FROM ranked r WHERE c.id = r.id;
CREATE UNIQUE INDEX "customers_customerCode_key" ON customers("customerCode");
ALTER TABLE customers ADD CONSTRAINT customer_code_format CHECK ("customerCode" IS NOT NULL AND "customerCode" ~ '^4[0-9]{6}$');
CREATE SEQUENCE customer_code_seq MINVALUE 4000001 MAXVALUE 4999999 NO CYCLE;
SELECT setval('customer_code_seq', COALESCE((SELECT max("customerCode"::bigint) FROM customers), 4000001), EXISTS(SELECT 1 FROM customers));
CREATE FUNCTION assign_customer_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."customerCode" IS NOT NULL THEN RAISE EXCEPTION 'Customer code must be generated'; END IF;
    NEW."customerCode" := nextval('customer_code_seq')::text;
  ELSIF NEW."customerCode" IS DISTINCT FROM OLD."customerCode" THEN
    RAISE EXCEPTION 'Customer code is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER customer_code BEFORE INSERT OR UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION assign_customer_code();
COMMIT;
