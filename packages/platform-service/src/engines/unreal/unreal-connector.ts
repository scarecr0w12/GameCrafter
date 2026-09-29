import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  uuidv7,
  type EngineInstallation,
  type EngineOperation,
  type EngineOperationCapability,
} from '@gamecrafter/contracts';
import { isExecutable, readUtf8 } from '../utils';
import type {
  EngineCapabilityContext,
  EngineConnector,
  EngineExecutionContext,
  EngineOperationOutcome,
  EngineProjectIdentity,
} from '../types';

export class UnrealConnector implements EngineConnector {
  readonly family = 'unreal' as const;

  async detectInstallations(environment: NodeJS.ProcessEnv): Promise<EngineInstallation[]> {
    const roots = new Set<string>();
    for (const value of [environment.UE_ROOT, environment.UE_ENGINE_PATH, '/opt/UnrealEngine']) {
      if (value && existsSync(value)) roots.add(path.resolve(value));
    }
    for (const root of unrealHubRoots(environment)) {
      for (const versionDirectory of safeDirectories(root))
        roots.add(path.join(root, versionDirectory));
    }
    const installations: EngineInstallation[] = [];
    for (const root of roots) {
      for (const candidate of executablesForRoot(root)) {
        if (!isExecutable(candidate.executable)) continue;
        const installation: EngineInstallation = {
          installationId: uuidv7(),
          family: this.family,
          version: null,
          executable: candidate.executable,
          kind: candidate.kind,
          source: 'detected',
          detectedAt: new Date().toISOString(),
        };
        installations.push({ ...installation, version: await this.probeVersion(installation) });
      }
    }
    return deduplicate(installations);
  }

  selectInstallation(
    operation: EngineOperation,
    installations: EngineInstallation[],
  ): EngineInstallation | null {
    if (operation === 'build' || operation === 'export') {
      return installations.find((installation) => installation.kind === 'uat') ?? null;
    }
    if (operation === 'test' || operation === 'validate' || operation === 'run') {
      return installations.find((installation) => installation.kind === 'commandlet') ?? null;
    }
    return installations[0] ?? null;
  }

  async probeVersion(installation: EngineInstallation): Promise<string | null> {
    const buildVersion = path.join(
      engineDirectory(installation.executable),
      'Build',
      'Build.version',
    );
    const content = readUtf8(buildVersion);
    if (!content) return null;
    try {
      const data = JSON.parse(content) as {
        MajorVersion?: number;
        MinorVersion?: number;
        PatchVersion?: number;
      };
      if (typeof data.MajorVersion === 'number' && typeof data.MinorVersion === 'number') {
        return `${data.MajorVersion}.${data.MinorVersion}.${data.PatchVersion ?? 0}`;
      }
    } catch {
      return null;
    }
    return null;
  }

  async proveIdentity(gamePath: string): Promise<EngineProjectIdentity> {
    const projectFile = listProjectFiles(gamePath).find((file) => file.endsWith('.uproject'));
    if (!projectFile) return { proven: false, evidence: [], projectVersion: null };
    try {
      const project = JSON.parse(readFileSync(path.join(gamePath, projectFile), 'utf8')) as {
        EngineAssociation?: unknown;
      };
      const association =
        typeof project.EngineAssociation === 'string' ? project.EngineAssociation : null;
      return {
        proven: true,
        evidence: [
          {
            kind: 'file',
            ref: `game/${projectFile}`,
            detail: association ? `EngineAssociation=${association}` : 'Parsed .uproject identity.',
          },
        ],
        projectVersion: association,
      };
    } catch {
      return {
        proven: false,
        evidence: [
          {
            kind: 'file',
            ref: `game/${projectFile}`,
            detail: 'The .uproject file is not valid JSON.',
          },
        ],
        projectVersion: null,
      };
    }
  }

