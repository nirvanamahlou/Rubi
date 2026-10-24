# Call domain — 2026-10-24

PC-C, base develop e6f81c54. User approves all company queues and extensions,
external inbound and employee-to-external outbound calls, excluding internal
employee calls from customer history. Persist unanswered/busy/abandoned calls.
Answered extension determines organizational attribution. For unanswered inbound,
destination queue/extension determines the manager; unknown/unmanaged destination
is executive/demo only. No new UI or PBX Originate behavior is authorized.

Reserve Issabel native capture/config/tests and Customer Affairs technical-state
evidence/tests. No schema/dependency or operational grants. Company capture must
use verified trunk/extension inventory, never CallerID as employee authority.
Stage-two multi-responsible account enforcement is not implemented yet and remains
a release dependency; local testing permissions stay unchanged. Production access
is on another PC. Source and isolated tests can proceed here.

AMI source references:
- https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Events/DialBegin/
- https://docs.asterisk.org/Asterisk_20_Documentation/API_Documentation/AMI_Events/DialEnd/

Rollout must verify actual PBX frames, endpoint/trunk inventory and units before
enabling company capture. Unsupported channel formats must not be misclassified.

## Implemented source candidate

- Explicit COMPANY opt-in leaves legacy capture unchanged. Verified external SIP/PJSIP trunk origin establishes a persisted root before accepting queue/direct/transfer events. Internal-origin calls and unverified trunks are excluded.
- Answer, busy, no-answer, abandonment and root hangup normalize independently; ending an individual leg does not end the root. Unknown hangup does not fabricate successful completion.
- Employee external outbound calls support persisted fallback trunk legs under the same root, rejecting unmatched dialed numbers and orphan answers.
- Encrypted technical state preserves all confirmed answering extensions (including late transferred answers) and destination evidence. Ringing alone does not create answer responsibility. This metadata is not an authorization policy or an organizational assignment.

## Configuration and release gate

Deployment operator must verify actual PBX inventory and frames before configuring:

```dotenv
ISSABEL_CAPTURE_SCOPE=COMPANY
ISSABEL_EVENT_MODE=NATIVE_QUEUE_CAPTURE
# Supply real comma-separated inventories privately, never guessed values:
# ISSABEL_COMPANY_EXTENSIONS=...
# ISSABEL_INBOUND_PEERS=...
# ISSABEL_OUTBOUND_PEERS=...
```

Preserve connection credentials and unrelated operational configuration. COMPANY refuses empty/invalid inventories. This adapter currently supports SIP/PJSIP external trunk channels and configured numeric destinations, not arbitrary DAHDI or external Local channel layouts.

Before activation, complete stage-two multi-user responsibility/access enforcement, verified account-to-extension and queue-to-unit mappings, and answered-extension organization attribution. The approved unanswered policy is destination-unit manager plus executive/demo, or executive/demo only for unknown/unmanaged destinations. It is documented but NOT enforced by these capture changes. Historical access/backfill also remains pending. Local broad test access is unchanged.

## Validation and remaining checks

72 Issabel/state tests pass; 11 opt-in PostgreSQL tests skipped (not run). Scoped ESLint passes. Full API typecheck and TypeScript build pass against Contracts built from this worktree, using temporary external tsconfig path mappings to avoid stale shared dependency declarations. No declarations/errors were suppressed.

Remaining: PostgreSQL ingestion integration; real inbound direct/queue answer, busy, abandonment, employee outbound fallback, transfer and reconnect replay checks (manual test); permission checks for employee, destination manager, CEO and demo after stage two (manual test). No migration, runtime restart, local/production configuration mutation, PBX routing change or deploy occurred. Server access is on another PC. Do not label the complete operational stage finished until those dependencies and checks pass.
