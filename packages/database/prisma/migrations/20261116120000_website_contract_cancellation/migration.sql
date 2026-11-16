-- Only a linked cancellation queues an existing signed website snapshot.
-- The revision change is atomic with the native cancellation transaction.
CREATE FUNCTION website_contract_cancellation_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'CANCELLED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE website_catalog_deliveries AS delivery SET revision = delivery.revision + 1
    WHERE EXISTS (SELECT 1 FROM website_orders AS link WHERE link."contractId" = NEW.id
      AND link."siteCode" = delivery."siteCode" AND link."branchId" = delivery."branchId")
      AND delivery."branchId" = NEW.branch_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER website_contract_cancelled AFTER UPDATE OF status ON sales_contracts
  FOR EACH ROW EXECUTE FUNCTION website_contract_cancellation_changed();
CREATE FUNCTION website_cancelled_contract_linked() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM sales_contracts WHERE id = NEW."contractId" AND branch_id = NEW."branchId" AND status = 'CANCELLED') THEN
    UPDATE website_catalog_deliveries SET revision = revision + 1
      WHERE "siteCode" = NEW."siteCode" AND "branchId" = NEW."branchId";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER website_cancelled_contract_linked AFTER INSERT ON website_orders
  FOR EACH ROW EXECUTE FUNCTION website_cancelled_contract_linked();
