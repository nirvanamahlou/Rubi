# SALES-HOTEL-ENGLISH-OPTIONS-0929

The Sales contract hotel chooser opens with active hotels for the selected destination. A selected tour still restricts the list to its published hotels. Options sort by English hotel label. Hotel rows and the selected value prefer Master Data attributes.englishName; if absent, the existing human-readable name remains the fallback. Search still matches primary name, code and English name. Selecting a row continues to submit the canonical Master Data hotel id, and changing the hotel resets dependent room selection.

Only the hotel chooser opts into list-on-open and English display. Country, city, room, bank, currency and other shared references keep their existing behavior. There is no API, contract, schema/migration, permission, dependency, operational-data or runtime change. An empty city-filtered list says no active hotel is available for that destination.

Validation: the existing targeted SearchableReference spec passed (4 tests), scoped ESLint passed, Web production TypeScript check and 54-route production build passed. Authenticated browser interaction was not performed.
