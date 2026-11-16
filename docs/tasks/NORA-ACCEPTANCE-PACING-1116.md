# Immediate synthetic Nora acceptance

Owner requests no personal artificial consumption/time throttling for this
agent's Groq testing. The old acceptance runner imposed an unconditional initial
hour, a one-hour minimum after429 and successful-case pacing derived from an
assumed daily token ceiling. These are runner delays, not ERP request execution
limits or the provider's actual quota.

The old file is reserved by the separate active1114 acceptance unit and is
untouched. New runs use run-live-acceptance-fast.mjs and its pure pacing helper.
All30 scenarios run immediately in series when healthy. Only real provider-rate
feedback schedules a retry, using the transport's retryAfterMs with no invented
hourly minimum or daily projection. Missing retry timing and actual oracle
failures stop for review. Six repeated quota failures remain bounded and do not
sleep once more when no retry follows.

Native60s/8-model-turn/6-SQL and statement/row/token/access guards are unchanged:
acceptance must test actual ERP behavior. No unlimited model loop, quota bypass,
key cycling or shared-tunnel shutdown is introduced. All original synthetic DB
guards, oracle assertions, receipt-directory lock and source checks remain.
The new runner fingerprints itself, its helper and all assistant runtime mjs
files to preserve a reproducible current source version.

Validation:6 new fake-clock/synthetic runner tests and all116 service tests pass;
the runner passes Node syntax and formatting checks. Healthy30-case simulation
records zero sleeps; actual429 retry timing, missing timing, real failure and
terminal retry behavior are separately tested. These are tooling tests, not a
claim of completing the live Groq30-case matrix. No billable Groq request,
Production change, migration, dependency or credential change was performed.

No active local run-live-acceptance Node process was found during this change.
Use a new private receipt directory for the next actual live run; never delete
another run's lock or rewrite old receipts. Operations command and environment
requirements: [runner README](../../scripts/operations/nora-agent/README.md).
