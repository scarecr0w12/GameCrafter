import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { IsolationReport } from '@gamecrafter/contracts';
import type { IsolationLauncher, LaunchSpec } from './types';

const execFileAsync = promisify(execFile);
const systemDirectories = ['/usr', '/lib', '/lib64', '/bin', '/sbin'];

export interface BwrapLauncherOptions {
  binaryPath?: string;
}

export interface BwrapProbeResult {
  uid: number;
  gid: number;
  pid: number;
  nspid: string[];
  namespaces: Record<'user' | 'pid' | 'net' | 'mnt', string>;
  proc: boolean;
  tmp: boolean;
}

export interface BwrapHostIdentity {
  uid: number;
  gid: number;
  namespaces: Record<'user' | 'pid' | 'net' | 'mnt', string>;
}

export class BwrapLauncher implements IsolationLauncher {
  private readonly binaryPath: string;

  constructor(options: BwrapLauncherOptions = {}) {
    this.binaryPath = options.binaryPath ?? 'bwrap';
  }

  async probe(): Promise<IsolationReport> {
    const emptyReport = (details: string): IsolationReport => ({
      platform: 'linux',
      backend: 'bwrap',
      available: false,
      checks: ['userns', 'pidns', 'netns', 'mount'].map((name) => ({
        name,
        ok: false,
        detail: details,
      })),
    });
    if (process.platform !== 'linux') return emptyReport('bubblewrap is only available on Linux.');
    const root = mkdtempSync(path.join(tmpdir(), 'gc-bwrap-probe-'));
    const pluginDir = path.join(root, 'plugin');
    const scratchDir = path.join(root, 'scratch');
    mkdirSync(pluginDir);
    mkdirSync(scratchDir);
    try {
      const host: BwrapHostIdentity = {
        uid: process.getuid?.() ?? -1,
        gid: process.getgid?.() ?? -1,
        namespaces: {
          user: readlinkSync('/proc/self/ns/user'),
          pid: readlinkSync('/proc/self/ns/pid'),
          net: readlinkSync('/proc/self/ns/net'),
          mnt: readlinkSync('/proc/self/ns/mnt'),
        },
      };
      const probeProgram = [
        "const fs = require('node:fs');",
        "const status = fs.readFileSync('/proc/self/status', 'utf8');",
        'const nspid = status.match(/^NSpid:\\s*(.*)$/m)?.[1]?.trim().split(/\\s+/) ?? [];',
        "const names = ['user', 'pid', 'net', 'mnt'];",
        "const namespaces = Object.fromEntries(names.map((name) => [name, fs.readlinkSync('/proc/self/ns/' + name)]));",
        "process.stdout.write(JSON.stringify({ uid: process.getuid(), gid: process.getgid(), pid: process.pid, nspid, namespaces, proc: fs.existsSync('/proc/self/status'), tmp: fs.statSync('/tmp').isDirectory() }));",
      ].join('');
      const spec: LaunchSpec = {
        command: process.execPath,
        args: ['-e', probeProgram],
        env: {},
        cwd: pluginDir,
        readOnlyPaths: [pluginDir],
        readWritePaths: [scratchDir],
        network: false,
        pluginDir,
        scratchDir,
      };
      const { stdout } = await execFileAsync(this.binaryPath, this.buildArgs(spec), {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
      const child = JSON.parse(stdout) as BwrapProbeResult;
      const checks = evaluateBwrapProbeChecks(child, host);
      return {
        platform: 'linux',
        backend: 'bwrap',
        available: checks.every((check) => check.ok),
        checks,
      };
    } catch (error) {
      return emptyReport(errorMessage(error));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  launch(spec: LaunchSpec): ChildProcessWithoutNullStreams {
    if (process.platform !== 'linux') throw new Error('bubblewrap launcher requires Linux.');
    return spawn(this.binaryPath, this.buildArgs(spec), {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams;
  }

  private buildArgs(spec: LaunchSpec): string[] {
    const args = [
      '--die-with-parent',
      '--new-session',
      '--unshare-user',
      '--unshare-pid',
      '--unshare-ipc',
      '--unshare-uts',
      '--unshare-cgroup',
    ];
    if (!spec.network) args.push('--unshare-net');
    args.push('--clearenv');
    const environment = {
      ...spec.env,
      PATH: '/usr/bin:/bin',
      HOME: spec.pluginDir,
      LANG: 'C.UTF-8',
      TMPDIR: spec.scratchDir,
    };
    for (const [key, value] of Object.entries(environment)) {
      args.push('--setenv', key, value);
    }
    args.push('--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--dir', '/etc');
    for (const directory of systemDirectories) {
      if (isDirectory(directory)) args.push('--ro-bind', realpathSync(directory), directory);
    }
    if (spec.network) {
      if (isDirectory('/etc/ssl')) args.push('--ro-bind', realpathSync('/etc/ssl'), '/etc/ssl');
      if (existsSync('/etc/resolv.conf'))
        args.push('--ro-bind', '/etc/resolv.conf', '/etc/resolv.conf');
    }
    const readOnly = uniqueAbsolutePaths([...spec.readOnlyPaths, spec.pluginDir]);
    const readWrite = uniqueAbsolutePaths([...spec.readWritePaths, spec.scratchDir]);
    const destinationPaths = [...readOnly, ...readWrite];
    if (path.isAbsolute(spec.command) && existsSync(spec.command)) {
      const executable = realpathSync(spec.command);
      const binaryDirectory = path.dirname(executable);
      if (!systemDirectories.some((directory) => isWithin(executable, directory))) {
        readOnly.push(binaryDirectory);
        destinationPaths.push(binaryDirectory);
      }
    }
    for (const directory of destinationParents(destinationPaths)) args.push('--dir', directory);
    for (const source of readOnly) args.push('--ro-bind', realpathSync(source), source);
    for (const source of readWrite) args.push('--bind', realpathSync(source), source);
    args.push('--chdir', spec.pluginDir, '--', spec.command, ...spec.args);
    return args;
  }
}

export function evaluateBwrapProbeChecks(
  child: BwrapProbeResult,
  host: BwrapHostIdentity,
): IsolationReport['checks'] {
  const identityMapping = child.uid === host.uid && child.gid === host.gid;
  return [
    {
      name: 'userns',
      ok: identityMapping && child.namespaces.user !== host.namespaces.user,
      detail: `uid=${child.uid} hostUid=${host.uid}; gid=${child.gid} hostGid=${host.gid}; identity=${identityMapping}; namespace=${child.namespaces.user}`,
    },
    {
      name: 'pidns',
      ok:
        child.pid > 0 &&
        child.pid <= 2 &&
        child.nspid.length === 1 &&
        child.namespaces.pid !== host.namespaces.pid,
      detail: `pid=${child.pid}; NSpid=${child.nspid.join(' ')}; namespace=${child.namespaces.pid}`,
    },
    {
      name: 'netns',
      ok: child.namespaces.net !== host.namespaces.net,
      detail: `namespace=${child.namespaces.net}`,
    },
    {
      name: 'mount',
      ok: child.proc && child.tmp && child.namespaces.mnt !== host.namespaces.mnt,
      detail: `proc=${child.proc}; tmp=${child.tmp}; namespace=${child.namespaces.mnt}`,
    },
  ];
}

function uniqueAbsolutePaths(paths: string[]): string[] {
  const unique = [...new Set(paths.map((entry) => path.resolve(entry)))];
  for (const entry of unique) {
    if (!path.isAbsolute(entry)) throw new Error(`Isolation mount path must be absolute: ${entry}`);
  }
  return unique;
}

function destinationParents(paths: string[]): string[] {
  const parents = new Set<string>();
  const alreadyCreated = new Set([
    '/tmp',
    '/proc',
    '/dev',
    '/usr',
    '/lib',
    '/lib64',
    '/bin',
    '/sbin',
    '/etc',
  ]);
  for (const destination of paths) {
    let current = path.dirname(destination);
    while (current !== path.dirname(current) && !alreadyCreated.has(current)) {
      parents.add(current);
      current = path.dirname(current);
    }
  }
  return [...parents].sort(
    (left, right) => left.length - right.length || left.localeCompare(right),
  );
}

function isDirectory(value: string): boolean {
  try {
    return statSync(value).isDirectory();
  } catch {
    return false;
  }
}

function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
