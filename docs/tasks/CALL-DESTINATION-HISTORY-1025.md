# CALL-DESTINATION-HISTORY-1025

PC-C; user reports missing job title/full name in contact call history. Branch starts fromd2807e20, retaining the previously requested10-second prepared routing policy.

Root cause: the native call projection captured staff display identity only after ANSWERED. Outbound ringing/no-answer calls retained only their confirmed extension in operator. Local read-only evidence found25 outbound native calls,12 lacking full recipient labels; all12 retained a valid originating extension in encrypted technical state.

Fix: new outbound calls snapshot the HR destination at creation, even before an answer. answeredAt is nullable for this case; observedAt records observation time without inventing answer evidence. Existing answer updates continue to record actual answers. Authorized history/get reads hydrate only incomplete outbound native labels from their own branch-scoped session and exact originating/answered extension through the public HR directory. Historical full snapshots always win. Manual/inbound calls and ambiguous or unknown technical extensions are untouched. Shared extensions list all matched staff. Read-time enrichment is marked labelSource CURRENT_DIRECTORY and never rewrites historical owner, stored payload, completion token, business result or technical state.

Compatibility: existing display consumers continue using label; optional observedAt/labelSource and nullable answeredAt distinguish originator identification from actual response. No public provider contract, migration, dependency or panel layout changes.

Verification:17 unit/projection/HR tests,27 isolated PostgreSQL read/telephony tests,12 Web model/form tests, scoped lint and affected API TypeScript/build pass. A read-only local recheck recovered12/12 missing outbound labels with zero remaining in that sample; no business records written. Local API rollout preserves Web3000, popup settings, existing environment and worker. No PBX change or real-call synthetic test.

Final local acceptance: API4000/PID14112 serves the fixed projection with existing flags; Web3000/PID21016 preserved. Browser verified the exact user-reported example now displays the full Sales expert title/name and extension105. Screenshot F:/DevData/Temp/call-destination-history-1025.png outside Git.56 tests plus targeted Web model typecheck/lint, API source/test typecheck/build pass. No operational data saved during browser verification.
