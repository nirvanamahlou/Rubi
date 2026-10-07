/* eslint-disable @typescript-eslint/no-require-imports -- Standalone offline catalogue generator. */
const fs = require('node:fs');
const path = require('node:path');
const { inventory } = require('./i18n-inventory.cjs');
const root = path.resolve(__dirname, '../../..');
const overrides = require('../src/i18n/en-overrides.json');
const catalogue = { ...require('../src/i18n/en-catalog.json'), ...overrides };
const api = { ...overrides },
  legacy = { ...overrides };
for (const row of inventory()) {
  if (!catalogue[row.text])
    throw new Error(`Missing English translation: ${row.text}`);
  if (row.files.some((file) => file.startsWith('apps/api/src/')))
    api[row.text] = catalogue[row.text];
  if (row.files.some((file) => file.startsWith('apps/web/public/')))
    legacy[row.text] = catalogue[row.text];
}
const outputs = [
  [
    'apps/api/src/common/i18n/en-catalog.json',
    JSON.stringify(api, null, 2) + '\n',
  ],
  [
    'apps/web/public/package-generator/i18n-catalog.js',
    'window.RUBI_ENGLISH_UI = ' + JSON.stringify(legacy) + ';\n',
  ],
];
for (const [relative, content] of outputs) {
  const file = path.join(root, relative);
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== content)
      throw new Error(
        `Run node apps/web/scripts/i18n-sync.cjs to refresh ${relative}`,
      );
  } else fs.writeFileSync(file, content);
}
console.log('Offline API and legacy English catalogues synchronized.');