  operations(context: EngineCapabilityContext): EngineOperationCapability[] {
    const project = context.identity.proven;
    const uat = context.installations.some((installation) => installation.kind === 'uat');
    const commandlet = context.installations.some(
      (installation) => installation.kind === 'commandlet',
    );
    const process = (
      operation: EngineOperation,
      available: boolean,
      via: EngineOperationCapability['via'],
      command: string | null,
      sideEffects: EngineOperationCapability['sideEffects'],
      reason: string | null,
    ) =>
      cap(
        operation,
        'headless-process',
        available,
        available ? via : null,
        command,
        sideEffects,
        'Unreal commandlet or Automation Tool operation.',
        reason,
      );
    return [
      cap(
        'discover',
        'project-file',
        project,
        project ? 'file' : null,
        null,
        'none',
        'Located the .uproject file.',
        project ? null : 'No Unreal .uproject identity was found.',
      ),
      cap(
        'inspect',
        'project-file',
        project,
        project ? 'file' : null,
        null,
        'none',
        'Parsed .uproject and project source files.',
        project ? null : 'No Unreal .uproject identity was found.',
      ),
      process(
        'check',
        false,
        null,
        null,
        'none',
        'Check is unavailable for Unreal; use DataValidation or an Automation commandlet.',
      ),
      process(
        'import',
        false,
        null,
        null,
        'workspace-write',
        'Import is not a standalone Unreal CLI operation.',
      ),
      process(
        'build',
        project && uat,
        'cli',
        'RunUAT BuildCookRun -project=<uproject> ...',
        'workspace-write',
        project ? 'RunUAT is not installed.' : 'No Unreal .uproject identity was found.',
      ),
      process(
        'export',
        project && uat,
        'cli',
        'RunUAT BuildCookRun -project=<uproject> -archive ...',
        'workspace-write',
        project ? 'RunUAT is not installed.' : 'No Unreal .uproject identity was found.',
      ),
      process(
        'test',
        project && commandlet,
        'cli',
        'UnrealEditor-Cmd <uproject> -run=Automation -ExecCmds=Automation RunTests',
        'workspace-write',
        project ? 'UnrealEditor-Cmd is not installed.' : 'No Unreal .uproject identity was found.',
      ),
      process(
        'run',
        project && commandlet,
        'cli',
        'UnrealEditor-Cmd <uproject> -game -nullrhi',
        'workspace-write',
        project ? 'UnrealEditor-Cmd is not installed.' : 'No Unreal .uproject identity was found.',
      ),
      process(
        'validate',
        project && commandlet,
        'cli',
        'UnrealEditor-Cmd <uproject> -run=DataValidation',
        'none',
        project ? 'UnrealEditor-Cmd is not installed.' : 'No Unreal .uproject identity was found.',
      ),
      cap(
        'edit-scene',
        'live-editor',
        false,
        null,
        null,
        'workspace-write',
        'Requires a connected live editor bridge.',
        'No connected Unreal live editor bridge is configured.',
      ),
      cap(
        'screenshot',
        'live-editor',
        false,
        null,
        null,
        'none',
        'Requires a connected live editor bridge.',
        'No connected Unreal live editor bridge is configured.',
      ),
      cap(
        'console',
        'live-editor',
        false,
        null,
        null,
        'destructive',
        'Arbitrary Unreal console execution is destructive.',
        'No connected Unreal live editor bridge is configured.',
      ),
    ];
  }

  async run(
    operation: EngineOperation,
    params: Record<string, unknown>,
    context: EngineExecutionContext,
  ): Promise<EngineOperationOutcome> {
    if (operation === 'discover' || operation === 'inspect')
      return this.inspect(operation, context);
    if (!context.installation)
      return unavailable(`No Unreal installation is available for ${operation}.`);
    const projectFile = listProjectFiles(context.gamePath).find((file) =>
      file.endsWith('.uproject'),
    );
    if (!projectFile) return unavailable('No Unreal .uproject identity was found.');
    const fullProjectFile = path.join(context.gamePath, projectFile);
    let args: string[];
    if (operation === 'build' || operation === 'export') {
      const platform = safePlatform(params.platform);
      const archive = path.join(context.runDirectory, 'archive');
      args = [
        'BuildCookRun',
        `-project=${fullProjectFile}`,
        `-platform=${platform}`,
        '-clientconfig=Development',
        '-build',
        '-cook',
        '-stage',
        '-pak',
        '-archive',
        `-archivedirectory=${archive}`,
      ];
    } else if (operation === 'validate') {
      const commandlet =
        typeof params.commandlet === 'string' && params.commandlet.trim()
          ? params.commandlet.trim()
          : 'DataValidation';
      args = [fullProjectFile, `-run=${commandlet}`];
    } else if (operation === 'test') {
      const filter = typeof params.filter === 'string' ? params.filter : '*';
      args = [fullProjectFile, '-run=Automation', `-ExecCmds=Automation RunTests ${filter}; Quit`];
    } else if (operation === 'run') {
      args = [fullProjectFile, '-game', '-nullrhi', '-unattended', '-nop4', '-ExecCmds=Quit'];
    } else {
      return unavailable(
        `Unreal does not support the ${operation} operation through this connector.`,
      );
    }
    const result = await context.runProcess(context.installation.executable, args);
    return {
      status:
        result.exitCode === 0 && !result.timedOut && !result.cancelled ? 'succeeded' : 'failed',
      exitCode: result.exitCode,
      command: result.command,
      summary: result.cancelled
        ? `Unreal ${operation} was cancelled.`
        : result.timedOut
          ? `Unreal ${operation} timed out.`
          : `Unreal ${operation} exited with code ${result.exitCode}.`,
      evidence: [
        {
          kind: 'process',
          ref: 'exit-code',
          detail: `Exit code ${result.exitCode}; duration ${result.durationMs}ms.`,
        },
      ],
      artifacts: result.artifacts,
    };
  }

