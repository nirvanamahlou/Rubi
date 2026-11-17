import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MissionFields, MissionDetails, emptyMission } from './mission-fields';
describe('mission request fields', () => {
  it('shows schedule fields and locks costs during initial submission', () => {
    const html = renderToStaticMarkup(
      <MissionFields value={emptyMission()} onChange={() => {}} />,
    );
    expect(html).toContain('هدف مأموریت');
    expect(html).toContain('ساعت برگشت');
    expect(html).toMatch(/<fieldset disabled=""/);
    expect(html).toContain('ثبت هزینه پس از پایان مأموریت');
  });
  it('allows only financial editing after the mission', () => {
    const html = renderToStaticMarkup(
      <MissionFields
        value={{ ...emptyMission(), destination: 'تهران' }}
        financial
        onChange={() => {}}
      />,
    );
    expect(html).toContain('اطلاعات هزینه');
    expect(html).toMatch(
      /disabled=""[^>]*value="تهران"|value="تهران"[^>]*disabled=""/,
    );
    expect(html).toContain('فیش و مدارک');
  });
  it('renders complete financial facts for the recipient', () => {
    const html = renderToStaticMarkup(
      <MissionDetails
        id="ticket"
        mission={{
          ...emptyMission(),
          destination: 'تهران',
          purpose: 'جلسه',
          finance: {
            amount: '120000',
            title: 'تاکسی',
            costCenter: 'فروش',
            fee: '1000',
            description: 'رفت و برگشت',
            referToPetty: true,
            attachmentIds: [],
          },
        }}
      />,
    );
    for (const value of [
      'تهران',
      '120000',
      'تاکسی',
      'فروش',
      '1000',
      'رفت و برگشت',
    ])
      expect(html).toContain(value);
  });
});
