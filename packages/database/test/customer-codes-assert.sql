DO $$
BEGIN
  IF (SELECT "customerCode" FROM customers WHERE id='a') <> '4000001' OR
     (SELECT "customerCode" FROM customers WHERE id='b') <> '4000002' OR
     (SELECT "customerCode" FROM customers WHERE id='c') <> '4000003' THEN
    RAISE EXCEPTION 'Chronological backfill or tie-break failed';
  END IF;
  INSERT INTO customers(id,name) VALUES ('d','new');
  IF (SELECT "customerCode" FROM customers WHERE id='d') <> '4000004' THEN RAISE EXCEPTION 'Allocation failed'; END IF;
  UPDATE customers SET name='edited' WHERE id='d';
  BEGIN
    UPDATE customers SET "customerCode"='4000099' WHERE id='d';
    RAISE EXCEPTION 'Recode accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Customer code is immutable' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO customers(id,"customerCode") VALUES ('forged','4000099');
    RAISE EXCEPTION 'Explicit code accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Customer code must be generated' THEN RAISE; END IF;
  END;
  DELETE FROM customers WHERE id='d';
  INSERT INTO customers(id,name) VALUES ('e','replacement');
  IF (SELECT "customerCode" FROM customers WHERE id='e') <> '4000005' THEN RAISE EXCEPTION 'Deleted code reused'; END IF;
END $$;
