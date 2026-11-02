# Master Data entry access repair — 2026-10-27 — PC-B

## Scope

The owner explicitly requests a production repair for two named accounts which
already have Master Data entry selected but receive a restricted-field error.
This is a bounded authorized IAM operational change, not a global permission
backfill or a relaxation of Master Data field guards. Base develop1bfc21d8b.
No application source, schema, migration, dependency, deployment or business-data
change is required. Existing workload/architecture assumptions are unchanged.

## Findings

Both accounts are active and have exclusive manual-v3 roles, all46 Master Data
resource screens and the existing create/update operations. Neither has an
explicit field-denial entry. The newer catalogue has371 editable field controls:
one account is missing2 and the other7. A missing allow-control is intentionally
closed in manual-v3 profiles; a form submitting that field correctly receives
`MASTER_DATA_FIELDS_RESTRICTED`, even when the create operation is selected.

The missing controls are country GMT offset and hotel free-sale for both accounts;
the second also lacks supplier/broker dossier mobile/email and broker address.
No title-based permission inference is used and no sensitive native permission is
added by this repair. The owner authorizes these Master Data input fields now.

## Repair and preservation

- Connected through the previously authorized password-SSH method without logging
  the credential or changing authentication configuration. Live API/Web/worker
  remain on the existing immutable d5dae6f4 release; no deployment process active.
- Prepared root-only snapshots of both current manual selections/revisions and
  fingerprints of all21 roles outside Git before mutation. No credentials or
  customer/business records are included in the repository.
- Verified each missing field belongs to an already-authorized Master Data
  resource; explicit denials would have stopped the repair for separate review.
- Reproduced the actual MasterDataService restricted-field guard before saving;
  checked the proposed field-only selection locally in memory before mutation.
- Applied through existing `ManualUserAccessService.save` under the existing
  canonical administrator, retaining its transaction, live authority, revision
  and standard manual-access audit. No shared role was edited.
- Re-read and compared: only the2/7 specified allow-controls were added. Native
  operations, screen IDs, role titles and all previously selected field controls
  remain identical. All19 unrelated role fingerprints are unchanged.
- Actual field/resource authorization passes for each of the46 authorized Master
  Data resources for each target. These checks exercise permission guards, not
  field-value validation or a complete live create request; no business record
  was inserted as a test.

No password reset, session/token impersonation, role assignment change, global
seed, operational restart or extra access outside Master Data was performed.
New future fields remain explicitly configurable rather than becoming silently
writable to every old account.

## Recovery

### Additional owner-authorized account

The owner later requests the same correction for one additional account. Its
existing create/update permissions and all resource access were already present;
only country GMT offset and hotel free-sale were missing. An independent root-only
snapshot and all21 role fingerprints were taken before applying the same IAM save
service/revision/audit procedure. Exactly those two allow-controls were added;
native operations, screens and title remain unchanged. All46 resource field guards
pass and all20 unrelated role fingerprints, including both earlier accounts, match.
The task did not change application code, update/restart services, write business
records or interfere with the peer-owned production build detected during checks.

Protected before-state and repair receipt remain in the server's root-only
operational task directory. Any requested reversal must compare current access
against the after-state, obtain its fresh revision and use the same IAM service
to remove only the added controls. Never overwrite subsequent administrator edits.
The existing security guard must remain enabled; do not solve access issues by
disabling field checks or replacing shared roles.
