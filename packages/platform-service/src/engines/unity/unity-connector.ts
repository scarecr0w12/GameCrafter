import { readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  uuidv7,
  type EngineInstallation,
  type EngineOperation,
  type EngineOperationCapability,
} from '@gamecrafter/contracts';
import { executableCandidates, probeCommand, readUtf8 } from '../utils';
import type {
  EngineCapabilityContext,
  EngineConnector,
  EngineExecutionContext,
  EngineOperationOutcome,
  EngineProjectIdentity,
} from '../types';

export class UnityConnector implements EngineConnector {
  readonly family = 'unity' as const;

  async detectInstallations(environment: NodeJS.ProcessEnv): Promise<EngineInstallation[]> {
    const commonPaths = [
      '/opt/unity/Editor/Unity',
      '/Applications/Unity/Hub/Editor/Unity.app/Contents/MacOS/Unity',
      path.join(os.homedir(), 'Unity', 'Hub', 'Editor', 'Unity', 'Editor', 'Unity'),
    ];
    for (const root of unityHubRoots(environment)) {
      for (const version of safeDirectoryNames(root)) {
        commonPaths.push(
          path.join(root, version, 'Editor', process.platform === 'win32' ? 'Unity.exe' : 'Unity'),
        );
      }
    }
    const candidates = executableCandidates(
      ['unity', 'Unity'],
      environment,
      ['UNITY_PATH'],
      commonPaths,
    );
    const installations: EngineInstallation[] = [];
    for (const executable of candidates) {
      const kind = isUnityCli(executable) ? 'cli' : 'editor';
      const installation: EngineInstallation = {
        installationId: uuidv7(),
        family: this.family,
        version: null,
        executable,
        kind,
        source: 'detected',
        detectedAt: new Date().toISOString(),
      };
      installations.push({ ...installation, version: await this.probeVersion(installation) });
    }
    return installations;
  }

  selectInstallation(
    operation: EngineOperation,
    installations: EngineInstallation[],
  ): EngineInstallation | null {
    const cliOperations = ['build', 'test', 'run', 'export'];
    if (cliOperations.includes(operation)) {
      return (
        installations.find((installation) => installation.kind === 'cli') ??
        installations.find((installation) => installation.kind === 'editor') ??
        null
      );
    }
    return (
      installations.find((installation) => installation.kind === 'editor') ??
      installations[0] ??
      null
    );
  }

  async probeVersion(installation: EngineInstallation): Promise<string | null> {
    try {
      const output = await probeCommand(
        installation.executable,
        installation.kind === 'cli' ? ['--version'] : ['-version'],
      );
      return (
        output.match(/\d+\.\d+\.\d+[abfp]?\d*/i)?.[0] ?? output.split(/\r?\n/).find(Boolean) ?? null
      );
    } catch {
      return null;
    }
  }

  async proveIdentity(gamePath: string): Promise<EngineProjectIdentity> {
    const relative = 'ProjectSettings/ProjectVersion.txt';
    const content = readUtf8(path.join(gamePath, relative));
    const version = content?.match(/^m_EditorVersion:\s*(\S+)\s*$/m)?.[1] ?? null;
    return {
      proven: version !== null,
      evidence:
        content === null
          ? []
          : [
              {
                kind: 'file',
                ref: `game/${relative}`,
                detail: version ? `m_EditorVersion=${version}` : 'Unity version file is malformed.',
              },
            ],
      projectVersion: version,
    };
  }

