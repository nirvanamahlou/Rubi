# Call Center additional employee extensions — 2026-10-24

PC-C; owner supplies two confirmed extensions for each of three existing staff.
Base develop69d80458; branch codex/pc-c-call-extension-aliases-1024.

The current HR public answer projection already supports multiple internalContact
records per employee, and its approved empty-HR bootstrap accepts one private row
per person/extension. This was a missing configuration issue; no new parser,
schema or UI control was needed.

The configured private directory was backed up with inherited access controls.
Three absent aliases were added to the existing people, preserving title/unit.
One person's display spelling was aligned with the owner's latest supplied name.
Existing rows and the distinct people on the known shared extension were retained.
Private real personnel assignments and the backup stay outside Git.

Read-only verification through the compiled HR public directory against the actual
configured branch/connection confirmed HR is empty, all six requested options
appear once, and each confirmed-answer lookup resolves the intended single person.
Options increased from16 to19; the existing shared extension still has two choices.
All six existing directory tests pass. This is a configuration-only change; no
build/typecheck rerun is required. No backend/frontend source was changed.

The live service reads the private document for each lookup; no restart is needed.
Existing historical answer snapshots retain their recorded labels. No operational
call was generated, no IAM recipient mapping or PBX dialplan was changed, and no
employee/contact/permission record was created. If HR becomes authoritative later,
both internalContact records must be retained per affected employee; bootstrap
fallback deliberately stops when the branch contains HR employees.
