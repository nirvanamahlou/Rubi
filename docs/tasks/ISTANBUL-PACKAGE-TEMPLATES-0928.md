# Istanbul package generator templates

`COMPUTER_ID=PC-B`; branch `codex/pc-b-istanbul-generator-0928`; created from `origin/develop@1de70e5c` and rebased on `origin/develop@e4eb048c` before handoff.

The owner supplied two Istanbul poster images and two XLSX workbooks. The Package Generator now offers separate three-night and four-night designs under Turkey. The original image is retained for the photographic strip, branding, fixed service text and footer. The hotel's name, room service, sale prices, date, duration and lower price cards are rendered in editable HTML above it. No spreadsheet formula is executed: the existing importer reads saved values.

The owner subsequently supplied an Istanbul promotional banner. Banner mode now offers it as a separate four-hotel design. The original PNG is shown untouched for the initial preview and export; changing an individual hotel renders its name, stars/service, and price as HTML over the artwork. The city, airline, date, headline, flight price, child price, commission, flight times, contact and service fields use the existing banner editor controls. Banner mode remains separate from spreadsheet import. Text and imagery printed into the original background outside these editable regions remain part of the supplied artwork.

The three-night sheet has 29 priced rows and `DBL`, `SGL`, `EXTRA`, `CH W BED`; the four-night sheet has 28 priced rows and `DBL`, `SGL`, `CHD W BED`. The importer maps `ROOM TYPE` to the service column only for an Istanbul-named workbook and chooses the artwork by presence of `EXTRA`. Cell number formats supply `$` or `€` independently per price. The three footer amounts and Taban outbound/return times populate the matching editable cards. The workbook has no structured travel date or service description; the supplied artwork's `۷ مهر روزانه` and service paragraph remain visible as editable presentation defaults and must be checked before distribution.

No Package Pricing API, shared contract, Prisma model, migration, lockfile, permission or other module was changed. This work remains an offline generator template; it does not publish a priced package into the Package Pricing domain.
