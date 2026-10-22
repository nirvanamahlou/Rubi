# CALL-CENTER-DOSSIER-CARDS-1022

Owner-authorized dossier simplification on643955c8 in isolated checkout to preserve
concurrent caller-name unit. Scope: dossier-only history navigation/request cards.

History removes newest/older navigation buttons; more records load incrementally
on scrolling, with a keyboard-focus continuation. Requests similarly retain access
to older pages without page numbers/navigation buttons. Existing server order is
createdAt descending with stable ID tie-break. New saves restart request paging.
Queue handling and follow-up controls outside the dossier remain available.

Dossier shows only title, reason, owner, priority, status, opening time, closing time
when closed, and edit button, in requested order. Editor is the existing request
form. Recorded timestamps remain system-maintained; closure uses the latest actual
open-to-closed transition from encrypted history, so closed-record edits do not
change displayed closure time. Legacy missing evidence displays unknown explicitly.
No backend/schema/permission changes. No deletion of requests or historical actions.

Validation covers ordered summary, one edit action, open/closed/reopened dates and
preservation of closure date across subsequent edits. Runtime/quality evidence is
recorded in PROJECT_STATUS. Authenticated visual acceptance requires owner login.

Focused dossier/workflow tests:4 pass. Scoped lint passes after moving the callback
ref update into an effect; duplicate focus/intersection triggers share a guard.
Runtime copies of all five changed/new Web files verified by SHA256. Compatible
runtime retains separately completed caller-name changes; no backend restart needed.
