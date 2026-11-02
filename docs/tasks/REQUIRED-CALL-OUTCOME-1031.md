# REQUIRED-CALL-OUTCOME-1031

COMPUTER_ID=PC-C. The owner requests an explicit outcome before saving the existing call popup.

## Behavior

- Existing incoming, outgoing/follow-up and completion forms show `نتیجه تماس *`, with no preselected outcome for new conversations.
- The existing search select exposes required semantics and the submit handler rejects an empty or unsupported outcome before calling save, with `نتیجه تماس را انتخاب کنید.`.
- The authenticated business-save DTO requires one of the four existing outcomes. Omitted, null, empty and invalid values fail validation before persistence. No new outcome or default is invented.
- Telephony event ingestion, automatic contact capture, incomplete historical calls, minimizing/canceling the form and refresh-popup receipts are unchanged. Provider event capture must not depend on an agent already choosing a business outcome.

## Validation and preview

Eight Web form regressions and five authenticated HTTP boundary tests pass. The latter include missing/null/empty/invalid result rejection. Scoped API/Web lint passes. The same four changed files are applied to the existing isolated localhost runtime branch, retaining its previously validated package/schema baseline. Full API build and Web typecheck/build validate that preview; no production rollout or migration is part of this change.

The primary source branch starts from develop f3632a7a9. Reusing old package artifacts there initially reported unrelated new HR shared-branch contract/schema types; preview builds therefore preserve the existing local baseline instead of changing HR data or regenerating shared runtime artifacts. Release validation for current develop still requires its own matching generated contracts/database and hosted checks.
