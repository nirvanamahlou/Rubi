# Contract PDF bundled font fallback — 2026-10-28

Contract PDF HTML now embeds the application-packaged Persian and Latin Vazirmatn subsets, so output does not rely on B Nazanin being installed on the rendering host. B Nazanin remains preferred when readable, but becomes optional if it disappears or cannot be read after discovery. Regression coverage checks the generated HTML contains both embedded subsets and the fallback font stack.

Scope: Sales contract print/PDF rendering only. No API, database, dependency, permission, contract data or server runtime changes. The active CONTRACT-PREVIEW-AVAILABILITY-1027 reservation retains ownership of the output button and PDF route; this work leaves those files untouched.

Validation and publication status will be appended after focused and full affected checks.
