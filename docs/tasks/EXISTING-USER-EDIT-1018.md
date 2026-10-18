# Existing-user identity and saved-role editing — PC-B

Owner authorizes implementation, push and develop merge, without Worker Orchestrator or new agents. Branch codex/pc-b-existing-user-edit-1018 starts at develop29c3f13d.

Existing accounts expose the same combined full-name field as creation, prefilled from displayName. Separate name-save PATCH /iam/users/:id/details updates only that field, never roles, permissions, branches, credentials or sessions. No schema split, migration or backfill. Validate UUID/bounded name, reject unrelated fields, require management permission and recheck live operator authority in the transaction. Lock operator/target, compare opaque details revision and audit atomically. Unchanged names do not write. Refresh server list after saving.

Role choices include active reusable ordinary roles and named templates, excluding private per-user snapshots. Add normalized selection: legacy roles use effective access semantics, templates preserve explicit saved checkboxes. Existing-user and creation editors consume this projection with backward-compatible fallback. Existing-user dropdown values use role IDs rather than names. Manual role title retains precedence, otherwise show an active reusable legacy role name. Selection prepares only a draft; existing manual save retains revision/delegation/unknown-grant/last-manager protections. No shared role or other account is rewritten.

Tests cover name-only writes, trimmed/invalid/stale/unauthorized/no-op cases, real Nest route/DTO/UUID/permission validation, legacy/template role projection, prefilled/read-only UI and existing IAM/Web suites. English/offline catalogues synchronized. Final-head type/lint/test/build CI gates merge. No actual user/role mutation or local3100 rollout.
