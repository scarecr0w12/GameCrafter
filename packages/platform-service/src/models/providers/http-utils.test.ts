import { describe, expect, it } from 'vitest';
import { safeExcerpt } from './http-utils';

describe('provider error excerpts', () => {
  it('redacts a credential before truncating an error body', () => {
    const credential = 'private-provider-credential-with-no-recognizable-prefix';
    const excerpt = safeExcerpt(`${'x'.repeat(500)}${credential}`, credential);
    expect(excerpt).not.toContain('private-prov');
    expect(excerpt).toHaveLength(510);
    expect(excerpt).toContain('[REDACTED]');
  });
});
