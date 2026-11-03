# CALL-POPUP-FIELD-ORDER-1102

Owner explicitly authorizes the default field swaps in every Call Center popup. Shared CallForm serves workspace/KPI completion and operational incoming/outgoing popups through HostedCallForm.

RTL rows, right to left: contact name then phone; acquaintance source then call direction; outcome then recipient/originator. DOM order follows the same sequence on narrow layouts and for keyboard navigation. Whole existing label/control blocks moved; values, read-only identity, hidden inputs, validation, source options, request association and save handlers unchanged. Structural comparison verified identical six field blocks and identical remaining component source.

17 existing Web checks pass. Scoped lint/full Web typecheck/build and Web-only backed-up rollout passed. Existing production source compared with task base and guarded again under the shared deployment lock. Preserve old static chunks, runtime Web env/mounts and all API/Worker/data service IDs. No backend, schema, permission or data changes.

Active image sha256ab5ad974154d0c64ad3a1076d10f148c43a86bd4109716757ebc69187b919e01; receipt /opt/rubi/CALL-POPUP-ORDER-RELEASE-1102.json. HTTPS login and referenced static assets verified200; API/Worker/PostgreSQL/Redis container IDs unchanged, Web env/mounts retained. Compose snapshot and old image available for rollback. Existing open browser forms need a normal page refresh after saving unsaved work to load the new production bundle.
