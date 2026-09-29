import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7, type EngineInstallation, type ProjectManifest } from '@gamecrafter/contracts';
import { runEngineProcess } from './process-runner';
import { UnityConnector } from './unity/unity-connector';
import { UnrealConnector } from './unreal/unreal-connector';
import type { EngineExecutionContext } from './types';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('engine connector adapters', () => {
  it('detects fake Unity CLI and Editor installations and builds Editor batch arguments', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-unity-adapter-'));
    roots.push(root);
    const bin = path.join(root, 'bin');
    mkdirSync(bin);
    const fixtures = path.resolve(__dirname, '__fixtures__');
    const cli = path.join(bin, 'unity');
    const editor = path.join(bin, 'Unity');
    cpSync(path.join(fixtures, 'unity-cli.cjs'), cli);
    cpSync(path.join(fixtures, 'unity-editor.cjs'), editor);
    chmodSync(cli, 0o755);
    chmodSync(editor, 0o755);

    const connector = new UnityConnector();
    const installations = await connector.detectInstallations({ PATH: bin });
    const cliInstallation = installations.find((installation) => installation.kind === 'cli');
    const editorInstallation = installations.find((installation) => installation.kind === 'editor');
    expect(cliInstallation?.version).toBe('1.2.3');
    expect(editorInstallation?.version).toBe('2022.3.12f1');

    const gamePath = path.join(root, 'UnityProject');
    mkdirSync(path.join(gamePath, 'ProjectSettings'), { recursive: true });
    writeFileSync(
      path.join(gamePath, 'ProjectSettings', 'ProjectVersion.txt'),
      'm_EditorVersion: 2022.3.12f1\n',
    );
    const context = executionContext(root, gamePath, editorInstallation!);
    const outcome = await connector.run('build', { method: 'Fixture.Build' }, context);
    const args = JSON.parse(
      readFileSync(path.join(context.runDirectory, 'stdout.log'), 'utf8'),
    ) as string[];
    expect(outcome.status).toBe('succeeded');
    expect(args).toContain('-batchmode');
    expect(args).toContain('-nographics');
    expect(args).toContain('-quit');
    expect(args).toContain(`-projectPath`);
    expect(args).toContain(gamePath);
    expect(args).toContain('-executeMethod');
    expect(args).toContain('Fixture.Build');
    expect(await connector.proveIdentity(gamePath)).toMatchObject({
      proven: true,
      projectVersion: '2022.3.12f1',
    });
    expect(
      connector
        .operations({
          projectId: uuidv7(),
          family: 'unity',
          projectPath: root,
          gamePath,
          manifest: manifest('unity'),
          installation: editorInstallation!,
          installations,
          identity: await connector.proveIdentity(gamePath),
        })
        .find((entry) => entry.operation === 'check'),
    ).toMatchObject({ available: false, reason: 'Check is unavailable for Unity.' });
  });

  it('detects fake Unreal UAT and commandlet installations and constructs BuildCookRun args', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-unreal-adapter-'));
    roots.push(root);
    const engine = path.join(root, 'UE_5.4', 'Engine');
    const editor = path.join(engine, 'Binaries', 'Linux', 'UnrealEditor-Cmd');
    const uat = path.join(engine, 'Build', 'BatchFiles', 'RunUAT.sh');
    mkdirSync(path.dirname(editor), { recursive: true });
    mkdirSync(path.dirname(uat), { recursive: true });
    mkdirSync(path.join(engine, 'Build'), { recursive: true });
    const fixtures = path.resolve(__dirname, '__fixtures__');
    cpSync(path.join(fixtures, 'unreal-editor-cmd.cjs'), editor);
    cpSync(path.join(fixtures, 'unreal-uat.cjs'), uat);
    chmodSync(editor, 0o755);
    chmodSync(uat, 0o755);
    writeFileSync(
      path.join(engine, 'Build', 'Build.version'),
      JSON.stringify({ MajorVersion: 5, MinorVersion: 4, PatchVersion: 3 }),
    );

    const connector = new UnrealConnector();
    const installations = await connector.detectInstallations({ UE_ROOT: path.dirname(engine) });
    const commandlet = installations.find((installation) => installation.kind === 'commandlet');
    const automationTool = installations.find((installation) => installation.kind === 'uat');
    expect(commandlet?.version).toBe('5.4.3');
    expect(automationTool?.version).toBe('5.4.3');

    const gamePath = path.join(root, 'UnrealProject');
    mkdirSync(gamePath);
    writeFileSync(
      path.join(gamePath, 'Smoke.uproject'),
      JSON.stringify({ EngineAssociation: '5.4' }),
    );
    const context = executionContext(root, gamePath, automationTool!);
    const outcome = await connector.run('build', { platform: 'Linux' }, context);
    const args = JSON.parse(
      readFileSync(path.join(context.runDirectory, 'stdout.log'), 'utf8'),
    ) as string[];
    expect(outcome.status).toBe('succeeded');
    expect(args[0]).toBe('BuildCookRun');
    expect(args).toContain(`-project=${path.join(gamePath, 'Smoke.uproject')}`);
    expect(args).toContain('-platform=Linux');
    expect(args).toContain('-clientconfig=Development');
    expect(args).toContain('-archive');
    expect(await connector.proveIdentity(gamePath)).toMatchObject({
      proven: true,
      projectVersion: '5.4',
    });
    expect(
      connector
        .operations({
          projectId: uuidv7(),
          family: 'unreal',
          projectPath: root,
          gamePath,
          manifest: manifest('unreal'),
          installation: commandlet!,
          installations,
          identity: await connector.proveIdentity(gamePath),
        })
        .find((entry) => entry.operation === 'check'),
    ).toMatchObject({
      available: false,
      reason: 'Check is unavailable for Unreal; use DataValidation or an Automation commandlet.',
    });
  });
});

function executionContext(
  projectPath: string,
  gamePath: string,
  installation: EngineInstallation,
): EngineExecutionContext {
  const runId = uuidv7();
  const runDirectory = path.join(projectPath, '.gamecrafter', 'engine-runs', runId);
  mkdirSync(runDirectory, { recursive: true });
  const manifestValue = manifest(installation.family);
  return {
    projectId: manifestValue.projectId,
    family: installation.family,
    projectPath,
    gamePath,
    manifest: manifestValue,
    installation,
    runId,
    runDirectory,
    startedAt: new Date().toISOString(),
    timeoutMs: 10_000,
    signal: new AbortController().signal,
    runProcess: (command, args, cwd = gamePath) =>
      runEngineProcess({
        command,
        args,
        cwd,
        projectPath,
        runDirectory,
        timeoutMs: 10_000,
        signal: new AbortController().signal,
        redactCommand: (executable, commandArgs) => [executable, ...commandArgs],
      }),
    writeArtifact: (kind, fileName, content) => {
      const safeName = path.basename(fileName);
      writeFileSync(path.join(runDirectory, safeName), content);
      return { kind, path: `.gamecrafter/engine-runs/${runId}/${safeName}` };
    },
    redactCommand: (command, args) => [command, ...args],
  };
}

function manifest(family: ProjectManifest['engine']['family']): ProjectManifest {
  return {
    schemaVersion: 1,
    projectId: uuidv7(),
    name: 'Connector test',
    description: '',
    engine: { family },
    genres: [],
    modules: [],
    createdAt: new Date().toISOString(),
    createdByPlatformVersion: '0.1.0',
  };
}