  private async inspect(
    operation: 'discover' | 'inspect',
    context: EngineExecutionContext,
  ): Promise<EngineOperationOutcome> {
    const identity = await this.proveIdentity(context.gamePath);
    const projectFile =
      listProjectFiles(context.gamePath).find((file) => file.endsWith('.uproject')) ?? null;
    const report = {
      identity,
      projectFile,
      sourceFiles: listProjectFiles(context.gamePath).filter((file) =>
        /\.(?:h|cpp|cs|ini|uasset)$/i.test(file),
      ),
    };
    const artifact = context.writeArtifact(
      'report',
      `${operation}.json`,
      JSON.stringify(report, null, 2),
    );
    return {
      status: identity.proven ? 'succeeded' : 'unavailable',
      exitCode: identity.proven ? 0 : null,
      command: [],
      summary:
        operation === 'discover'
          ? projectFile
            ? `Found ${projectFile}.`
            : 'No .uproject file found.'
          : 'Inspected Unreal project files.',
      evidence: identity.evidence,
      artifacts: [artifact],
    };
  }
}

function cap(
  operation: EngineOperation,
  executionMode: EngineOperationCapability['executionMode'],
  available: boolean,
  via: EngineOperationCapability['via'],
  command: string | null,
  sideEffects: EngineOperationCapability['sideEffects'],
  evidence: string,
  reason: string | null,
): EngineOperationCapability {
  return { operation, executionMode, available, via, command, sideEffects, evidence, reason };
}

function unavailable(reason: string): EngineOperationOutcome {
  return {
    status: 'unavailable',
    exitCode: null,
    command: [],
    summary: reason,
    evidence: [{ kind: 'capability', ref: 'unreal', detail: reason }],
    artifacts: [],
  };
}

function executablesForRoot(
  rootValue: string,
): Array<{ executable: string; kind: 'uat' | 'commandlet' }> {
  const root = path.basename(rootValue) === 'Engine' ? path.dirname(rootValue) : rootValue;
  const platform =
    process.platform === 'win32' ? 'Win64' : process.platform === 'darwin' ? 'Mac' : 'Linux';
  const editorName = process.platform === 'win32' ? 'UnrealEditor-Cmd.exe' : 'UnrealEditor-Cmd';
  const uatName = process.platform === 'win32' ? 'RunUAT.bat' : 'RunUAT.sh';
  return [
    { executable: path.join(root, 'Engine', 'Binaries', platform, editorName), kind: 'commandlet' },
    { executable: path.join(root, 'Engine', 'Build', 'BatchFiles', uatName), kind: 'uat' },
  ];
}

function engineDirectory(executable: string): string {
  let current = path.resolve(executable);
  while (path.dirname(current) !== current) {
    if (path.basename(current) === 'Engine') return current;
    current = path.dirname(current);
  }
  return path.dirname(executable);
}

function unrealHubRoots(environment: NodeJS.ProcessEnv): string[] {
  const programFiles = environment.ProgramFiles ?? 'C:\\Program Files';
  return [
    path.join(programFiles, 'Epic Games'),
    path.join(os.homedir(), 'Epic', 'UnrealEngine'),
    '/opt',
  ];
}

function safeDirectories(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function deduplicate(installations: EngineInstallation[]): EngineInstallation[] {
  const seen = new Set<string>();
  return installations.filter((installation) => {
    const key = `${installation.kind}:${path.resolve(installation.executable)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function listProjectFiles(root: string, current = root): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (
      entry.name === '.git' ||
      entry.name === 'Intermediate' ||
      entry.name === 'Saved' ||
      entry.name === 'Binaries'
    )
      continue;
    const target = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push(...listProjectFiles(root, target));
    else result.push(path.relative(root, target).split(path.sep).join('/'));
  }
  return result;
}

function safePlatform(value: unknown): string {
  const platform = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_+-]{1,32}$/.test(platform)
    ? platform
    : process.platform === 'win32'
      ? 'Win64'
      : process.platform === 'darwin'
        ? 'Mac'
        : 'Linux';
}
