import { describe, expect, it } from 'vitest';
import {
  formatBackupBytes,
  parseDestinationConfig,
  validateRecoveryIdentity,
} from './backups-view-model';

describe('backups view model', () => {
  it('validates recovery identity confirmation before sending the secret', () => {
    expect(
      validateRecoveryIdentity({
        label: ' ',
        secret: 'long-enough-secret',
        confirmation: 'long-enough-secret',
      }),
    ).toContain('label');
    expect(
      validateRecoveryIdentity({ label: 'Recovery', secret: 'short', confirmation: 'short' }),
    ).toContain('12 characters');
    expect(
      validateRecoveryIdentity({
        label: 'Recovery',
        secret: 'long-enough-secret',
        confirmation: 'different-secret',
      }),
    ).toContain('do not match');
    expect(
      validateRecoveryIdentity({
        label: 'Recovery',
        secret: 'long-enough-secret',
        confirmation: 'long-enough-secret',
      }),
    ).toBeUndefined();
  });

  it('parses destination config and formats archive byte counts', () => {
    expect(parseDestinationConfig('local', '{"directory":"/tmp/backups"}')).toEqual({
      directory: '/tmp/backups',
    });
    expect(parseDestinationConfig('s3', '{"bucket":"archives","region":"us-east-1"}')).toEqual({
      bucket: 'archives',
      region: 'us-east-1',
    });
    expect(parseDestinationConfig('ftp', '{bad')).toBeUndefined();
    expect(formatBackupBytes(900)).toBe('900 B');
    expect(formatBackupBytes(1536)).toBe('1.5 KB');
    expect(formatBackupBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});
