# CALL-KPI-DUOTONE-1105

PC-C; base develop ff31d2fd9; branch codex/pc-c-call-kpi-duotone-1105.

User selects the attached02 Layered Duotone blue icon reference for the four Call Center KPI cards. Match the handset, calendar, handset/cross badge and opposing callback arrows with crisp local vectors, pale blue highlight layers and restrained shadows. Increase horizontal space between icons and values. The permission for this intentional visual change satisfies CALL-CENTER-UI-PRESERVATION; existing approval covers PR, green-gate develop merge and bounded Web publication.

Scope: new Call Center-local kpi-icon.tsx, consumer kpis.tsx and KPI-only workflow.module.css rules, own release helper and documentation. Existing server count fetching, loading/error states, labels, keyboard/click actions and all other Call Center/sidebar design remain. No schema, migrations, API, permissions, dependencies or business records change.

Validation:116 Call Center tests across27 files passed, including repeated SVG instances with unique local gradient/filter IDs and decorative accessibility checks. Scoped ESLint, Prettier and diff checks passed. SSR preview of the actual components/CSS with synthetic counts verified desktop52px/mobile44px icons,18px/12px horizontal gaps, full long labels and light/dark rendering. Five-digit mobile values initially overflowed one card;24px mobile values now fit all cards with no page or card overflow. An initial test invocation from the repository root missed Web JSX/alias configuration; the complete rerun from apps/web passed. No package or lockfile changes from stopped bootstrap attempts.

Full Web types/build, hosted gates and bounded publication pending.
