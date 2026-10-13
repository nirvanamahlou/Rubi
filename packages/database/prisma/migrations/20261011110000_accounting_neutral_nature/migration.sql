-- Extend the observed account nature options without rewriting existing accounts.
-- Replacing both clauses in one ALTER keeps the level restriction in force.
ALTER TABLE accounting_accounts
  DROP CONSTRAINT accounting_chart_level,
  ADD CONSTRAINT accounting_chart_level
    CHECK (level IN ('GROUP', 'GENERAL', 'SUBSIDIARY') AND nature IN ('DEBIT', 'CREDIT', 'ANY'));
