import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
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

const executableNames = ['godot', 'godot4'];

export class GodotConnector implements EngineConnector {
  readonly family = 'godot' as const;

  async detectInstallations(environment: NodeJS.ProcessEnv): Promise<EngineInstallation[]> {
    const candidates = executableCandidates(
      executableNames,
      environment,
      ['GODOT_PATH', 'GODOT4_PATH'],
      ['/usr/local/bin/godot', '/usr/bin/godot', '/usr/local/bin/godot4', '/usr/bin/godot4'],
    );
    return Promise.all(candidates.map((executable) => this.createInstallation(executable)));
  }

  async probeVersion(installation: EngineInstallation): Promise<string | null> {
    try {
      const output = await probeCommand(installation.executable, ['--headless', '--version']);
      return output.match(/\d+\.\d+(?:\.\d+)?[^\r\n]*/)?.[0]?.trim() ?? null;
    } catch {
      return null;
    }
  }

  selectInstallation(
    _operation: EngineOperation,
    installations: EngineInstallation[],
  ): EngineInstallation | null {
    return installations.find((installation) => installation.kind === 'cli') ?? null;
  }

  async proveIdentity(gamePath: string): Promise<EngineProjectIdentity> {
    const relative = 'project.godot';
    const content = readUtf8(path.join(gamePath, relative));
    if (content === null) {
      return {
        proven: false,
        evidence: [],
        projectVersion: null,
      };
    }
    const configVersion = content.match(/^config_version\s*=\s*(\d+)\s*$/m)?.[1] ?? null;
    const projectName = content.match(/^config\/name\s*=\s*"([^"]+)"\s*$/m)?.[1] ?? null;
    const features = content.match(
      /^config\/features\s*=\s*PackedStringArray\(([^)]*)\)\s*$/m,
    )?.[1];
    const version = features?.match(/"(\d+\.\d+(?:\.\d+)?)"/)?.[1] ?? null;
    const proven = configVersion !== null && projectName !== null && version !== null;
    return {
      proven,
      evidence: [
        {
          kind: 'file',
          ref: 'game/project.godot',
          detail: proven
            ? `Parsed config_version=${configVersion}, config/name=${projectName}, config/features version=${version}.`
            : 'project.godot exists but is missing a valid config_version, config/name, or engine feature version.',
        },
      ],
      projectVersion: version,
    };
  }

  operations(context: EngineCapabilityContext): EngineOperationCapability[] {
    const fileReady = context.identity.proven;
    const hasInstallation = context.installation !== null;
    const exportPreset = existsSync(path.join(context.gamePath, 'export_presets.cfg'));
    const headless = (
      operation: EngineOperation,
      available: boolean,
      reason: string | null,
      command: string | null,
      sideEffects: EngineOperationCapability['sideEffects'] = 'none',
    ) =>
      capability(
        operation,
        'headless-process',
        available,
        available ? 'cli' : null,
        command,
        sideEffects,
        available ? 'Godot headless operation.' : (reason ?? 'Project identity is not proven.'),
        available ? null : reason,
      );
    return [
      capability(
        'discover',
        'project-file',
        fileReady,
        fileReady ? 'file' : null,
        null,
        'none',
        'Project manifest and scenes/scripts.',
        fileReady ? null : 'No valid project.godot identity was found.',
      ),
      capability(
        'inspect',
        'project-file',
        fileReady,
        fileReady ? 'file' : null,
        null,
        'none',
        'Parsed project.godot and listed scenes/scripts.',
        fileReady ? null : 'No valid project.godot identity was found.',
      ),
      headless(
        'check',
        hasInstallation && fileReady,
        !fileReady ? 'Project identity is not proven.' : 'No Godot executable is available.',
        `godot --headless --path <game> --check-only -s <script>`,
      ),
      headless(
        'import',
        hasInstallation && fileReady,
        !fileReady ? 'Project identity is not proven.' : 'No Godot executable is available.',
        'godot --headless --path <game> --import',
        'workspace-write',
      ),
      headless(
        'test',
        hasInstallation && fileReady,
        !fileReady ? 'Project identity is not proven.' : 'No Godot executable is available.',
        'godot --headless --path <game> --script <test-script>',
      ),
      headless(
        'run',
        hasInstallation && fileReady,
        !fileReady ? 'Project identity is not proven.' : 'No Godot executable is available.',
        'godot --headless --path <game> --quit-after <frames>',
        'workspace-write',
      ),
      headless(
        'export',
        hasInstallation && fileReady && exportPreset,
        !fileReady
          ? 'Project identity is not proven.'
          : !hasInstallation
            ? 'No Godot executable is available.'
            : 'No export_presets.cfg.',
        'godot --headless --path <game> --export-release <preset> <output>',
        'workspace-write',
      ),
      headless(
        'validate',
        hasInstallation && fileReady,
        !fileReady ? 'Project identity is not proven.' : 'No Godot executable is available.',
        'godot --headless --path <game> --check-only -s <script> && --import',
        'workspace-write',
      ),
      headless('build', false, 'Godot build output is produced through an export preset.', null),
      capability(
        'edit-scene',
        'live-editor',
        false,
        null,
        null,
        'workspace-write',
        'Requires a connected live editor bridge.',
        'No connected live editor operation is configured.',
      ),
      capability(
        'screenshot',
        'live-editor',
        false,
        null,
        null,
        'none',
        'Requires a connected live editor bridge.',
        'No connected live editor operation is configured.',
      ),
      capability(
        'console',
        'live-editor',
        false,
        null,
        null,
        'destructive',
        'Requires a connected live editor bridge.',
        'No connected live editor operation is configured.',
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
      return unavailable(context, `No Godot executable is available for ${operation}.`);
    if (!context.manifest || !existsSync(path.join(context.gamePath, 'project.godot'))) {
      return unavailable(context, 'The Godot project identity file is missing.');
    }
    if (operation === 'check' || operation === 'test') {
      const scripts = selectedScripts(context.gamePath, params.path);
      if (scripts.length === 0) {
        return unavailable(context, 'No GDScript files were found to check.');
      }
      const outcomes = [];
      for (const script of scripts) {
        outcomes.push(
          await context.runProcess(context.installation.executable, [
            '--headless',
            '--path',
            context.gamePath,
            '--check-only',
            '-s',
            script,
          ]),
        );
        if (outcomes.at(-1)?.exitCode !== 0) break;
      }
      const last = outcomes.at(-1)!;
      const allSucceeded = outcomes.every(
        (result) => result.exitCode === 0 && !result.timedOut && !result.cancelled,
      );
      return {
        status: allSucceeded ? 'succeeded' : 'failed',
        exitCode: allSucceeded ? 0 : (last.exitCode ?? 1),
        command: last.command,
        summary: allSucceeded
          ? `Godot parsed ${outcomes.length} GDScript file(s).`
          : `Godot script check failed${last.timedOut ? ' due to timeout' : ''}.`,
        evidence: [
          { kind: 'process', ref: 'godot-check', detail: `Checked ${outcomes.length} script(s).` },
        ],
        artifacts: outcomes.flatMap((result) => result.artifacts),
      };
    }
    if (operation === 'import') {
      const result = await context.runProcess(context.installation.executable, [
        '--headless',
        '--path',
        context.gamePath,
        '--import',
      ]);
      return processOutcome('Godot import', result);
    }
    if (operation === 'validate') {
      const checked = await this.run('check', params, context);
      if (checked.status !== 'succeeded') return checked;
      const imported = await context.runProcess(context.installation.executable, [
        '--headless',
        '--path',
        context.gamePath,
        '--import',
      ]);
      return {
        ...processOutcome('Godot validation import', imported),
        command: [...checked.command, '&&', ...imported.command],
        evidence: [
          ...checked.evidence,
          { kind: 'process', ref: 'godot-import', detail: 'Godot import completed.' },
        ],
        artifacts: [...checked.artifacts, ...imported.artifacts],
      };
    }
    if (operation === 'run') {
      const frames = positiveInteger(params.quitAfter, 1);
      const args = ['--headless', '--path', context.gamePath, '--quit-after', String(frames)];
      const scene = typeof params.scene === 'string' ? params.scene.trim() : '';
      if (scene) args.push(scene.startsWith('res://') ? scene : `res://${scene}`);
      const result = await context.runProcess(context.installation.executable, args);
      return processOutcome('Godot headless run', result);
    }
    if (operation === 'export') {
      if (!existsSync(path.join(context.gamePath, 'export_presets.cfg'))) {
        return unavailable(context, 'No export_presets.cfg.');
      }
      const preset = typeof params.preset === 'string' ? params.preset.trim() : '';
      if (!preset) return unavailable(context, 'An export preset name is required.');
      const release = params.release !== false;
      const outputName = safeOutputName(
        typeof params.output === 'string' ? params.output : `${preset}.zip`,
      );
      const outputPath = path.join(context.runDirectory, outputName);
      const result = await context.runProcess(context.installation.executable, [
        '--headless',
        '--path',
        context.gamePath,
        release ? '--export-release' : '--export-debug',
        preset,
        outputPath,
      ]);
      const artifacts = [...result.artifacts];
      if (result.exitCode === 0 && existsSync(outputPath)) {
        artifacts.push(context.writeArtifact('export', outputName, readFileSync(outputPath)));
      }
      return { ...processOutcome('Godot export', result), artifacts };
    }
    return unavailable(
      context,
      `Godot does not support the ${operation} operation without a live editor bridge.`,
    );
  }

  private async createInstallation(executable: string): Promise<EngineInstallation> {
    const installation: EngineInstallation = {
      installationId: uuidv7(),
      family: this.family,
      version: null,
      executable,
      kind: 'cli',
      source: 'detected',
      detectedAt: new Date().toISOString(),
    };
    return { ...installation, version: await this.probeVersion(installation) };
  }

  private async inspect(
    operation: 'discover' | 'inspect',
    context: EngineExecutionContext,
  ): Promise<EngineOperationOutcome> {
    const identity = await this.proveIdentity(context.gamePath);
    const files = listProjectFiles(context.gamePath);
    const report = {
      identity,
      scenes: files.filter((file) => file.endsWith('.tscn')),
      scripts: files.filter((file) => file.endsWith('.gd')),
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
      summary: identity.proven
        ? `Inspected Godot project ${identity.projectVersion ?? ''}.`
        : 'Godot project identity is unproven.',
      evidence: identity.evidence,
      artifacts: [artifact],
    };
  }
}

function capability(
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

function processOutcome(
  summary: string,
  result: Awaited<ReturnType<EngineExecutionContext['runProcess']>>,
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
    artifacts: result.artifacts,
  };
}

function unavailable(context: EngineExecutionContext, reason: string): EngineOperationOutcome {
  return {
    status: 'unavailable',
    exitCode: null,
    command: [],
    summary: reason,
    evidence: [{ kind: 'capability', ref: 'godot', detail: reason }],
    artifacts: [],
  };
}

function selectedScripts(gamePath: string, requested: unknown): string[] {
  if (typeof requested === 'string' && requested.trim()) {
    const candidate = path.resolve(gamePath, requested);
    if (!isWithin(gamePath, candidate) || !existsSync(candidate) || !candidate.endsWith('.gd')) {
      throw new RpcError(
        `GDScript path is outside the Project or missing: ${requested}`,
        RpcErrorCode.PathOutsideProject,
      );
    }
    return [candidate];
  }
  return listProjectFiles(gamePath).filter((file) => file.endsWith('.gd'));
}

function listProjectFiles(root: string, current = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.godot') continue;
    const target = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...listProjectFiles(root, target));
    else files.push(path.relative(root, target).split(path.sep).join('/'));
  }
  return files.sort();
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? Math.min(value, 100_000)
    : fallback;
}

function safeOutputName(value: string): string {
  const name = path.basename(value);
  return name.length > 0 && name !== '.' && name !== '..' ? name : 'export.zip';
}
