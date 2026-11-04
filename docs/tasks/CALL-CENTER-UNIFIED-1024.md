# Call Center unified source candidate — 2026-10-24

PC-C; owner requests step 1 of release readiness: consolidate the approved final
source. Base `origin/develop` at `b4e069f9`; branch
`codex/pc-c-call-center-unified-1024`. This is not production activation.

## Provenance

- Develop already includes completed-call/request workflows, caller name,
  answered staff directory, dossier cards, authorized recording download,
  durable recording spool, note navigation, destination choices and outbound
  capture/offer-scoped form (PR1078). Do not copy older versions over these.
- Integrate released `107f56de`: scoped request status/priority choices.
- Integrate released `2482c7e2`: responsible-agent search, preserving legacy owner.
- Integrate released `b108273e`: bounded server-only previous-agent preview and
  read-only AMI availability snapshot. This does not install PBX routing.
- Preserve develop's removal of the global TelephonyAttention mount (PR1074).
  Popup implementation remains available but is not globally enabled by this task.
- Append-only status/work-assignment conflicts preserve both histories.

## Integration repair

The new AMI snapshot dependency exposed a real incompatibility in ami-observe:
Node native TypeScript stripping cannot execute the extensionless import and
parameter properties. The observer now loads the same transport through API's
existing tsx CJS API. No dependency or lockfile is changed. Its seven loopback,
redaction and authentication checks pass within the 23 script tests.

## Boundaries

No migration, business data update, user/extension mapping, permission grant,
secret/configuration change, collector restart or PBX command is performed.
No main/develop merge or runtime switch is part of this candidate. Existing
localhost services are retained. Dependency installation in the fresh checkout
was interrupted because of slow offline cache scanning; existing package cache
was reused and workspace contracts/config/database were built before retesting.
Initial missing-workspace-build failures are not successful verification.

## Still gated

Verified operational extension/user and outbound trunk mappings, CDR backfill,
actual recording transport/correlation/retention, PBX sticky routing installation,
manager recipient selection and permanent deployment remain separate work.
Real-call popup/name/isolation, recording, routing/fallback, interruption recovery
and operator acceptance require manual tests after those dependencies are supplied.

## Final validation

- API: 216 passing ordinary checks; 66 opt-in checks skipped in that run.
- PostgreSQL: all 76 checks in the six Call Center/telephony/Issabel suites pass
  against a newly created loopback-only nora_ci database after all 189 existing
  migrations. No operational database was used or migrated.
- Web: 53 passing Call Center and shared search-combobox checks.
- Collector tools: 23 passing Node checks, including the repaired observer.
- API/Web full typechecks, scoped ESLint and API/Web production builds pass;
  Web build produces 65 routes. Source formatting and diff checks pass.
- The first database run exposed a stale access-suite expectation that saving
  only a subject completes the call. The regression now asserts partial save is
  incomplete, then supplies all business fields and asserts completion, retaining
  foreign-contact and transfer denials. All six suites were rerun successfully.
- Test counts are per suite/run, not a claim of disjoint totals or live PBX QA.

Integration repair scope includes the observer and this existing access test;
no production permission/completion rule was weakened. Both source reservations
are released on publication. Hosted CI and authenticated visual/real-call
acceptance are not claimed by these local results.

## Authorized release continuation

Owner now requests develop merge only after all hosted CI checks succeed, followed
by local Web3000/API4000 activation. Reserve own release notes, conflict resolution
with newer develop and bounded CI repairs. Preserve the approved global attention
hold, existing private runtime environment and single AMI collector. No PBX routing
or operational mapping/grant change. Keep prior API/Web artifacts for rollback;
verify current schema compatibility before replacing the local runtime.
