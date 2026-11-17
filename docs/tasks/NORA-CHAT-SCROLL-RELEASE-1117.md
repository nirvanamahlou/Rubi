# Nora chat scrolling — production receipt / 2026-11-17

Owner explicitly requested publication of merged PR1768 and authenticated ERP
acceptance. PC-C used `codex/pc-c-nora-chat-scroll-release-1117`.

## Delivered version

- Published Web image: `rubi-production:nora-chat-scroll-1768-1117-r2-web`.
- Build used during primary live acceptance: `08Ajp-thgUW8QA5lVntoo`.
- UI source: `251eb62c46ba6665b997961a15e0bbf61429eb43`, integrating PR1768
  with PR1769 Persian response/source presentation.
- Exact committed Composer, CSS, scroll hook and assistant copy verified in the
  image. The current peer response renderer/presentation files were inherited
  unchanged, not replaced by an older release.
- 291 Assistant/English tests passed after integration. Full Web compilation,
  TypeScript and fresh Agent compile admission passed on the server before
  previous hashed assets were retained. Local/public login health returned200.

## Authenticated ERP acceptance

A separate browser tab used the existing authenticated ERP session; the owner's
original tab and conversation were left intact. No business request was created.
Questions concerned only procedural guidance, not employee or customer records.

| Check | Observed result |
| --- | --- |
| Immediate send | One user bubble, zero assistant bubbles and visible pending status/spinner before HTTP completed |
| Submitted input | Cleared immediately; typing a next draft did not cancel the response |
| Answer completion | Waiting feedback disappeared; next draft remained intact |
| Automatic scrolling | Long guide answer ended with transcript bottom gap0; surrounding page scroll remained0 |
| Reading earlier messages | Home moved transcript to0; arriving response retained that position, with2053px below |
| Latest-message arrow | Visible while above the bottom; click returned bottom gap to0 |
| Duplicate prevention | Three submitted messages produced exactly three user and three assistant bubbles |
| Close/reopen | All three exchanges survived and the transcript remained at the bottom |

Actual catalog answers for hourly/sick leave and contract creation were displayed.
These observations certify the requested UI behavior; they do not certify the
separate30-case SQL/financial Agent acceptance or a provider quota guarantee.
Screenshot is kept outside Git and contains only the generic guidance chat.

## Deployment coordination and rollback

Concurrent API/worker and Nora presentation releases were detected by lock/CAS
checks. An initial Web activation was rolled back because the operational guard
compared environment arrays in order; it was corrected to compare exact sorted
key/value maps. No environment values were disclosed or weakened. The final
candidate was rebuilt on the newly active peer Web image, preserving the newly
merged Persian/source presentation. Current non-Web services and the Web Compose
settings/environment were readmitted only after exact Web source/settings checks.

Final activation changed only Web; its private receipt confirms all six peer
container IDs and runtime environment unchanged at activation. No migration,
permission, credential, SQL, API, provider or tunnel change was made by this unit.
Private image/config snapshots, admission manifests and receipts remain under
`/opt/rubi/nora-chat-scroll-1117-r2/`; no private configuration enters Git.

Rollback is the Web-only `rollback` phase of
`/home/codex-dev/nora-scroll-release-1117-r2/release.py`, run with the deployment
lock. It admits only this currently active image and restores the saved previous
Web image while preserving other current services/configuration. A later peer
Web deployment must be reviewed rather than overwritten. No database rollback.

No additional product-code repair was needed during live UI acceptance. Release
reservation is complete; peers must retain PR1768 and1769 in future Web builds.

## Subsequent peer handoff

A later peer release activated image `rubi-production:nora-persian-reconciled-1117-web` (build `Y6Y5ayoMnyDa2Xp-Yo0G3`). Read-only verification confirms all four1768 UI files still exactly match the integrated251eb62c4 source; the scroll hook SHA-256 is `145708544dcbd4b8c37b18091eb2153ce1f1d5eeb3c0424ae43b24875a394871`. The peer release preserves this unit's published interaction changes; do not restore the earlier image over it. Primary browser acceptance above occurred on this unit's own deployed image before that handoff.

## CI integration requested 2026-11-17

PR1776 inherited an integrations-workspace set-state-in-effect lint failure on its older merge snapshot. Current develop a27328ecd already contains the producer's useTicketPublicationLink repair. Integrate it without altering product code; retain both append-only task/status histories. Require every final-head hosted gate before owner-authorized merge. Follow with fresh merged-author/live-source deployment inventory; no credential or operational personal record is committed.
