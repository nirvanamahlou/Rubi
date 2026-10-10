# B2B-CONTACT-DISPLAY-1004 frozen contract v1

PC-B. User requests complete representative phone/email display and icon-only address actions. Full contacts may only come from the existing audited MasterData unmask endpoint with master_data.sensitive_contact.unmask. No grants, policy, schema, producer or data changes.

- Fresh dossier permission and nonempty session context gate requests and rendering; workspace cached permissions alone are insufficient.
- Cleartext snapshots bind organization, contact ID/version and session context. Reject mismatched response ID. Discard delayed results after identity, organization/contact changes or closure. Never render old cleartext under a new context.
- Consumer unmask fetch uses cache:no-store; do not persist cleartext in storage/global cache/logs.
- Unauthorized contacts retain masked values. Failed/denied/deleted/network requests retain masked fallback with truthful status; null field means absent.
- Preserve owner endpoint auditing, branch scope and current permissions. Preserve address edit/delete behavior, variants and accessible labels; remove visible text only.
- Show phone/email in readable RTL card layout with LTR values and wrapping, without truncating authorized values.
- Meaningful checks cover permission denial, stale session/org/contact results, response mismatch, null values, failures and cache policy; lint/typecheck/build and existing Organizations checks.

Risk R3/C3 due sensitive contact disclosure. Read-only advice /root/contact_display_advice; persistent implementation /root/phone_verification_impl; separate final review of committed candidate required. Usage unavailable. Lead freezes automatic reveal on authorized dossier view based on user's explicit full-display request; no added authority.
