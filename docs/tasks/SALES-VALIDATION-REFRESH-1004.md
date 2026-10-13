# SALES-VALIDATION-REFRESH-1004

PC-A; branch codex/pc-a-sales-validation-refresh-1004, base origin/develop@82272a25. User reports generic Request validation failed while confirming people in a new international contract and explicitly authorizes develop merge.

Reproduced code path: international entry legitimately accepts passport first/last names while hidden local first/last values are empty. If a previous customer creation was uncertain, registration recovery sent the empty local names to CustomerRegistrationLookupDto, which requires nonempty names even for national-ID recovery. Repeating confirmation therefore generated the same DTO validation error despite complete passport names.

The Sales recovery paths (uncertain registration, old pending identity and duplicate national-ID resolution) now use trimmed existing local names or international passport-name fallbacks. Existing-person updates use the same fallback for required name/displayName fields. Domestic required names, national-ID checksum, passport/date/gender/country validation, duplicate prevention, version checks and uncertain-result recovery remain in force. Existing nonblank local names are preserved.

Customers Web now consumes known field reasons from the existing validation error envelope and shows a bounded Persian field-specific instruction instead of Request validation failed. Business/domain errors preserve their messages and codes. No backend validation is disabled and no API/schema/migration/dependency/operational-data change is required.

Focused regression verifies corrected international registration recovery with blank hidden names, one successful creation and a cleared review flag. Error-message regression verifies named fields and unchanged duplicate/business error behavior. Full test/lint/typecheck/build outcomes are recorded in the work assignment. No authenticated live customer mutation or shared-local-runtime rollout is claimed.
