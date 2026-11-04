# OUTBOUND-CALL-POPUP-1024

PC-C, 2026-10-24. Owner explicitly requests the approved call form for outbound
calls and to hide the linked-request field unless the contact has open requests.
Base8f10b186 preserves the approved, separately published local notes/audio/staff stack.

## Behavior

- The existing CallForm is reused for real incoming/outgoing offers. The old
  technical/synthetic dialog remains restricted to synthetic calls.
- A popup accepts only the current user's branch-scoped active offer, acquires its
  existing claim/lease, then reads/saves through the same offer-scoped boundary.
  It grants no contact ownership, reassignment or access to another user's history.
- Optional additive `GET telephony/:id` returns that offered call, current version,
  claim state and whether ordinary contact authorization permits request linking.
  SAVE accepts bounded source/operator/outcome/ticketId fields. The server retains
  technical identity and confirmed recipient; linked tickets must be open, authorized
  and belong to the same contact/branch. Existing clients keep their old SAVE behavior.
- Known contact name/source are prefilled from the newest named call among the last
  25 calls for the same normalized phone/contact/branch. Synthetic/anonymous calls
  do not reuse identity. Subject, notes, outcome and request are never copied.
- Request selection is optional, titled "این تماس مربوط به کدام درخواست است؟".
  Server-side `openOnly=true` filters before paging/counting. The form loads open
  pages (maximum100 pages) and discards results when the selected contact changes.
  Existing dossier/history requests retain their unfiltered behavior.
- A telephone answer can refresh technical details without overwriting a draft.
  Saving rechecks business fields, current claim, lease, version and ticket access.

## Native outbound adapter

Based on [Asterisk AMI v2 DialBegin/DialEnd](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/AMI-v2-Specification/).
Only explicitly allowed SIP/PJSIP source extensions dialing an explicitly allowed
trunk are accepted. Source channel must be the root channel; dialstring must be
`peer/number`. CallerID is never used to guess the initiating employee or destination.
Root hangup needs a stored anchor. Replays reuse stored event identity/time; unrelated
internal/forwarded/secondary legs and orphan end events are rejected. This first
adapter does not claim support for arbitrary dialplan rewrites, parallel trunk
fallback, DAHDI or Local-channel originated calls. Capture a controlled real event
before enabling for a new PBX dialplan.

## Deployment handoff

Ship API and Web together; no schema/migration/dependency change. Keep secrets out of
Git. The release computer must configure and verify:

1. Real extension -> authorized ERP account mappings in the existing mapping API.
   Confirm the employee identity; shared extensions cannot identify an individual.
   Do not assign shared203 to an arbitrary person or broadcast its calls.
2. `ISSABEL_OUTBOUND_EXTENSIONS`: explicit comma-separated source extensions.
3. `ISSABEL_OUTBOUND_PEERS`: explicit `SIP/peer` or `PJSIP/peer` identifiers verified
   against actual DialBegin destination channels and dialstrings.
4. `ISSABEL_USER_NOTIFICATIONS_ENABLED=true` opts native capture into existing
   eligible mapping lookup. Missing/false preserves capture-only behavior.
5. Build Web with `NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true` (do not retain the
   prior explicit local hold). Existing session/branch permissions still apply.
6. Test incoming, outgoing known/unknown contact, no-answer, closed/open requests,
   other-user isolation, a second tab and an actual outgoing call from a phone.

Read-only AMI QueueStatus and SIPpeers succeeded on the accessible company PBX.
Four queues and multiple units' extensions exist. Local ERP currently contains only
the TEST mapping, not operational employee/account mappings. This is evidence for
the local runtime only; production ERP mapping state is not assumed. No PBX routing,
secret, production account grant or operational mapping was changed. Production is
deployed from another PC and its SSH/deployment access is not available in this task.

## Validation

27 isolated real PostgreSQL tests pass after all189 existing migrations were applied
to a new temporary database (no changes to company data). This includes native
outbound offers, another-user denial, prior contact prefill, claim/read/save, and
closed-request filtering.20 targeted adapter/projection tests and8 Web tests pass.
API/Web typechecks and scoped lint pass. Final builds/hosted CI recorded separately.
Initial database tests were started before migration completion and failed on
missing columns; corrected sequencing and reran successfully. No real-call popup
acceptance or production deployment is claimed until the mapping/config gates above
are satisfied.

API build (dist-outbound-1024) and Web production build (.next-outbound-1024) succeeded. Hosted CI and production rollout remain separate gates.
