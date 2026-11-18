-- Queue only a website revision when a currently attached airline logo source changes.
-- Image bytes remain behind Documents policy and are normalized by Site Commerce.
CREATE FUNCTION website_catalog_logo_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  document_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_TABLE_NAME = 'documents' THEN
    IF TG_OP <> 'INSERT' THEN
      document_ids := array_append(document_ids, OLD.id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
      document_ids := array_append(document_ids, NEW.id);
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN document_ids := array_append(document_ids, OLD.document_id); END IF;
    IF TG_OP <> 'DELETE' THEN document_ids := array_append(document_ids, NEW.document_id); END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM master_airlines WHERE "logoFileReference" = ANY(document_ids)) THEN
    UPDATE website_catalog_deliveries SET revision = revision + 1
      WHERE "siteCode" = 'nss';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER website_airline_logo_document_changed AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION website_catalog_logo_source_changed();
CREATE TRIGGER website_airline_logo_version_changed AFTER INSERT OR UPDATE OR DELETE ON document_versions
  FOR EACH ROW EXECUTE FUNCTION website_catalog_logo_source_changed();
CREATE TRIGGER website_airline_logo_relation_changed AFTER INSERT OR UPDATE OR DELETE ON document_relations
  FOR EACH ROW EXECUTE FUNCTION website_catalog_logo_source_changed();
