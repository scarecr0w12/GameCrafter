import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PROTOCOL_VERSION, type ProjectCreateInput } from '@gamecrafter/contracts';
import { Database } from './db/database';
import { IpcServer, type RpcHandlers } from './ipc/server';
import { migrate } from './db/migrator';
import type { ServicePaths } from './paths';
import { profileMigrations } from './profile/migrations';
import { ProfileStore } from './profile/profile-store';
import { ProjectWorkspace } from './projects/workspace';

export interface PlatformServiceOptions {
  paths: ServicePaths;
  platformVersion: string;
  onClientEvent?: (event: 'connected' | 'closed') => void;
}

export class PlatformService {
  readonly socketPath: string;
  readonly startedAt: string;
  private stopped = false;

  private constructor(
    private readonly server: IpcServer,
    private readonly database: Database,
    paths: ServicePaths,
    startedAt: string,
  ) {
    this.socketPath = paths.socketPath;
    this.startedAt = startedAt;
  }

  static async start(options: PlatformServiceOptions): Promise<PlatformService> {
    const { paths, platformVersion } = options;
    mkdirSync(paths.profileDir, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') chmodSync(paths.profileDir, 0o700);
    mkdirSync(paths.logDir, { recursive: true, mode: 0o700 });
    const token = loadOrCreateToken(paths);
    const database = Database.open(paths.profileDbPath);
    migrate(database, profileMigrations);
    const profile = new ProfileStore(database);
    const workspace = new ProjectWorkspace({ profile, platformVersion });
    const startedAt = new Date().toISOString();
    const handlers: RpcHandlers = {
      'service/info': () => ({
        serviceVersion: platformVersion,
        protocolVersion: PROTOCOL_VERSION,
        pid: process.pid,
        profileDir: paths.profileDir,
        startedAt,
        projectCount: profile.list().length,
      }),
      'project/create': async (input: ProjectCreateInput) => {
        const project = await workspace.create(input);
        server.broadcast('project/changed', { kind: 'created', project });
        return project;
      },
      'project/list': () => ({ projects: workspace.list() }),
      'project/open': ({ path: projectPath }) => {
        const project = workspace.open(projectPath);
        server.broadcast('project/changed', { kind: 'opened', project });
        return project;
      },
      'project/get': ({ projectId }) => workspace.get(projectId),
    };
    const server = new IpcServer({
      paths,
      handlers,
      token,
      serviceVersion: platformVersion,
      onClientEvent: options.onClientEvent,
    });

    try {
      await server.listen();
    } catch (error) {
      database.close();
      throw error;
    }
    return new PlatformService(server, database, paths, startedAt);
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    await this.server.close();
    this.database.close();
  }
}

function loadOrCreateToken(paths: ServicePaths): string {
  try {
    return readFileSync(paths.tokenPath, 'utf8').trim();
  } catch (error) {
    if (!isCode(error, 'ENOENT')) throw error;
  }

  const token = randomBytes(32).toString('hex');
  try {
    writeFileSync(paths.tokenPath, `${token}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!isCode(error, 'EEXIST')) throw error;
    return readFileSync(paths.tokenPath, 'utf8').trim();
  }
  return token;
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
