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
  it('does not quit Unity tests early or accept a zero exit without test assertions', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-unity-tests-'));
    roots.push(root);
    const gamePath = path.join(root, 'game');
    mkdirSync(path.join(gamePath, 'ProjectSettings'), { recursive: true });
    writeFileSync(
      path.join(gamePath, 'ProjectSettings', 'ProjectVersion.txt'),
      'm_EditorVersion: 6000.6.0f1\n',
    );
    const installation: EngineInstallation = {
      installationId: uuidv7(),
      family: 'unity',
      version: '6000.6.0f1',
      executable: process.execPath,
      kind: 'editor',
      source: 'manual',
      detectedAt: new Date().toISOString(),
    };
    const connector = new UnityConnector();
    const context = executionContext(root, gamePath, installation);
    const capabilities = connector.operations({
      projectId: context.projectId,
      family: context.family,
      projectPath: root,
      gamePath,
      manifest: context.manifest,
      installation,
      installations: [installation],
      identity: await connector.proveIdentity(gamePath),
    });
    expect(capabilities.find((entry) => entry.operation === 'test')).toMatchObject({
      available: true,
      reason: null,
    });
    const commands: string[][] = [];
    context.runProcess = async (command, args) => {
      commands.push(args);
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 1,
        timedOut: false,
        cancelled: false,
        command: [command, ...args],
        artifacts: [],
      };
    };
    expect(
      (await connector.run('test', { testPlatform: 'PlayMode', testFilter: 'Acceptance' }, context))
        .status,
    ).toBe('failed');
    expect(commands[0]).not.toContain('-quit');
    expect(commands[0]!.filter((argument) => argument === '-testResults')).toHaveLength(1);
    expect(commands[0]).toContain('-testFilter');
    expect(commands[0]).toContain('Acceptance');
    const cli = { ...installation, kind: 'cli' as const, source: 'detected' as const };
    expect(connector.selectInstallation('test', [cli, installation])).toBe(installation);
    context.runProcess = async (command, args) => {
      writeFileSync(
        path.join(context.runDirectory, 'results.xml'),
        '<test-run result="Passed" total="1" passed="1" failed="0"><test-case result="Passed" /></test-run>',
      );
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 1,
        timedOut: false,
        cancelled: false,
        command: [command, ...args],
        artifacts: [],
      };
    };
    expect((await connector.run('test', {}, context)).status).toBe('succeeded');
    context.installation = cli;
    expect(
      (await connector.run('test', { testPlatform: 'PlayMode', testFilter: 'Acceptance' }, context))
        .status,
    ).toBe('succeeded');
    const cliOutcome = await connector.run('build', { method: 'Acceptance.Build' }, context);
    expect(cliOutcome.command).toContain('--execute-method');
    expect(cliOutcome.command).toContain('Acceptance.Build');
    expect(cliOutcome.command).not.toContain('--project-path');
    const cliTest = await connector.run('test', { testPlatform: 'PlayMode' }, context);
    expect(cliTest.command).toContain('--mode');
    expect(cliTest.command).toContain('--output');
  });

  it('runs Unreal editor automation and rejects empty reports and injected filter commands', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-unreal-tests-'));
    roots.push(root);
    const gamePath = path.join(root, 'game');
    mkdirSync(gamePath);
    writeFileSync(
      path.join(gamePath, 'Acceptance.uproject'),
      JSON.stringify({ EngineAssociation: '5.8' }),
    );
    const installation: EngineInstallation = {
      installationId: uuidv7(),
      family: 'unreal',
      version: '5.8.3',
      executable: process.execPath,
      kind: 'commandlet',
      source: 'manual',
      detectedAt: new Date().toISOString(),
    };
    const connector = new UnrealConnector();
    const context = executionContext(root, gamePath, installation);
    const capabilities = connector.operations({
      projectId: context.projectId,
      family: context.family,
      projectPath: root,
      gamePath,
      manifest: context.manifest,
      installation,
      installations: [installation],
      identity: await connector.proveIdentity(gamePath),
    });
    expect(capabilities.find((entry) => entry.operation === 'test')).toMatchObject({
      available: true,
      reason: null,
    });
    const commands: string[][] = [];
    context.runProcess = async (command, args) => {
      commands.push(args);
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 1,
        timedOut: false,
        cancelled: false,
        command: [command, ...args],
        artifacts: [],
      };
    };
    expect((await connector.run('test', { filter: 'Acceptance' }, context)).status).toBe('failed');
    expect(commands[0]).not.toContain('-run=Automation');
    expect(commands[0]).toContain('-TestExit=Automation Test Queue Empty');
    expect(commands[0]).toContain('-unattended');
    expect(commands[0]).toContain(`-ReportExportPath=${context.runDirectory}`);
    expect((await connector.run('test', { filter: 'Acceptance;Quit' }, context)).status).toBe(
      'unavailable',
    );
    expect(commands).toHaveLength(1);
    context.runProcess = async (command, args) => {
      writeFileSync(
        path.join(context.runDirectory, 'index.json'),
        JSON.stringify({
          succeeded: 1,
          succeededWithWarnings: 0,
          failed: 0,
          notRun: 0,
          inProcess: 0,
          tests: [{ state: 'Success' }],
        }),
      );
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 1,
        timedOut: false,
        cancelled: false,
        command: [command, ...args],
        artifacts: [],
      };
    };
    const result = await connector.run('test', {}, context);
    expect(result.status).toBe('succeeded');
    expect(result.artifacts.some((artifact) => artifact.path.endsWith('/index.json'))).toBe(true);
  });

  it('detects fake Unity CLI and Editor installations and builds Editor batch arguments', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-unity-adapter-'));
    roots.push(root);
    const bin = path.join(root, 'bin');
    mkdirSync(bin);
    const fixtures = path.resolve(__dirname, '__fixtures__');
    const cli = path.join(bin, 'unity');
    const editor = path.join(bin, 'Editor', process.platform === 'win32' ? 'Unity.exe' : 'Unity');
    mkdirSync(path.dirname(editor));
    cpSync(path.join(fixtures, 'unity-cli.cjs'), cli);
    cpSync(path.join(fixtures, 'unity-editor.cjs'), editor);
    chmodSync(cli, 0o755);
    chmodSync(editor, 0o755);

    const connector = new UnityConnector();
    const installations = await connector.detectInstallations({ PATH: bin, UNITY_PATH: editor });
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
    const editor = path.join(
      engine,
      'Binaries',
      process.platform === 'win32' ? 'Win64' : 'Linux',
      process.platform === 'win32' ? 'UnrealEditor-Cmd.exe' : 'UnrealEditor-Cmd',
    );
    const uat = path.join(
      engine,
      'Build',
      'BatchFiles',
      process.platform === 'win32' ? 'RunUAT.bat' : 'RunUAT.sh',
    );
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
    expect(args).toContain('-ubtargs=-NoHotReloadFromIDE');
    expect(args).toContain(`-project=${path.join(gamePath, 'Smoke.uproject')}`);
    expect(args).toContain('-platform=Linux');
    expect(args).toContain('-clientconfig=Development');
    expect(args).toContain('-archive');
    expect(outcome.artifacts).toContainEqual({
      kind: 'build',
      path: path
        .relative(root, path.join(context.runDirectory, 'archive'))
        .split(path.sep)
        .join('/'),
    });
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
