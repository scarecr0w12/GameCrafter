import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Database } from '../db/database';
import { migrate } from '../db/migrator';
import { profileMigrations } from './migrations';
import { CredentialStore } from './credential-store';

describe('CredentialStore', () => {
  it('encrypts and decrypts secrets by reference and supports replacement and deletion', () => {
    const fixture = makeFixture();
    try {
      const credentials = new CredentialStore(fixture.database, fixture.profileDir);
      credentials.put('provider/test', 'secret value');
      expect(credentials.get('provider/test')).toBe('secret value');
      credentials.put('provider/test', 'replacement');
      expect(credentials.get('provider/test')).toBe('replacement');
      credentials.delete('provider/test');
      expect(credentials.get('provider/test')).toBeUndefined();
      expect(readFileSync(path.join(fixture.profileDir, 'credentials.key'))).toHaveLength(32);
    } finally {
      fixture.close();
    }
  });

  it('deletes only credentials beneath a plugin namespace prefix', () => {
    const fixture = makeFixture();
    try {
      const credentials = new CredentialStore(fixture.database, fixture.profileDir);
      credentials.put('plugin:sample-hello:api', 'secret-a');
      credentials.put('plugin:sample-hello-extra:api', 'secret-b');
      credentials.deletePrefix('plugin:sample-hello:');
      expect(credentials.get('plugin:sample-hello:api')).toBeUndefined();
      expect(credentials.get('plugin:sample-hello-extra:api')).toBe('secret-b');
    } finally {
      fixture.close();
    }
  });

  it('fails authentication when the encryption key is wrong', () => {
    const fixture = makeFixture();
    try {
      const credentials = new CredentialStore(fixture.database, fixture.profileDir);
      credentials.put('provider/test', 'secret value');
      writeFileSync(path.join(fixture.profileDir, 'credentials.key'), randomBytes(32), {
        mode: 0o600,
      });
      const otherStore = new CredentialStore(fixture.database, fixture.profileDir);
      expect(() => otherStore.get('provider/test')).toThrow();
    } finally {
      fixture.close();
    }
  });

  it.skipIf(process.platform === 'win32')('creates the key file with mode 0600', () => {
    const fixture = makeFixture();
    try {
      new CredentialStore(fixture.database, fixture.profileDir).put('provider/test', 'secret');
      expect(statSync(path.join(fixture.profileDir, 'credentials.key')).mode & 0o777).toBe(0o600);
    } finally {
      fixture.close();
    }
  });
});

function makeFixture() {
  const profileDir = mkdtempSync(path.join(tmpdir(), 'gc-credentials-'));
  const database = Database.open(':memory:');
  migrate(database, profileMigrations);
  return {
    profileDir,
    database,
    close() {
      database.close();
      rmSync(profileDir, { recursive: true, force: true });
    },
  };
}
