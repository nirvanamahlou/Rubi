BEGIN;
ALTER TABLE "FinanceBankAccountAudit" DROP CONSTRAINT "FinanceBankAccountAudit_action_check";
ALTER TABLE "FinanceBankAccountAudit" ADD CONSTRAINT "FinanceBankAccountAudit_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'REVEAL', 'DELETE'));
COMMIT;
