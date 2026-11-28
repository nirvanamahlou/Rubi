import assert from 'node:assert/strict';
import test from 'node:test';
import { tableGuide } from './erp-table-guide.mjs';

test('uses a business phrase ahead of generic words in a multipart question', () => {
  const cards = tableGuide(
    'شماره آخرین قرارداد ثبت‌شده، خدمات، مبلغ هر ارز و وضعیت تسویه‌ش رو بده.',
    [{ id: 'contracts' }],
  );
  assert.equal(cards[0].sqlSource, 'contracts');
});
test('describes lineage without creating a SQL grant', () => {
  const question =
    'جمع دریافت‌های تأییدشده دو هفته اخیر به تفکیک ارز چقدر بوده؟';
  assert.equal(
    tableGuide(question, [])[0].table,
    'sales_contract_payment_entries',
  );
  assert.equal(tableGuide(question, [])[0].sqlSource, undefined);
  assert.equal(
    tableGuide(question, [{ id: 'payments' }])[0].sqlSource,
    'payments',
  );
});
