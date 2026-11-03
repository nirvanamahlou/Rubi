DO $$
BEGIN
  IF (SELECT "identification_code" FROM hr_employees WHERE id='a') <> '2000001' OR
     (SELECT "identification_code" FROM hr_employees WHERE id='b') <> '2000002' OR
     (SELECT "identification_code" FROM hr_employees WHERE id='c') <> '2000003' THEN
    RAISE EXCEPTION 'Chronological backfill or tie-break failed';
  END IF;
  INSERT INTO hr_employees(id,name) VALUES ('d','new');
  IF (SELECT "identification_code" FROM hr_employees WHERE id='d') <> '2000004' THEN RAISE EXCEPTION 'Allocation failed'; END IF;
  UPDATE hr_employees SET name='edited' WHERE id='d';
  BEGIN
    UPDATE hr_employees SET "identification_code"='2000099' WHERE id='d';
    RAISE EXCEPTION 'Recode accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Employee identification code is immutable' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO hr_employees(id,"identification_code") VALUES ('forged','2000099');
    RAISE EXCEPTION 'Explicit code accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Employee identification code must be generated' THEN RAISE; END IF;
  END;
  DELETE FROM hr_employees WHERE id='d';
  INSERT INTO hr_employees(id,name) VALUES ('e','replacement');
  IF (SELECT "identification_code" FROM hr_employees WHERE id='e') <> '2000005' THEN RAISE EXCEPTION 'Deleted code reused'; END IF;
END $$;
