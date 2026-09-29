import { describe, expect, it } from 'vitest';
import type { Database } from '../db/database';
import type { CredentialStore } from '../profile/credential-store';
import type { ProfileStore } from '../profile/profile-store';
import type { ProjectDatabases } from '../projects/project-databases';
import type { SettingsService } from '../settings/settings-service';
import { ToolRegistry } from '../tools/tool-registry';
import { AssetService } from './asset-service';

describe('AssetService', () => {
  it('keeps user-only review out of the agent broker tool registry', () => {
    const toolRegistry = new ToolRegistry();
    new AssetService({
      database: {} as Database,
      projects: {} as ProfileStore,
      projectDatabases: {} as ProjectDatabases,
      credentials: {} as CredentialStore,
      settings: {} as SettingsService,
      toolRegistry,
      events: { jobChanged: () => undefined },
    });
    expect(toolRegistry.list().map((tool) => tool.toolId)).not.toContain('asset/review');
  });
});
