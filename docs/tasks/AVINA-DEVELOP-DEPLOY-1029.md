# Avina develop rollout — 2026-10-29

Owner: PC-A. Explicitly requested production update of avinaofficial.ir.

The prepared develop target advanced during preparation from PR1193's merge to
`b5ce75bcc97a0c34cf8563aa18b0280634d23ad9`, through PR1199. This includes
contract person registration recovery, unnamed legacy hotel purchase pricing,
cancelled-contract sales metrics and reservation contract sorting. The previous
application image was based on `5314830983e47a81c1ea1927d63b8b5c716b1cf8`.

All four hosted gates passed on the exact target revision. No package manifests
or lockfiles changed from the deployed image. The source archive checksum was
verified before extraction. A shared deployment flock and baseline checks guarded
the build, backup and activation phases. Six package/application production builds
passed. Isolated web readiness verified login, static assets and unauthenticated
protected-page redirects; the existing production application remained running
during preparation. Chromium and B Nazanin were present in the base image and
current application. Prior browser static chunks were retained in the new image.

Encrypted database, private documents and public-document backups were created
and verified by full decryption plus archive inspection. The checkpoint and
rollback manifest remain in the server's private operational release directory.
Automatic approval review rejected copying the encrypted private payloads to the
local workstation because that separate egress was not explicitly authorized.
No workaround transfer occurred; deployment continued with verified on-server
recovery copies.

The old API and worker were stopped before applying these additive migrations:

- `20261027160000_sales_payment_destination_account`
- `20261029100000_sales_transactional_contract_numbers`

The numbering counter was initialized above existing contract numbers and the
legacy sequence high-water mark. Customer, contract and payment row counts were
equal immediately before and after migration while writers were stopped. No
seeds, data-volume replacements, historical record edits or destructive migrations
were performed. Rollback preserves additive schema and, if needed, advances the
legacy sequence before restoring an older writer; rollback was not required.

API, Web and worker now run the exact target image and source revision. Other
containers retained their identities. Runtime configuration and all data mounts
were preserved, with only the immutable Web public-release mount advanced.
Post-activation checks verified public API health `ok`, login HTTP200, protected
page redirects, API HTTP401 without credentials, old/new static assets, relevant
deployed source hashes, complete migration history and zero application restarts.
The counter's bound against both saved contract numbers and the old sequence was
also verified read-only. Server receipt time: `2026-10-29T09:18:12Z`.

No real contract, payment, customer or reservation write was used as a smoke test.
No production identity data or credentials were added to this record.
