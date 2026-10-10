# WORKBENCH-017 — Personal profile editor

PC-B; user requests editable personal information and profile photo in preferences.

## Prepared Web change

Native RTL form: full/display name, email, phone, read-only username, PNG/JPEG/WebP selection up to5MB, decoded local preview, replace/remove selection and reset. Existing persisted account name/email initialize the form. Photo validation checks MIME/header, successful decoding and dimensions. Object URLs are revoked on replacement/reset/unmount and stale async reads cannot replace the current selection. No uploaded photo, contact details or data URLs enter logs/source/browser storage. Existing theme controls remain live.

Save is intentionally disabled until a real authenticated persistence adapter is supplied; the form explicitly says edits are unsaved. No successful save, remote upload, phone persistence or header-avatar update is claimed. No real account mutations during tests.

## Required bounded owner handoff

Current IAM stores displayName/email but has no self-edit API, phone/avatar fields or public photo association. Final IAM ownership is PC-A. Prior project-owner handoff explicitly covered password change only. Runtime coordinator confirmed this does not cover self-profile and cannot transfer IAM/Migration ownership.

Proposed producer IAM / consumer Web profile, additive self-only contract. Read/update current user's details using actor identity only; never accept role, status, username or another user ID. Validate/normalize bounded fields, handle duplicate email, audit changed field names without contact/photo bytes, and revalidate session. Photo upload must validate/decode raster bytes server-side, enforce size limits and private owner access, and use canonical Documents through its public service if compatible; otherwise require a scoped additive profile/photo FK migration with active-owner handoff. Concurrent edits should use a version check. Verify cross-account denial, spoofed/corrupt/oversized files, rollback/partial-upload handling and reload persistence before activation. No shared contract/schema edits until coordinated.

## Runtime limitation

UI validation:20 scoped tests (12 profile and8 commercial export), lint, TypeScript and43-route build passed. Authenticated browser previewed a repository brand PNG, accepted a synthetic phone value, and reset both without submitting. Web3100 source1af4c0c/PID19708/manifesthr005-b7ab66ff79101b7b. Draft PR190; no merge. Owner export changesbc4c6b9/7fc5b05 are preserved.

API4190/PID15024 still serves the older service. Its previously denied replacement remains blocked; this task must not retry or route around the automatic denial. Web form preparation does not solve API activation. Further implementation/activation requires separate resolution of the ownership and runtime constraints.
