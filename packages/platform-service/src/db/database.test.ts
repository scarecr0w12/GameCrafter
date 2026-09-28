import { afterEach, describe, expect, it } from 'vitest';
import { Database } from './database';
import { migrate } from './migrator';

const openDatabases: Database[] = [];
const migrations = [
  {
    id: 1,
    name: 'create sample table',
    up: 'CREATE TABLE sample (value TEXT NOT NULL)',
  },
];

afterEach(() => {
  for (const database of openDatabases.splice(0)) database.close();
});

describe('database migrations', () => {
  it('applies migrations once and is idempotent', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);

    expect(migrate(database, migrations).applied).toEqual([1]);
    expect(migrate(database, migrations).applied).toEqual([]);
  });

  it('rejects an applied migration with a different name', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);
    migrate(database, migrations);

    expect(() => migrate(database, [{ ...migrations[0]!, name: 'renamed migration' }])).toThrow(
      /name mismatch/,
    );
  });

  it('rolls back failed transactions', () => {
    const database = Database.open(':memory:');
    openDatabases.push(database);

    expect(() =>
      database.transaction(() => {
        database.exec('CREATE TABLE rolled_back (value TEXT)');
        throw new Error('abort');
      }),
    ).toThrow('abort');
    expect(() => database.prepare('SELECT * FROM rolled_back').all()).toThrow();
  });
});
