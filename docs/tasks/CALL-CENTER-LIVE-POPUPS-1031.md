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
Independent incoming popup acceptance after finishing/closing the current popup
remains pending the owner's next test. Preserve the existing lease rather than
duplicating operational popups across browsers or weakening claims.

Future Web builds must preserve this source and popup build flag. Future API
deployments must preserve private notification settings and answered-access code,
and recreate Worker together with API. Existing deferred calls and unsaved drafts
remain governed by the existing close/minimize/lease behavior.
