-- Disposable database only; run migration after this fixture.
CREATE TABLE hr_employees (id text PRIMARY KEY, "created_at" timestamptz NOT NULL DEFAULT now(), name text, "isActive" boolean DEFAULT true);
INSERT INTO hr_employees(id,"created_at",name,"isActive") VALUES
('c','2026-02-01','newest',true),('b','2026-01-01','inactive',false),('a','2026-01-01','oldest',true);
