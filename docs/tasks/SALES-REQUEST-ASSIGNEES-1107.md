# Limited sales request assignees — PC-C — 2026-11-07

Owner explicitly authorizes only two named current sales managers to assign Call Center requests to three additional active internal accounts. Existing department membership and normal team/self policy stay unchanged. Both new-request entry points consume the same IAM selector; transactional recipient resolution uses that selector again.

Protected deployment environment CALL_CENTER_REQUEST_EXTRA_ASSIGNEES is a JSON object keyed by exact manager account UUID, containing an array of exact target account UUIDs. No display-name/username matching and no global role expansion. Missing, malformed or invalid configuration grants nothing. Active/internal/active-branch checks remain mandatory. The request manager guard uses the same exception and revalidates target eligibility. A creator can read only their own requests assigned to one of these eligible targets; the exception does not expose unrelated contact history or other creators' requests.

No schema, dependency, stored IAM grant or HR data change. Actual account identifiers remain in protected server configuration, outside Git. The deployment must verify exactly both approved managers and all three targets, plus unchanged behavior for an unlisted manager, inactive/external/cross-branch targets and forged recipients. Preserve all existing environment values and restart the API with Worker namespace coupling handled by the existing release protocol.

Validation:30 focused selector, management, creator-scope and malformed-configuration tests pass. Existing request policy regressions remain included; full types/build and current-head hosted CI are required before release. No production policy enabled at source-preparation time.


Closeout: PR1457 merged as 5e1995a514d67d3030a4296e2ec46656134a84d8 after every hosted current-head check succeeded. Bounded API policy activated and verified; Web untouched, API/Worker recreated together. Fresh encrypted DB and selected configuration backups retained. Protected evidence: /opt/rubi/sales-request-assignees-1107/verified.json and ci-approved.json. Both approved managers and all three recipients pass live selector, transactional recipient validation and management checks; unlisted account gains nothing. Worker authentication, AMI, recordings timer and HTTPS pass. No schema/data/role/HR mutation.
