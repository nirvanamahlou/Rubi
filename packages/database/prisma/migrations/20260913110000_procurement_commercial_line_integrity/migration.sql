-- PROCUREMENT-001: preserve pinned commercial version lines and exact accounting.
-- No rounding rule is invented: multiplication requiring more than four fractional
-- digits cannot equal the stored Decimal(24,4) total and is rejected.
ALTER TABLE "procurement_quotation_item"
  ADD CONSTRAINT "procurement_quotation_item_total_check" CHECK (
    "quantity" <> 'NaN'::numeric AND "unitPrice" <> 'NaN'::numeric
    AND "discountAmount" <> 'NaN'::numeric AND "taxAmount" <> 'NaN'::numeric
    AND "extraCostAmount" <> 'NaN'::numeric AND "totalAmount" <> 'NaN'::numeric
    AND "discountAmount" <= "quantity" * "unitPrice"
    AND "totalAmount" = "quantity" * "unitPrice" - "discountAmount" + "taxAmount" + "extraCostAmount"
  );

ALTER TABLE "procurement_order_item"
  ADD CONSTRAINT "procurement_order_item_total_check" CHECK (
    "quantity" <> 'NaN'::numeric AND "unitPrice" <> 'NaN'::numeric
    AND "discountAmount" <> 'NaN'::numeric AND "taxAmount" <> 'NaN'::numeric
    AND "extraCostAmount" <> 'NaN'::numeric AND "totalAmount" <> 'NaN'::numeric
    AND "discountAmount" <= "quantity" * "unitPrice"
    AND "totalAmount" = "quantity" * "unitPrice" - "discountAmount" + "taxAmount" + "extraCostAmount"
  );

ALTER TABLE "procurement_invoice_item"
  ADD CONSTRAINT "procurement_invoice_item_total_check" CHECK (
    "quantity" <> 'NaN'::numeric AND "unitPrice" <> 'NaN'::numeric
    AND "discountAmount" <> 'NaN'::numeric AND "taxAmount" <> 'NaN'::numeric
    AND "extraCostAmount" <> 'NaN'::numeric AND "totalAmount" <> 'NaN'::numeric
    AND "discountAmount" <= "quantity" * "unitPrice"
    AND "totalAmount" = "quantity" * "unitPrice" - "discountAmount" + "taxAmount" + "extraCostAmount"
  );

CREATE TRIGGER "procurement_quotation_item_immutable"
  BEFORE UPDATE OR DELETE ON "procurement_quotation_item"
  FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();

CREATE TRIGGER "procurement_order_item_immutable"
  BEFORE UPDATE OR DELETE ON "procurement_order_item"
  FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();

CREATE TRIGGER "procurement_invoice_item_immutable"
  BEFORE UPDATE OR DELETE ON "procurement_invoice_item"
  FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
