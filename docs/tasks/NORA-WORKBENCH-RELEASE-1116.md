# Nora Workbench Production release — 2026-11-16

The owner explicitly authorized final review, merge of PR1733, publication to the main ERP and authenticated browser acceptance. COMPUTER_ID PC-C; receipt branch codex/pc-c-nora-workbench-release-1116. Reviewed head3fa697ff9fd51bf60b5ae182bee12b24069b01cc passed all9 exact-head hosted checks (two test, quality, build and PostgreSQL gates plus read-boundary). PR1733 merged to develop as b6fff7d2a1fed9a5406d92b324947a1d1eca18a0 using the verified Amin-tech11 account.

## Bounded publication

Prepared and activated under the shared `/opt/rubi/avina-deploy.lock`. Production currently contains peer overlays; publication therefore three-way merged only the owned guide additions against reviewed basefe0cd4fa9, retaining live unrelated source and translations. The new Web image derives from the actual live `rubi-production:website-ticket-logo-web-1115` image. Existing public-assets mounts, runtime configuration, old static assets and dependencies were preserved. Build ran without network access and passed compilation, TypeScript and static-page generation. Native service tests also passed against the effective preserved source before activation.

Main Web image: `rubi-production:nora-workbench-1733-1116-web`. Main Nora container: `rubi-nora-assistant`; source/runtime mounts now use `/opt/rubi/nora-workbench-1733-1116/`. The custom runtime explicitly passes `workbenchGuide: workbenchGuideConfiguration()` to createAssistantServer; merely adding files would otherwise leave the selector in internal fallback mode. Its existing Germany-only startup admission, TLS, private proxy, Groq configuration and IAM remain intact. Added narrowly scoped BFF ingress and native service ingress, preserving the canonical public Origin check before private Next Origin normalization. No authentication or CSRF checks were disabled.

API, worker, SQL read-boundary container IDs were verified unchanged across activation. No migration, dependency, IAM grant or business-row mutation was performed. No real leave/request/message/note/file was created or edited for acceptance.

## Authenticated browser evidence

On the main HTTPS ERP, through the normal floating chat and the signed-in user's native session:

| Check | Observed result |
| --- | --- |
| Hourly leave question | Actual navigation and steps, HTTP200; topic leave-hourly, goal steps, selection model |
| Follow-up “بعدش چی؟” | Preserved leave-hourly topic, goal follow-up, HTTP200, selection model |
| Navigation link | Opened the real requests tab; previous chat/topic context cleared on tab change |
| Mixed leave/advance question | Asked which topic the user intended; no random topic selection |
| Rejected-leave question | request-status/troubleshoot, HTTP200, selection model; explicitly stated the real rejection reason had not been read |
| Contract creation question | Existing canonical eight-step contract guide and navigation arrows remained intact |
| Notes tab/context change | Previous request conversation cleared; actual notes tab and floating chat remained usable |
| Checklist question | note-checklist/steps, HTTP200, selection model; steps, limitation, next action and real notes link displayed |
| Request privacy | All4 observed guide bodies contained only version/topicId/goal; no raw question, history or employee/file content |
| RTL/readability | Inspected rendered screenshot; Persian steps and approved navigation arrows present |

These are actual Groq native-tool selections validated by the service, not an HTTP200 fallback inference: all4 response bodies explicitly carried selection=model. Germany proxy admission was enforced at startup and the ERP tunnel remained active. No shared tunnel was stopped for negative testing.

Public security controls: missing-Origin BFF403; foreign-Origin BFF403; valid public Origin without session401; native endpoint without session401. Main HTTPS login, Nora health and SQL read-boundary health remained successful. Prior deterministic provider failure/quota/cancellation and fallback tests are recorded in NORA-WORKBENCH-GUIDE-1115; no production outage was induced.

This certifies the sampled procedural workflows above and live tool selection. It does not claim every HR workflow was submitted on Production, a second-account authorization matrix, or the independent30-case Sales financial acceptance. Those are separate from static Workbench guidance.

## Recovery and handoff

Root-only server receipts, source hashes, baseline container IDs, prior Compose/Nginx configuration and private runtime environment are in `/opt/rubi/nora-workbench-1733-1116/`. Retained prior Nora container: `rubi-nora-before-workbench-1733` (stopped). Before rollback, acquire the shared lease and verify no later peer publication. Restore only this release's prior Web image/configuration and Nora container/source/runtime; restore the bounded Nginx additions, validate nginx and Compose, then reload/recreate affected services. Preserve later peer changes. No database rollback is required; do not delete shared locks, roles or data.

Implementation/translation leases from NORA-WORKBENCH-GUIDE-1115 and this release are complete. Future edits must reserve a new work item. Fetch the merged develop source and preserve the custom-runtime selector wiring and the BFF Origin adapter in future releases. Secrets, headers, cookies and customer/employee records are excluded from this receipt and Git.
