# Contract terms: justified body text — 2026-11-10

The user requested justification of the shared `/contracts/terms.pdf` downloaded by Sales and Reservations. This is a layout-only change to the existing supplied PDF, preserving its legal text and font data rather than reconstructing or retyping it.

`justify-contract-terms.py` adjusts word spacing and the left edge of37 wrapped body lines. Paragraph-final lines retain normal RTL alignment. Both A4 pages, headers, footer, signatures, every original text glyph, embedded font bytes and PDF metadata are verified unchanged. Both output pages were rendered and visually inspected. A second generation produced the same SHA256.

Original SHA256: `8ed0c34f4e94f9802a5ca4f9f0cf45de9ae49fcb92e1018b4ae30d56206767dc`.
Output SHA256: `256a5be58e1926fa6e2ebddae1de76563b041c9b9f35534c7b15ebde240c25ba`.
Original Git blob: `418b30f8e56621c3bf2b29a4827a034837f9b3c1`.

To reproduce using Python with the development-only `pypdf` tool, recover the original blob without shell text redirection:

```python
from pathlib import Path
import subprocess
Path('original-terms.pdf').write_bytes(subprocess.check_output(['git', 'cat-file', 'blob', '418b30f8e56621c3bf2b29a4827a034837f9b3c1']))
```

Then run `python scripts/justify-contract-terms.py --source original-terms.pdf`. The script refuses any source whose hash differs, and verifies content/font/page/metadata preservation before writing. No Python package is added to the application runtime or lockfile.

The existing file URL, Finance authorization for the Sales document dialog and selected-contract gate in Reservations stay as before. No legal wording, API, IAM, database, migration or deployment changes. Full exact-head hosted checks gate the authorized develop merge.
`nCI compatibility: updated the inherited Documents allowlist assertion to include the existing FAVORITES value; no contract or runtime behavior changed.
