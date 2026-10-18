import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import {
  dailyPackageEvent,
  dailyPackageMessage,
} from './daily-package-message';

const requestId = '11111111-1111-4111-8111-111111111111';
const payload = () => ({
  type: 'rubi-daily-package-publish',
  requestId,
  title: 'پکیج تست',
  blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
});

describe('package generator daily publish bridge', () => {
  it('requires the exact frame and same origin before accepting a PDF', () => {
    const frame = {} as Window;
    const event = {
      origin: 'https://crm.test',
      source: frame,
      data: payload(),
    };
    expect(dailyPackageEvent(event, event.origin, frame)).not.toBeNull();
    expect(
      dailyPackageEvent(
        { ...event, origin: 'https://evil.test' },
        event.origin,
        frame,
      ),
    ).toBeNull();
    expect(
      dailyPackageEvent(
        { ...event, source: {} as Window },
        event.origin,
        frame,
      ),
    ).toBeNull();
  });
  it.each([
    { title: '' },
    { title: 'x'.repeat(201) },
    { blob: new Blob([], { type: 'application/pdf' }) },
    { blob: new Blob(['html'], { type: 'text/html' }) },
    { requestId: 'invalid' },
  ])('rejects malformed output %j', (change) => {
    expect(dailyPackageMessage({ ...payload(), ...change })).toBeNull();
  });
  it('sends the generated PDF and waits for a matching host result', async () => {
    let listener: (event: unknown) => void = () => {};
    const postMessage = vi.fn();
    const parent = { postMessage };
    const window: {
      parent: typeof parent;
      location: { origin: string };
      addEventListener: (name: string, callback: typeof listener) => void;
      PackageDailyPublisher?: {
        publish: (blob: Blob, title: string) => Promise<void>;
      };
    } = {
      parent,
      location: { origin: 'https://crm.test' },
      addEventListener: (_name, callback) => {
        listener = callback;
      },
    };
    vm.runInNewContext(
      readFileSync(
        resolve(process.cwd(), 'public/package-generator/daily-packages.js'),
        'utf8',
      ),
      {
        window,
        Blob,
        crypto: { randomUUID: () => requestId },
        setTimeout: () => 1,
        clearTimeout: vi.fn(),
      },
    );
    listener({
      origin: 'https://evil.test',
      source: parent,
      data: { type: 'rubi-daily-packages-enabled' },
    });
    await expect(
      window.PackageDailyPublisher!.publish(payload().blob, 'test'),
    ).rejects.toThrow();
    listener({
      origin: 'https://crm.test',
      source: parent,
      data: { type: 'rubi-daily-packages-enabled' },
    });
    let done = false;
    const result = window
      .PackageDailyPublisher!.publish(payload().blob, 'test')
      .then(() => {
        done = true;
      });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        title: 'test',
        type: 'rubi-daily-package-publish',
      }),
      'https://crm.test',
    );
    listener({
      origin: 'https://crm.test',
      source: {},
      data: { type: 'rubi-daily-package-result', requestId, success: true },
    });
    await Promise.resolve();
    expect(done).toBe(false);
    listener({
      origin: 'https://crm.test',
      source: parent,
      data: { type: 'rubi-daily-package-result', requestId, success: true },
    });
    await result;
    expect(done).toBe(true);
  });
});