  operations(context: EngineCapabilityContext): EngineOperationCapability[] {
    const identity = context.identity.proven;
    const editor = context.installations.find((installation) => installation.kind === 'editor');
    const cli = context.installations.find((installation) => installation.kind === 'cli');
    const headless = (
      operation: EngineOperation,
      available: boolean,
      command: string,
      reason: string | null,
      sideEffects: EngineOperationCapability['sideEffects'] = 'workspace-write',
    ) =>
      cap(
        operation,
        'headless-process',
        available,
        available ? 'cli' : null,
        command,
        sideEffects,
        `Unity ${operation} through the configured CLI or batch-mode Editor.`,
        reason,
      );
    return [
      cap(
        'discover',
        'project-file',
        identity,
        identity ? 'file' : null,
        null,
        'none',
        'ProjectSettings and Assets inventory.',
        identity ? null : 'Unity project identity is not proven.',
      ),
      cap(
        'inspect',
        'project-file',
        identity,
        identity ? 'file' : null,
        null,
        'none',
        'ProjectVersion.txt and scene/script inventory.',
        identity ? null : 'Unity project identity is not proven.',
      ),
      cap(
        'check',
        'headless-process',
        false,
        null,
        null,
        'none',
        'Unity check is not exposed by the baseline CLI adapter.',
        'Check is unavailable for Unity.',
      ),
      headless(
        'import',
        identity && editor !== undefined,
        '<Unity> -batchmode -quit -projectPath <game>',
        identity
          ? 'No Unity Editor installation is available.'
          : 'Unity project identity is not proven.',
        'workspace-write',
      ),
      headless(
        'build',
        identity && (cli !== undefined || editor !== undefined),
        cli
          ? 'unity build --project-path <game>'
          : '<Unity> -batchmode -nographics -quit -projectPath <game> -executeMethod <method>',
        identity
          ? 'No Unity CLI or Editor installation is available.'
          : 'Unity project identity is not proven.',
      ),
      headless(
        'test',
        identity && (cli !== undefined || editor !== undefined),
        cli
          ? 'unity test --project-path <game>'
          : '<Unity> -batchmode -nographics -quit -projectPath <game> -runTests -testPlatform <EditMode|PlayMode>',
        identity
          ? 'No Unity CLI or Editor installation is available.'
          : 'Unity project identity is not proven.',
        'workspace-write',
      ),
      headless(
        'run',
        identity && (cli !== undefined || editor !== undefined),
        cli
          ? 'unity run --project-path <game>'
          : '<Unity> -batchmode -nographics -quit -projectPath <game> -executeMethod <method>',
        identity
          ? 'No Unity CLI or Editor installation is available.'
          : 'Unity project identity is not proven.',
      ),
      headless(
        'export',
        identity && (cli !== undefined || editor !== undefined),
        cli
          ? 'unity build --project-path <game>'
          : '<Unity> -batchmode -nographics -quit -projectPath <game> -executeMethod <method>',
        identity
          ? 'No Unity CLI or Editor installation is available.'
          : 'Unity project identity is not proven.',
      ),
      headless(
        'validate',
        identity && editor !== undefined,
        '<Unity> -batchmode -quit -projectPath <game>',
        identity
          ? 'No Unity Editor installation is available.'
          : 'Unity project identity is not proven.',
        'none',
      ),
      cap(
        'edit-scene',
        'live-editor',
        false,
        null,
        null,
        'workspace-write',
        'Requires a connected live editor bridge.',
        'No connected Unity live editor bridge is configured.',
      ),
      cap(
        'screenshot',
        'live-editor',
        false,
        null,
        null,
        'none',
        'Requires a connected live editor bridge.',
        'No connected Unity live editor bridge is configured.',
      ),
      cap(
        'console',
        'live-editor',
        false,
        null,
        null,
        'destructive',
        'Arbitrary code execution through an Editor console is destructive.',
        'No connected Unity live editor bridge is configured.',
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
      return unavailable(`No Unity installation is available for ${operation}.`);
    if (!context.manifest || !(await this.proveIdentity(context.gamePath)).proven) {
      return unavailable('Unity project identity is unproven.');
    }
    if (operation === 'check') return unavailable('Check is unavailable for Unity.');
    const installation = context.installation;
    const game = context.gamePath;
    let args: string[];
    const sideArtifacts: EngineOperationOutcome['artifacts'] = [];
    if (installation.kind === 'cli') {
      args = cliArguments(operation, game, params);
    } else {
      args = editorArguments(operation, game, params, context.runDirectory);
      if (!args.length) return unavailable('Unity Editor operations require params.method.');
      const logArtifact = context.writeArtifact('log', 'editor.log', '');
      sideArtifacts.push(logArtifact);
      const logPath = path.join(context.runDirectory, 'editor.log');
      args.push('-logFile', logPath);
      if (operation === 'test') {
        const report = context.writeArtifact('report', 'results.xml', '');
        sideArtifacts.push(report);
        args.push('-testResults', path.join(context.runDirectory, 'results.xml'));
      }
    }
    const result = await context.runProcess(installation.executable, args);
    return processOutcome(`Unity ${operation}`, result, sideArtifacts);
  }

  private async inspect(
    operation: 'discover' | 'inspect',
    context: EngineExecutionContext,
  ): Promise<EngineOperationOutcome> {
    const identity = await this.proveIdentity(context.gamePath);
    const entries = listProjectFiles(context.gamePath);
    const report = {
      identity,
      scenes: entries.filter((entry) => entry.endsWith('.unity')),
      scripts: entries.filter((entry) => entry.endsWith('.cs')),
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
          ? `Found ${entries.length} Unity project files.`
          : 'Inspected Unity project settings and assets.',
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

function cliArguments(
  operation: EngineOperation,
  game: string,
  params: Record<string, unknown>,
): string[] {
  const project = ['--project-path', game];
  if (operation === 'build' || operation === 'export') return ['build', ...project];
  if (operation === 'test') return ['test', ...project, '--test-platform', testPlatform(params)];
  if (operation === 'run') return ['run', ...project];
  if (operation === 'import' || operation === 'validate') return ['import', ...project];
  return [];
}

function editorArguments(
  operation: EngineOperation,
  game: string,
  params: Record<string, unknown>,
  runDir: string,
): string[] {
  const base = ['-batchmode', '-nographics', '-quit', '-projectPath', game];
  if (operation === 'import' || operation === 'validate') return base;
  if (operation === 'test')
    return [
      ...base,
      '-runTests',
      '-testPlatform',
      testPlatform(params),
      '-testResults',
      path.join(runDir, 'results.xml'),
    ];
  const method = typeof params.method === 'string' ? params.method.trim() : '';
  if (['build', 'export', 'run'].includes(operation) && method)
    return [...base, '-executeMethod', method];
  return [];
}

function testPlatform(params: Record<string, unknown>): 'EditMode' | 'PlayMode' {
  return params.testPlatform === 'PlayMode' ? 'PlayMode' : 'EditMode';
}

function processOutcome(
  summary: string,
  result: Awaited<ReturnType<EngineExecutionContext['runProcess']>>,
  extraArtifacts: EngineOperationOutcome['artifacts'] = [],
): EngineOperationOutcome {
  return {
    status: result.exitCode === 0 && !result.timedOut && !result.cancelled ? 'succeeded' : 'failed',
    exitCode: result.exitCode,
    command: result.command,
    summary: result.cancelled
      ? `${summary} was cancelled.`
      : result.timedOut
        ? `${summary} timed out.`
        : `${summary} exited with code ${result.exitCode}.`,
    evidence: [
      {
        kind: 'process',
        ref: 'exit-code',
        detail: `Exit code ${result.exitCode}; duration ${result.durationMs}ms.`,
      },
    ],
    artifacts: [...result.artifacts, ...extraArtifacts],
  };
}

function unavailable(reason: string): EngineOperationOutcome {
  return {
    status: 'unavailable',
    exitCode: null,
    command: [],
    summary: reason,
    evidence: [{ kind: 'capability', ref: 'unity', detail: reason }],
    artifacts: [],
  };
}

function listProjectFiles(root: string, current = root): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'Library' || entry.name === 'Temp') continue;
    const target = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) result.push(...listProjectFiles(root, target));
    else result.push(path.relative(root, target).split(path.sep).join('/'));
  }
  return result;
}

function unityHubRoots(environment: NodeJS.ProcessEnv): string[] {
  const home = environment.HOME ?? environment.USERPROFILE ?? os.homedir();
  return [
    path.join(home, 'Unity', 'Hub', 'Editor'),
    'C:\\Program Files\\Unity\\Hub\\Editor',
    'C:\\Program Files (x86)\\Unity\\Hub\\Editor',
  ];
}

function safeDirectoryNames(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function isUnityCli(executable: string): boolean {
  const baseName = path.basename(executable);
  const editorPath = /[/\\]Editor[/\\]/i.test(executable);
  return (
    !editorPath &&
    (baseName === 'unity' ||
      (process.platform === 'win32' && baseName.toLowerCase() === 'unity.exe'))
  );
}
