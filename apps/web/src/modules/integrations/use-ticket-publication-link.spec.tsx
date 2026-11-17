import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ticketPublicationLink,
  useTicketPublicationLink,
} from './use-ticket-publication-link';
afterEach(() => vi.unstubAllGlobals());
describe('ticket publication entry route', () => {
  it('keeps the complete scoped ticket filters for direct publication navigation', () => {
    const route = ticketPublicationLink(
      '?view=tickets&branchId=branch&origin=THR&destination=KIH&offer=one&offer=two',
    );
    expect(route?.get('branchId')).toBe('branch');
    expect(route?.get('origin')).toBe('THR');
    expect(route?.getAll('offer')).toEqual(['one', 'two']);
  });
  it.each(['', '?view=sites', '?view=tickets-other'])(
    'keeps the integration hub for a non-ticket entry %s',
    (search) => expect(ticketPublicationLink(search)).toBeUndefined(),
  );
  it('renders a stable server snapshot even when a browser location is present', () => {
    vi.stubGlobal('window', {
      location: { search: '?view=tickets&branchId=branch' },
    });
    function Probe() {
      const route = useTicketPublicationLink();
      return <span>{route ? 'ticket-link' : 'integration-hub'}</span>;
    }
    expect(renderToStaticMarkup(<Probe />)).toBe(
      '<span>integration-hub</span>',
    );
  });
});
