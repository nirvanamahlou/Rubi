# WORKBENCH-008 — canonical files and Documents stars

PC-B; codex/pc-b-workbench-document-favorites. User explicitly requests that Workbench files belong to Documents and that stars set in Documents appear in Workbench.

Files already calls the existing documentsApi.upload using the owner upload dialog; this change clarifies that relationship and adds direct navigation to Documents. No duplicate upload, file metadata, object storage or API is created. Sensitive file detail/download checks remain on the original document route.

Documents already stores account-keyed favorite IDs in rubi.documents.favorites.<userId>. Workbench now reads that existing source through a small Documents-owned helper. It introduces no new browser writes or separate favorites store, and explicitly says the list is limited to this account/browser rather than synchronized between devices. A minimal change event after the existing star operation plus storage/focus/visibility listeners keep the consumer current. Storage failures in the existing toggle are surfaced instead of crashing.

Stored IDs are only selectors, never authorization. Metadata is fetched afresh through the public Documents list with server permissions/branch scope, stable archive-code ordering and pagination until every ID is found or the archive ends. Revoked/deleted items absent from authorized responses are excluded. No metadata or file content is cached locally; failures clear prior displayed data and show error. Changed account/view invalidates in-flight work. The list endpoint avoids marking a file as recently viewed merely to enumerate its star.

Scope limitation: persisted cross-device favorites still require the appropriate owner service/migration handoff. This is compatibility with the existing Documents feature requested by the user, not a claim that browser-only preferences meet the original complete Workbench persistence requirements. No API/schema/migration/dependency changes. Documents retains its existing main-view favorite pagination behavior; the Workbench consumer specifically handles stars beyond page1.

Validation: 41 Workbench/Documents tests passed, including current-account key isolation, malformed storage, deduplication, authorization omission, favorites beyond100, empty-set short circuit, early completion, partial failure rejection and stale response invalidation. Web typecheck passed. Scoped lint/build and browser verification recorded after runtime handoff. No merge.
