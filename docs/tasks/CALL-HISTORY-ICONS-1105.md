# Call history illustrated direction icons

Date: 2026-11-05. COMPUTER_ID: PC-C.

The owner selected preview option 2 for the existing Call Center history timeline:
green inbound and blue outbound handsets on pale rounded tiles, with white
directional arrows inside round badges. This is explicit approval for this limited
visual change under CALL-CENTER-UI-PRESERVATION.md.

The module-local CallHistoryIcon renders a crisp inline vector at 36 px. Inbound
uses a down-left arrow; outbound uses an up-right arrow. Both directions retain
their existing text labels. SVGs are decorative and excluded from keyboard and
screen-reader navigation. The timeline marker spacing accommodates the new size.
All call data, history details, recording actions and permission rules are unchanged.
The shared Navy/Pearl illustrations and all other panels are unchanged.

Validation: actual component markup and module CSS were reviewed in a 280 px RTL
history panel on light and dark backgrounds, including full-size and enlarged
icons. Sixteen existing Call Center history/model/recording/appearance checks and
scoped ESLint, full Web TypeScript and the 67-route production build passed.
Implementation commit: 09cf21034. PR: https://github.com/nirvanamahlou/Rubi/pull/1409.
All final-head hosted checks remain required before develop merge.
No implementation-mirroring test was added for this presentation-only change.

No API, schema, migration, dependencies, stored records or server deployment changes.
Local preview and image-generation references stay outside Git. Source freezes on
publication; normal final-head CI checks precede the standing authorized develop merge.
