BEGIN;

-- Align the persisted outcome allowlist with the existing Call Center save DTO.
-- Keep every prior value and continue rejecting outcomes outside that contract.
ALTER TABLE customer_affairs_calls
  DROP CONSTRAINT cc_call_outcome_check,
  ADD CONSTRAINT cc_call_outcome_check CHECK (
    outcome IS NULL OR outcome IN (
      'ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'WRONG_NUMBER'
    )
  );

COMMIT;
