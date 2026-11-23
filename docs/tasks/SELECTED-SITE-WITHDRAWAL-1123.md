# Select sites before deleting an Avina record

- **Tickets and tours.** Avina obtains the enabled publication sites for the
  source identifier. It requires the exact set in the deletion request and
  disables those publication rows in the same transaction. The existing
  revisioned catalog delivery forwards their disabled state. Floating tours with
  retained prices are archived.
- **Hotels, countries and cities.** The configured site receivers accept the
  signed POST `/api/v1/erp/profile-withdrawal` with an action of `inspect` or
  `withdraw`. Each returns `linked` and `blocked`. A dependent public destination,
  hotel or tour can block withdrawal of its parent. Matching uses existing
  publisher identifiers and established geographic matching rules. Withdrawn
  records retain their identifiers and return the same receipt on retry.
- **Failure recovery.** If any receiver cannot confirm withdrawal, the source
  delete rolls back. A receiver that already archived its record keeps it
  archived. Retry the same deletion with all sites selected.
- **Release.** Deploy the website receivers before the Avina API. Apply the
  additive `TourPackage.archivedAt` migration before deploying the Avina API.
  Deploy the Avina web update after the API. The catalog dispatcher continues
  using the existing site secrets and delivery cursors.
