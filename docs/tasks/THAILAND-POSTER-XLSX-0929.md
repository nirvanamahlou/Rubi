# THAILAND-POSTER-XLSX-0929

Three supplied spreadsheets (Phuket, Pattaya, Bangkok–Phuket) are the acceptance fixtures for the Thailand package posters. The workbooks are read locally during QA and are not committed.

The parser now selects the final sale columns, including Pattaya's second `SINGLE / DBLE / CWB / CNB` group, instead of purchase and markup columns. Flight dates, fares, days, times, ticket price, child fare and increase notes are mapped to their corresponding poster sections. Phuket's 35 hotels, Pattaya's 67 hotels across two table columns, and Bangkok–Phuket's 20 hotels fit their template table areas. The Pattaya room-type column is omitted because the poster has no room-type column.

The rate strip and Pattaya schedule use opaque, template-aligned HTML/CSS so stale printed prices do not show through. Cards, services and table regions remain within their original rounded frames. Missing workbook values display as unavailable rather than guessed figures. This changes only the local Package Generator parser, renderer, layout, styling and focused test; it adds no data persistence, API, migration or dependency.

Acceptance: render each supplied workbook in the browser; compare first and last hotel rows and poster summary values with the workbook's final-sale cells; check that the original bitmap's rates do not leak through; confirm `layoutError` is false. Automated regression covers sale-column precedence and the under-two fare label.
