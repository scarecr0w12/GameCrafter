import { describe, expect, it } from 'vitest';
import { deliverClientNotification } from './client-notification';

describe('frontend notification delivery', () => {
  it('contains a rejected RPC delivery when the transport closes', async () => {
    deliverClientNotification(() => Promise.reject(new Error('transport close')));
    await new Promise((resolve) => setImmediate(resolve));
    // Vitest reports unhandled rejections as failures, so an escaped rejection fails this test.
    let delivered = false;
    deliverClientNotification(() => {
      delivered = true;
    });
    expect(delivered).toBe(true);
  });
  it('contains synchronous proxy failures', () => {
    expect(() =>
      deliverClientNotification(() => {
        throw new Error('closed proxy');
      }),
    ).not.toThrow();
  });
});
