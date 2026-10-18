# ASSISTANT-DRAGGABLE-LAUNCHER-1018

PC-C; branch codex/pc-c-assistant-draggable-launcher-1018 from origin/develop@fc8a5927.

The human requests repositioning the global fixed assistant icon by dragging, while preserving its existing initial location.

## Behavior

- Primary mouse/touch/pen pointer uses capture so leaving the icon does not interrupt the gesture. Six CSS pixels distinguish a drag from an ordinary click. Completing/canceling a drag suppresses its pointer click without blocking later clicks or keyboard activation.
- Button remains fixed relative to the viewport and is bounded after movement and viewport resize. Scrolling never scrolls the button away.
- Compact/expanded chat uses bounded placement above the relocated icon, or below when the top has insufficient room. Text input and response data are not drag handles.
- Alt+arrow keys move20px; Alt+Home restores the default. The accessible bilingual movement hint describes both controls.
- Persian starts bottom-left; English starts bottom-right. Changing locale restores the relevant default. Repositioning persists while navigating the authenticated UI, without browser storage. Refresh/logout/access-scope change restores initial placement and existing session isolation.
- Existing commands, model/data gating, chat state, expansion, close/Escape and return-focus behavior remain intact.

## Scope and acceptance

Only floating-assistant presentation, a private geometry/helper hook, focused tests and one bilingual copy entry change. No AppShell mount, backend/API, data, permission, model provider, schema, dependency or migration change. Verify real drag versus click, edge bounds, resize, open/expanded panel bounds, locale reset, keyboard movement, navigation continuity and preserved chat draft.73 Assistant tests, scoped lint/formatting, Contracts build and the62-route production Web build with TypeScript pass. Authenticated localhost visual test and latest-head CI/postmerge CI gate delivery.

## Rollback

Revert this bounded frontend commit and rebuild Web; no database or service rollback. Preserve the previous local production build until the new build is ready.
