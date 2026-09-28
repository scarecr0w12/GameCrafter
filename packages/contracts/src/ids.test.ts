import { describe, expect, it } from 'vitest';
import { asEventId, asProjectId, asTaskId, isUuid, uuidv7 } from './ids';

describe('UUID identifiers', () => {
  it('generates UUIDv7 values with a current millisecond timestamp', () => {
    const before = Date.now();
    const value = uuidv7();
    const after = Date.now();
    const hex = value.replaceAll('-', '');
    const timestamp = Number.parseInt(hex.slice(0, 12), 16);

    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(timestamp).toBeGreaterThanOrEqual(before - 5000);
    expect(timestamp).toBeLessThanOrEqual(after + 5000);
  });

  it('brands valid UUID strings and rejects malformed identifiers', () => {
    const value = '019535d4-2c00-7000-8000-000000000001';

    expect(isUuid(value)).toBe(true);
    expect(asProjectId(value)).toBe(value);
    expect(asTaskId(value)).toBe(value);
    expect(asEventId(value)).toBe(value);
    expect(() => asProjectId('not-a-uuid')).toThrow('ProjectId must be a valid UUID');
  });
});
