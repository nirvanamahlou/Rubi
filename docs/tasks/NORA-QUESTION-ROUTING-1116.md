# Nora question and follow-up routing — 2026-11-16

## Behavior

The Composer now arbitrates before Workbench guidance, live contract-form help,
contract advice and contract guides. Decisions distinguish procedural guidance,
data, evidence follow-up, combined data plus guidance, clarification and ordinary
conversation. A completed answer keeps its domain, bounded question context,
guide topic, selected contract and source IDs in browser-lifetime memory. Source
IDs are not reused as evidence or supplied as authorization.

Persian/Arabic characters, digits, diacritics, joiners and punctuation normalize
consistently. Unicode word boundaries replace substring matching for guide topics,
Workbench aliases, advice and saved-receipt form markers. `پرسیدم` and `رسیدگی`
do not match `رسید`; actual receipt plurals and possessives still match.

Data objections bypass all procedural helpers, even after internal navigation.
The existing v3 reader receives a bounded related question and must obtain fresh
evidence under its unchanged native authorization. A mixed request sends its data
clause first; successful data output is followed by catalog-derived correction
guidance. Error, clarification and unsupported replies never masquerade as a
successful data answer with a guide substituted for it.

Explicit Workbench topics override a previous Sales subject and use the existing
identifier-only selector/internal fallback. Employee content is not automatically
read or added to the model context. Unknown Workbench help is clarified locally
rather than falling through to Sales SQL. Account/company/branch/permission keys
retain isolation; navigation aborts obsolete responses without deleting completed
chat messages. Selecting another concrete contract invalidates the old concrete
record referent. No browser storage, API/schema/SQL grant or workflow change.

## Verification

- Focused intent, lexical and actual Composer submit-handler tests cover the user's
  reported messages, colloquial/digit/Arabic variants, bare follow-ups, missing
  referents, guide continuations and conceptual definitions.
- HTTP-mocked Composer tests cover data -> evidence follow-up across page/tab
  changes -> receipt guide, explicit hourly-leave guidance with Groq429 fallback,
  mixed question success versus429,403 isolation, changed user/company and stale
  in-flight response cancellation. These execute the actual submit event handlers
  with persistent mocked hook state; they are not live browser/Groq acceptance.
- Existing Assistant and English inventory tests pass (265 checks before the
  final date-separator regression; the additional49 focused routing/submit/native
  report/inspection checks pass). Scoped ESLint and diff checks pass. The final
  hosted head is a separate gate; no local mock proves live Groq behavior.
- Local Web compilation succeeds. Full local type/build completion is impeded by
  reused dependency links: API voucher settings cannot resolve the shared contract
  build and the linked older Web contract types lack Workbench `leaveRoute`.
  Preparing replacement local dependency links was rejected by automatic review
  with `blocked by policy`; no alternate unlink/install command was attempted.
  A clean hosted install/typecheck/build remains a distinct required gate.

## Delivery and limits

Independent branch `codex/pc-c-nora-question-routing-1116`, based on develop
`b5d7798ef`. The unfinished count-reconciliation worktree is preserved and none of
its API/service/table changes are included. There is no migration or operational
data write. Production remains unchanged; actual authenticated browser and live
Groq selection are not certified by mocked transport tests. Rollback is reverting
this source change; no data rollback is required.
