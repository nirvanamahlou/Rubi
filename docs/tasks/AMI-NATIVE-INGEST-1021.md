# Native AMI sales-queue capture — 2026-10-21

Owner: PC-C. Branch: `codex/pc-c-ami-native-ingest-1021`, stacked on observer
`0ef9b7a5` and readiness `5d3ebb3f`. No UI, schema, dependency or migration changes.
The approved Web artifact and [UI preservation policy](CALL-CENTER-UI-PRESERVATION.md)
remain the baseline.

## Authorization and activation gate

The owner requests native AMI events to create real ERP calls, without any popup.
The owner subsequently limits ingestion to **sales only** and will supply its queue
number later. Do not enable all queues or infer the sales queue from ambient calls.
The ERP branch for the connection must also be explicitly confirmed. Until those
values are supplied, leave operational ingress disabled and existing runtime intact.
No new credential is committed or stored by this implementation.

## Contract and semantics

The existing Issabel adapter gains optional `ISSABEL_EVENT_MODE=NATIVE_QUEUE_CAPTURE`.
Default `CUSTOM_FACTS` remains backward compatible. The native mode accepts only
explicit comma-separated `ISSABEL_INBOUND_QUEUES`; empty/wildcard lists fail closed.
This mode supports inbound calls entering those approved sales queues:

- QueueCallerJoin anchors a root call using Linkedid, with a stable event identity.
- AgentCalled adds a ringing member leg; AgentConnect records a human queue answer.
- Only Hangup whose Uniqueid equals Linkedid ends that anchored root. Member hangup
  and AgentComplete are not treated as final because transfers can continue.
- Newstate Up / IVR answer / BridgeEnter do not mean a human answered.
- Unknown roots, unrelated queues, outbound and direct-to-extension traffic are
  excluded. Capture starts on entering the queue, not on the earlier trunk/IVR ring.
- The same root feeds one existing CallCenterCall through encrypted Inbox/Outbox
  and the public Customer Affairs projection. It remains needsCompletion=true;
  technical answer is not a salesperson's business result, request or follow-up.
- Company line and destination remain explicitly unknown until verified topology.
  Private/invalid caller numbers remain withheld/unknown rather than invented.
- AMI Timestamp, when provided, is validated and used; otherwise occurredAt is the
  first server observation time. This fallback must not be presented as measured
  PBX event time or a ringing-to-popup latency guarantee.
- Encrypted accepted Inbox receipts preserve correlation and retry timestamps
  across adapter restarts; existing seven-day private retention remains in force.
  Expired receipt tombstones cause an explicit conflict, not a fresh call.

Native facts always carry extension=null. Independently, the server refuses mapping
resolution in this mode even for extension-bearing canonical inputs. Thus processing
creates no offers/popup recipients, including with existing active mappings. Later
approval of mappings does not automatically enable native popup delivery; that is a
separate bounded activation/change. Native mode also rejects originate commands and
does not dispatch queued outbound commands. It only sends AMI Login/Ping.

## Delivery and limitations

Provider frames are serialized with a bounded500-frame pending queue. Transient
ingress failures retry at most six attempts with exponential delay/jitter; permanent
4xx except429 do not retry. Canonical events commit to the existing durable Inbox
before Worker processing. Worker retry/dead-letter rules are unchanged.

AMI has no upstream durable acknowledgment/replay here. A crash before Inbox commit,
buffer overflow or disconnect can lose unaccepted frames; coverage reports GAP.
This work does not claim CDR reconciliation, guaranteed delivery during outages,
recording retrieval, transfer destination attribution or outbound capture. Run a
single adapter instance per connection; multi-instance collector leasing is not
introduced. Real audio and remaining call scenarios require separate acceptance.

## Private configuration and rollout

Keep `ISSABEL_ENABLED=false` until queue and branch approval and compatible API
activation. Use the existing authorized connection configuration service to bind
an approved branch and real custodian; no guessed branch or user grant. Set private
environment values for connection UUID, AMI host/port/username/secret, EVENT_MODE
and INBOUND_QUEUES. Never place credentials in task documents or Git.

TLS or loopback remains required for production. Only this native capture mode in
NODE_ENV=development permits an explicitly acknowledged RFC1918 company network
with `ISSABEL_COMPANY_NETWORK=true` and `ISSABEL_AMI_TLS=false`. The previous
production/custom-facts TLS requirement is unchanged. No dialplan or PBX write is
performed. Disable relay/synthetic ingress during the native real-call pilot.

After approval: record existing counts/build IDs, configure the connection, activate
one compatible API with Worker, make a controlled sales-queue call, verify its one
TELEPHONY record survives refresh and has no offers, then test unanswered/transfer
and service interruption. Keep the approved Web build unchanged. Rollback disables
ISSABEL_ENABLED and restores the previous API; preserve accepted calls and Inbox.

## Evidence

The preceding isolated real-PBX observation authenticated once with zero gaps over
180seconds and received102 events,32 recognized call events including queue join,
agent ring/answer and root hangup. It wrote no ERP records. That observation is
protocol evidence only; the new sales-filtered live persistence is awaiting queue
and branch confirmation.

Validation:32 distinct focused tests pass across native normalization/socket,
existing AMI/security, readiness and real PostgreSQL delivery suites. The disposable
database applied all180 existing migrations. Native delivery tests exercise duplicate
queue joins, multiple ringing legs, member hangup, restart correlation, reverse
Worker projection order, one persisted TELEPHONY call and zero offers even with an
active mapping and an extension-bearing canonical input. A native outbound request
is denied. One initial parallel suite run raced shared permission fixtures; rerunning
the database suites serially passed without changing authorization or test assertions.

Scoped lint, API typecheck and API build pass. No new migration or Web file change.
Local Web3000, API4000 and Worker4409 health returned200; operational processes and
activation settings were not replaced. Real sales-call persistence is **not yet
activated or accepted** because the sales queue and ERP branch remain unspecified.
Commit/push is limited to this unit; no PR/merge/production deployment.

Event field references: [QueueCallerJoin](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Events/QueueCallerJoin/)
and [AgentConnect](https://docs.asterisk.org/Asterisk_21_Documentation/API_Documentation/AMI_Events/AgentConnect/).
These references describe the event family; actual Asterisk16 event names and
identity relationships were observed in the isolated test. No unsupported provider
payload or custom dialplan hook is assumed in native mode.

## Activation follow-up

The later owner-approved queue1002/HQ local activation and real-call acceptance are recorded in [AMI-SALES-ACTIVATION-1021](AMI-SALES-ACTIVATION-1021.md). The earlier pending status above describes this implementation unit before activation; popup delivery remains disabled.
