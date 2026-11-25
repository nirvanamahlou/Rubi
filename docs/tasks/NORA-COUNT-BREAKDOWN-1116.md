# Nora contract count reconciliation

Owner asks for an inspectable calculation rather than an unexplained number.
The example table is illustrative, not a prescribed response layout. The shared
rule now covers every Nora module and future tools; see the
[calculation explanation contract](../assistant/CALCULATION-EXPLANATION-CONTRACT.md).

## Definition and boundary

The additive authenticated `POST /api/v1/sales/assistant-agent/count-breakdown`
accepts only the current contextId. Native IAM supplies company, all/branch/own
scope and hidden-record exclusion. It rechecks the context before release. The
fixed Sales-owned reader uses one read-only RepeatableRead snapshot and the
Reservations public latest-intake/latest-revision cancellation reader. The model
cannot supply predicates, SQL, identifiers or credentials to this endpoint.
The existing model-authored SQL connection/admission restrictions are unchanged.

Disjoint populations:

1. Default panel list: Sales status is not CANCELLED and latest Reservations
   lifecycle is not cancelled.
2. Sales CANCELLED, even if Reservations also records cancellation.
3. Latest Reservations CANCELLED while Sales is not CANCELLED.
4. Total is exactly 1 + 2 + 3. The active KPI additionally removes COMPLETED
   from group1; it must not be equated with an arbitrary raw COUNT.

The result is all-time with the current authorized company/scope. It does not
claim to reproduce custom search/date/list filters. There is no row mutation or
inference about why a cancellation happened. More than50,000 visible rows,
timeouts and source failure produce a controlled unavailable error, never zero.

## Orchestration and display

`contract_count_breakdown` is a bounded native tool alongside curated SQL tools.
Groq is instructed to select it for all-time counts, active counts and panel
discrepancies. It consumes the same query/turn/context budgets. Counts are checked
for safe nonnegative integers, disjoint sum and active/completed reconciliation.
Fresh resultId references and context checks remain mandatory. Groq authors the
answer and calculation explanation, choosing prose/table/formula freely; the
previous deterministic count formatter has been removed. SQL AST and monetary
sources mark computed evidence, independently of source/module names. A computed
answer missing its explanation gets one bounded formatting repair without
rerunning SQL; repeated failure is not delivered as an unexplained number.
Source metadata contains no raw rows or internal calculation flags. Explainable
format admission is not a proof of business correctness; tool arithmetic and
semantic acceptance remain independent checks.

The existing chat safely renders pipe tables using React text nodes, with RTL
and horizontal overflow. HTML is never interpreted. Existing chat bubble styles,
navigation lifetime, provider history bounds and guide behavior are preserved.
Count/evidence follow-ups no longer get intercepted by procedural contract help.

## Validation / release

After refinement,110 service tests,235 Assistant Web tests and81 API/boundary
tests pass (36 gated skips). The previous head also passed all10 hosted gates.
Those hosted results do not apply to the refined head until its checks run.
Scoped API/Web lint passes, including count/cancellation follow-up and source-kind
schema regressions. No live Groq or browser acceptance of this new final-protocol
field is claimed.

Local full API types/build are blocked by the old linked dependency artifacts:
missing sharp and the generated WebsitePublication.presentation field. Local
Web types report the old generated WorkbenchRequestOptionsV1.leaveRoute, and the
default Turbopack build rejects the pre-existing node_modules junction outside
its filesystem root. No gate/assertion was removed. An independent verification
worktree was created without changing the shared modules, but its frozen install
was stopped after the local store advanced only32/931 packages; no dependency or
lockfile source changed. Hosted clean-install checks remain required. These
local failures are not reported as a passing build.

No migration, dependency, database fixture on Production, live source mutation,
runtime replacement or deployment is part of this task. Release requires the
read-boundary API, Nora service and Web together. Rollback is the prior images
and service source; there is no data rollback. Live Groq tool selection and
authenticated browser acceptance of this new endpoint remain separate gates.

## Authenticated personal count

The normal Web composer reads `GET /api/v1/sales/assistant-agent/my-contract-count` for an unfiltered personal count. The Sales owner binds the owner ID to the authenticated actor and intersects the predicate with the selected company, authorized branch scope and visible contracts. The response includes `observedAt`, the all-status total and the count in the Sales panel after effective Sales and Reservations cancellations. The endpoint has no actor, date or scope inputs. Additional requested filters stay explicit in the conversation. The standard ERP Sales permissions and a release-time scope recheck apply, including for users who have organization-wide read access.
