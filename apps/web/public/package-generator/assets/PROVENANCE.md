# Banner background layers


## Visa services banner — 2026-09-09

For the ten additional tourism layouts (15, 14, 13, 12, 11, 09, sunset, 07, H15 and H13), see [COLLECTION-PROVENANCE.md](COLLECTION-PROVENANCE.md), including all original paths, final plates, generation tool and exact prompts.

Original input: `C:/Users/admin/Desktop/Trainings/Package_Template/4c2a11db-0b3f-48a6-947b-373a988f9c79.png`, 941 × 1672. It is copied unchanged to `assets/visa-reference.png` and embedded in `visa-assets.js`. The agency logo, eleven country flags and table header icons are exact canvas crops of that supplied artwork. Initial country names, service descriptions and prices are sample data transcribed from the user reference, not independently verified current tariffs.

`assets/visa-clean.png` was prepared using the built-in image_gen.imagegen tool, editing the original input. It is embedded in `visa-clean.js` for offline rendering. Only feathered masks underneath edited header/footer text or replaced/hidden logos reveal this clean plate; the rest uses the original reference. The editable table is rendered as HTML/CSS. Hidden background reconstruction and newly typeset text are not claimed to be pixel-identical to an unavailable layered source. No image-generation API is used by the application.

Generated original retained at `C:/Users/admin/.codex/generated_images/01a07ad5-c92b-7ff2-87b7-c92106d8bd90/exec-22231884-7177-4211-b126-7f5888814d6b.png`.

Prompt:

> Use case: precise-object-edit. Edit target: the supplied 941 x 1672 portrait visa advertisement. Make a precise clean backing plate, exact same framing, geometry and dimensions. Remove ONLY these printed elements: the complete white agency logo/brand writing at top left within the red circle; the Persian offer text inside the gold-outlined top red pill; the large Persian white/red title below the pill; the small Persian subtitle under that title; all footer contact lettering at the bottom (consultation text, telephone number, address). Reconstruct their original smooth navy or red/pink gradient backgrounds seamlessly. KEEP the gold/red pill and all its outlines and shadows, the red circle and swooping red boundary, both passport illustrations including the word VISA on them, the airplane, the red horizontal separator with center dot, the bottom red/navy footer shapes and all telephone/location icons EXACTLY in place. Keep the entire central table (from y=363 through y=1585), its flags, text, prices, grid and borders unchanged; do not touch any part of that table. No new lettering, no new objects, no redesign. This image will be used only in small masks underneath editable header/footer text, so exact registration to the reference and continuous gradients are essential.


## Five additional reference banners — 2026-09-09

The five PNG templates attached by the user are embedded unchanged in `banner-reference-images.js`. `banner-reference-crops.js` contains exact local canvas crops of their hotel photos and logos. Those crops do not synthesize new artwork.

The following backing plates were prepared with the built-in imagegen tool (not an API in the application): `reference-antalya_gold-clean.png`, `reference-kusadasi_sun-clean.png`, `reference-bodrum_gold-clean.png`, `reference-antalya_turquoise-clean.png`, and `reference-kusadasi_postcard-clean.png`. They are also embedded in `banner-reference-backgrounds.js` to support offline file:// exports. Only small areas underneath edited headings, labels, or replaced logos use these plates. The unedited main scenery, photos, frame geometry, footer, and original lettering remain from the user-provided reference. Reconstructed hidden pixels and newly typeset lettering are not claimed to be pixel-identical to an unavailable layered source design.

Prompt applied separately to each corresponding input image:

> Use case: precise-object-edit. Edit target: the supplied portrait travel template, 1122 x 1402 layout. Produce a clean text-free backing plate for an offline layered form editor. REMOVE all typography, all letters and numbers in any language, both company logos at the top, star ratings, placeholder dots and dashes, and footer phone/address writing. Reconstruct the exact underlying sky, clouds, ocean, wall, colored brush stroke, or panel fill beneath those removed marks. KEEP ALL non-letter artwork precisely at its original coordinates: the scenic photograph, buildings, flowers, leaves, sky, sea, insets and every hotel photograph, every white/navy/gold/turquoise panel shape with border/gradient/shadow, all standalone travel/calendar/hotel/phone/service icons, decorative swooshes, and footer pill/hexagons. Do not reposition or resize panels. Do not redesign or invent any scene elements. Do not replace photographs. No lettering, no logos, no watermark. The output is the same composition and dimensions, with blank clean text regions. Exact registration to the supplied reference is essential because the editor will use only small patches behind edited text.

## Earlier square and pink banners

The original references are preserved in banner-templates.js. These two additional clean scenery layers were restored with the built-in imagegen tool (not the CLI or a runtime API). They are used when replacing a city heading or changing the number of hotel cards, so old lettering/cards do not remain behind new content. Hidden scenery is reconstructed and is not claimed to be pixel-identical to the original photograph. All rendering in the application is local and offline.

- banner-square-clean.png: square banner reference supplied by the user.
- banner-pink-clean.png: pink vertical banner reference supplied by the user.

Prompt (same request applied independently to each reference):

Edit target: the attached travel banner. This is a precise background restoration asset for a layered offline banner editor. Keep the exact image framing, dimensions/aspect ratio, coastal photograph, buildings, mountains, harbor, boats, sky, sea and flowers in their current positions and colors. REMOVE every text, all logos, all hotel-card panels INCLUDING the hotel inset photographs, all price/date/offer badges, all decorative icons and footer lettering. Seamlessly restore the underlying coastal scenery or soft pale background where those overlays covered it. Preserve the underlying footer background color/shape and pale lower bands where present, but remove all writing and logos inside them. No new objects, no new typography, no new logos or panels. The desired output is the SAME background photograph and footer decoration, entirely clean of overlays, ready for editable text and hotel cards to be placed over it. Do not restyle or redesign the background.
