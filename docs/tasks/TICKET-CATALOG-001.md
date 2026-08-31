# TICKET-CATALOG-001 — Ticket Catalog Phase A

- Computer: PC-A; status: IN_PROGRESS.
- Branch: codex/pc-a-ticket-catalog-foundation.
- Base: origin/develop@5f9cb723de39e29cff95f26b047138699bd36392 (2026-08-31).
- Independent worktree: .worktrees/ticket-catalog-001. Main checkout and customer preview changes untouched; 56a4a09 not imported.

## Temporary module-local reservation

Owner explicitly permits module-local reservation while PC-B owns central docs. Open PR #45 and parent chain #28–#44 report active PC-B Migration/Contract/Docs locks. Released customer locks do not supersede this newer work. No shared lock acquired or transferred.

Reserved scope: apps/api/src/ticket-catalog/** (pure domain/ports, no wiring), apps/web/src/modules/ticket-catalog/** (UI/model/adapter/tests), apps/web/src/app/(crm)/ticket-management/page.tsx and this document only.

Prisma, migrations, seeds, database configuration, dependencies, lockfiles, shared contracts/exports, IAM, Customers, Master Data internals, Finance, Sales, Reservations, Legal Entities, navigation and shared UI excluded. Phase B requires explicit future handoff and new reservations.

## Published dependency baseline

Master Data v4 publishes countries, cities, airlines and currencies via authenticated GET with master-data.read. Airports, aircraft, flight classes and baggage are not on develop. No open PC-B code consumed. Ticket permissions and persistence API unpublished.

## Central-document handoff

Owner of central docs should add this work item row to WORK_ASSIGNMENTS and Phase A outcome to PROJECT_STATUS/PLANS after review, without transferring locks. Capability matrix, producer requirements and test evidence will be appended here.
