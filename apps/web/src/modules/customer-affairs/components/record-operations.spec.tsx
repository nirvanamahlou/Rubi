import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  editableLeadTransitions,
  RecordOperations,
  ticketCategories,
} from './record-operations';
import type { Detail } from './customer-affairs-workspace';

describe('Customer Affairs operational forms', () => {
  it('cannot shortcut qualification or the sales handoff workflow', () => {
    for (const transitions of Object.values(editableLeadTransitions)) {
      expect(transitions).not.toContain('QUALIFIED');
      expect(transitions).not.toContain('HANDED_OFF');
      expect(transitions).not.toContain('HANDOFF_PROPOSED');
    }
    expect(editableLeadTransitions.LOST).toEqual(['NURTURE']);
    expect(editableLeadTransitions.HANDED_OFF).toEqual([]);
  });
  it('has explicit issuance, correction and document resend categories', () => {
    const values = ticketCategories.map(([value]) => value);
    expect(values).toEqual(
      expect.arrayContaining(['ISSUANCE', 'CORRECTION', 'DOCUMENT_RESEND']),
    );
    expect(new Set(values).size).toBe(values.length);
  });
  it('surfaces recorded loss and corrective action without inline editing forms', () => {
    const detail = {
      stage: 'LOST',
      lostReason: 'قیمت و بودجه',
      lostNote: 'بودجه کافی نبود',
      correctiveActions: [
        { id: 'a', status: 'OPEN', title: 'تماس مجدد', version: 1 },
      ],
    } as unknown as Detail;
    const html = renderToStaticMarkup(
      <RecordOperations detail={detail} onReload={async () => {}} />,
    );
    expect(html).toContain('قیمت و بودجه');
    expect(html).toContain('ثبت نتیجه اقدام اصلاحی');
    expect(html).not.toContain('<form');
  });
});
