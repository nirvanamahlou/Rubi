# WORKBENCH-005 — native personal workspace

Computer: PC-B. Branch: `codex/pc-b-workbench-native-shell`. User explicitly requested a real Rubi-themed application workspace instead of the standalone demo. This supersedes WORKBENCH-004's demo menu behavior.

## Scope

- `/workbench` is a React page under the existing `(crm)` layout: shared navigation, company context, authenticated user, Vazirmatn, theme tokens, date preferences and UI components.
- Add a personal sidebar/user-menu entry. Preserve the seventeen business modules and restore `/tasks` to Tasks & Automation. Compact navigation accommodates the extra personal entry.
- Delete bundled demo HTML/response helper. Old `/workbench/demo` redirects to `/workbench`; no environment flag, iframe, duplicate application shell or synthetic records.
- Home reads authenticated IAM identity, recipient Notifications and personal owned Documents through existing public clients. Notification counts are the API totals, not the length of a limited list. Read-state change is announced after successful API response.
- Files supports owned/uploaded/recently-viewed scopes, server search and pagination, existing upload dialog and owner detail/download route. Server permissions, branch scope, malware checking and sensitive-document step-up remain with Documents. No browser-supplied owner ID or file-access bypass.
- Account links reuse the current profile, security and preferences. The activity tab explicitly shows only actions attributed to the user in their last fifty visible notifications, not a complete audit feed.

## Explicit gaps

This is not completion of every feature in the original PRD. General requests inbox, private messaging, notes, saved favorites and personal task storage have no approved runnable owner service in this runtime. They remain clearly unavailable, with no simulated forms, fake success or localStorage persistence. Request links lead to existing owner modules according to current permission prefixes; they do not claim to aggregate HR referrals. The current runtime does not include the later develop HR referral consumer.

The original user instruction permits the public-port/UI fallback while migration ownership is locked. Reservations still owns that lock (also recorded by Finance PR153). No migration, new permission/role grants, dependency, contract, API or database changes are included. A new Workbench permission is not invented for existing self-scoped endpoints; their owner services enforce authentication and authorization.

## Runtime and review

Preserve the full runtime based on B2B56d5d48 and apply owner-supplied c83d530 KPI colors before the combined production build. Only the owned Web3100 is replaced after fresh PID/source verification; API4190, its environment, storage and data remain unchanged. B2B owner and runtime coordinator are notified. No merge.

## Validation

- Native service/model, Notifications/Documents and navigation tests: 54 passed.
- Web typecheck passed. Full Web lint, production build and browser validation pending at source commit; final results recorded below after execution.
- Tests verify unauthenticated/permission-denied access, owner partial failure, recipient unread counts, server personal scope, mutation failure without false refresh, internal notification links and date fallbacks.
