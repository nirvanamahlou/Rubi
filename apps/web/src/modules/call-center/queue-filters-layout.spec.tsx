import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkQueue } from './workflow';
vi.mock('@/modules/iam/access-context', () => ({ useAccessActor: () => null }));
it('places the three request filters in the queue and omits the removed follow-up selector', () => {
  const html = renderToStaticMarkup(
    <WorkQueue actorId="actor" branchId="branch" canManage={false} />,
  );
  for (const label of [
    'تیم فعلی ثبت‌کننده',
    'کارشناس ثبت‌کننده',
    'وضعیت درخواست',
  ])
    expect(html).toContain(label);
  expect(html).not.toContain('پیگیری مخاطب');
});
