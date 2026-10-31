# CALL-CENTER-LIVE-POPUPS-1031 — PC-C

Owner explicitly authorizes incoming and outgoing operational call popups globally
in authenticated ERP pages. Existing hidden telephony diagnostics remain hidden.
Native permissions, branch filters, per-user offers, tab lease and claim checks
are unchanged. No new grants, provider commands, migrations or dependency changes.

## Source and production rollout

Bounded changes: AppShell opts its existing operational-only listener into both
directions; TelephonyAttention uses the explicit popup build flag, accepts incoming
offers as well as outgoing and retains the existing OperationalCallPopup. The
outbound-only mode remains backward compatible. Five focused Web regressions,
scoped ESLint, Web typecheck and production build passed on the exact deployed
base358bf900. Only the three affected Web files were copied over that image.

Web image `rubi-production:call-popups-1031`, immutable
`sha256:d3ff0c8301433449dee3d6e03f148e0640d7c38428dae3100b616fead84bb743`.
Build-time `NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true`; public API base remains
the production HTTPS URL. API private `ISSABEL_USER_NOTIFICATIONS_ENABLED=true`
enables both directions using the existing native mapping/eligibility boundary.
The answered-access API overlay remains unchanged.

Deployment script `scripts/call-center/deploy-live-popups-1031.py` validates the
current images and built ID, creates an encrypted backup, takes the existing
deployment lock and preserves original Compose/private environment for rollback.
API/Worker are recreated together because Worker shares API network namespace.
Web mounts and all unrelated environment values/images are retained; mount lists
are compared by destination, not Docker enumeration order. DB/Redis remain running.
Actual receipt `/opt/rubi/CALL-POPUPS-RELEASE-1031.json` reports complete with both
directions, authenticated AMI/Worker and hidden technical widget.

## Acceptance

The authenticated in-app Dashboard was refreshed to load the newly compiled client.
Its operational listener rendered without the floating technical widget. A real
outbound call opened the existing edit-call form while still on Dashboard. Native
offers were also verified for an actual incoming call, with both directions
assigned to the mapped404 account (no call data copied into this repository).

Owner initially reported no popup in separate Chrome. The same-account in-app
browser held the existing single-tab lease. Closing the in-app verification tab
released it; the owner explicitly confirmed the popup then opened in Chrome.
Both real incoming/outgoing offers were verified for the404 mapped account.
Owner then explicitly confirmed the incoming popup also opened in Chrome.
Preserve the existing lease rather than duplicating operational popups across
browsers or weakening claims.

## Follow-up: confirmed answer identity refresh

Owner observed a missing404 employee name in the incoming form. The popup loaded
its call once at ringing; the provider-confirmed answer snapshot arrived afterward
but the mounted form never reloaded it. Refresh the offered call on session-version
changes, merging only operator/answerRecipient into the initial snapshot. Stable
form identity preserves typed fields, and the initial business snapshot remains
the conflict baseline instead of silently accepting concurrent edits. No employee
is inferred merely from the offer before an actual answer.

Two focused preservation/unknown-recipient tests, scoped lint, Web typecheck and
production build passed. Candidate `rubi-production:call-popup-recipient-1031`, ID
`sha256:08a81359cd5002d49177da49fac8c5555cac7ce80dc757d58fe321343446d736`.
Deployment is pending: free disk fell below the existing backup helper's5GiB
guard during another colleague's build. That deployment lock was awaited normally;
the live popup/API images remain unchanged. Only identified failed own build
artifacts and the downloadable APT archive cache were removed; no Docker prune,
database, recording, release source or encrypted backup was deleted.

Owner approval requested before archiving then removing three unmounted old
release directories (`8a380e10`, `73e60ef1`, `c52e41b3`, approximately2.1GiB) to
the approved off-server backup destination. Do not bypass the backup space guard
or treat the answer-name follow-up as deployed before a successful release receipt.

Future Web builds must preserve this source and popup build flag. Future API
deployments must preserve private notification settings and answered-access code,
and recreate Worker together with API. Existing deferred calls and unsaved drafts
remain governed by the existing close/minimize/lease behavior.
