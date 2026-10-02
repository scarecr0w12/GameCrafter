import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, type ServiceClient } from '@gamecrafter/service-client';
import { resolvePaths, type ServicePaths } from '../paths';
import { PlatformService } from '../service';

const temporaryDirectories: string[] = [];
let service: PlatformService | undefined;
let client: ServiceClient | undefined;

async function startService(paths: ServicePaths): Promise<PlatformService> {
  return PlatformService.start({ paths, platformVersion: '0.1.0' });
}

async function connectService(socketPath: string, paths: ServicePaths): Promise<ServiceClient> {
  const { readFileSync } = await import('node:fs');
  return connect({
    socketPath,
    token: readFileSync(paths.tokenPath, 'utf8').trim(),
    clientName: 'skills-integration',
    clientVersion: '0.1.0',
  });
}

function writeSkill(parent: string, name: string, workTypes: string[], roles: string[]) {
  const directory = path.join(parent, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Instructions for validating Godot project files.\nmetadata:\n  gamecrafter-version: "1.0.0"\n  gamecrafter-engines: godot\n  gamecrafter-genres: rpg\n  gamecrafter-work-types: "${workTypes.join(',')}"\n  gamecrafter-roles: "${roles.join(',')}"\n  gamecrafter-capabilities: fs.read:project\n---\nRead the Project AGENTS.md, preserve docs/ canon, and consult the discussion board.\n`,
  );
  mkdirSync(path.join(directory, 'references'), { recursive: true });
  writeFileSync(path.join(directory, 'references', 'guide.md'), 'Read-only reference.\n');
  return directory;
}

async function waitForTask(taskId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const task = await client!.call('task/get', { projectId: currentProjectId, taskId });
    if (['succeeded', 'failed', 'cancelled'].includes(task.state)) return task;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Task did not finish: ${taskId}`);
}

let currentProjectId: string;

afterEach(async () => {
  client?.close();
  await service?.stop();
  service = undefined;
  client = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('skills and trust integration', () => {
  it('installs, enables, catalogs, activates through a worker, and protects untrusted Project skills', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-skills-integration-'));
    temporaryDirectories.push(root);
    const profileDir = path.join(root, 'profile');
    const projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory, { recursive: true });
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDir });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);

    const project = await client.call('project/create', {
      name: 'Skill Project',
      engine: { family: 'godot' },
      genres: ['rpg'],
      parentDirectory: projectsDirectory,
      folderName: 'skill-project',
    });
    currentProjectId = project.projectId;
    expect(project.trusted).toBe(true);
    await client.call('settings/set', {
      key: 'skills.compatibilityScan.enabled',
      scope: 'platform',
      value: false,
    });

    const source = path.join(root, 'source');
    writeSkill(source, 'engine-guide', ['code', 'noop.tool'], ['engine-engineer']);
    const {
      installed: [installed],
    } = await client.call('skills/install', { source });
    expect(installed).toMatchObject({ name: 'engine-guide', scope: 'platform', version: '1.0.0' });
    expect(
      (await client.call('skills/list', { projectId: project.projectId })).skills.find(
        (skill) => skill.name === 'engine-guide',
      ),
    ).toMatchObject({
      name: 'engine-guide',
      enablement: { enabled: false },
    });

    const enabled = await client.call('skills/enable', {
      projectId: project.projectId,
      name: 'engine-guide',
      enabled: true,
      roles: ['engine-engineer'],
      workTypes: null,
      pin: true,
    });
    expect(enabled).toMatchObject({ enabled: true, pinnedHash: installed.hash });
    const catalog = await client.call('skills/catalog', {
      projectId: project.projectId,
      agentRole: 'engine-engineer',
      workType: 'code',
      taskText: 'validate Godot project files',
    });
    expect(catalog.entries.map((entry) => entry.name)).toContain('engine-guide');
    expect(
      (
        await client.call('skills/catalog', {
          projectId: project.projectId,
          agentRole: 'narrative-designer',
          workType: 'code',
        })
      ).entries,
    ).not.toContainEqual(expect.objectContaining({ name: 'engine-guide' }));

    const task = await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.tool',
      title: 'Activate project skill through the worker broker',
      goal: 'Load the engine guide for this code task.',
      assignee: { role: 'engine-engineer' },
      input: { toolId: 'skills/activate', toolInput: { name: 'engine-guide' } },
      maxAttempts: 1,
    });
    const finishedTask = await waitForTask(task.task.taskId);
    expect(finishedTask.state).toBe('succeeded');
    const activations = await client.call('skills/activations', {
      projectId: project.projectId,
      taskId: task.task.taskId,
    });
    expect(activations.activations).toMatchObject([
      { name: 'engine-guide', version: '1.0.0', taskId: task.task.taskId },
    ]);
    const repeated = await client.call('skills/activate', {
      projectId: project.projectId,
      name: 'engine-guide',
      taskId: task.task.taskId,
      agentId: 'agent-1',
    });
    expect(repeated).toMatchObject({
      alreadyActive: true,
      content: 'Skill "engine-guide" is already loaded in this task.',
    });

    const skillFile = path.join(profileDir, 'skills', 'engine-guide', 'SKILL.md');
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      value: 'full',
      projectId: project.projectId,
    });
    const read = await client.call('tool/call', {
      projectId: project.projectId,
      toolId: 'fs/read-file',
      input: { path: skillFile },
    });
    expect(read.output).toMatchObject({
      content: expect.stringContaining('Project AGENTS.md'),
      encoding: 'utf8',
    });
    await expect(
      client.call('tool/call', {
        projectId: project.projectId,
        toolId: 'fs/write-file',
        input: {
          path: path.join(profileDir, 'skills', 'engine-guide', 'unauthorized.txt'),
          content: 'no',
        },
      }),
    ).rejects.toMatchObject({ code: -32034 });

    const importedPath = path.join(projectsDirectory, 'imported-project');
    mkdirSync(path.join(importedPath, '.agents', 'skills'), { recursive: true });
    writeFileSync(
      path.join(importedPath, 'gamecrafter.project.json'),
      JSON.stringify({
        schemaVersion: 1,
        projectId: '019535d4-2c00-7000-8000-000000000702',
        name: 'Imported Project',
        description: '',
        engine: { family: 'godot' },
        genres: ['rpg'],
        modules: [],
        createdAt: '2026-09-28T00:00:00.000Z',
        createdByPlatformVersion: '0.1.0',
      }),
    );
    writeSkill(
      path.join(importedPath, '.agents', 'skills'),
      'local-guide',
      ['code'],
      ['engine-engineer'],
    );
    const imported = await client.call('project/open', { path: importedPath });
    expect(imported.trusted).toBe(false);
    const untrustedSkills = await client.call('skills/list', { projectId: imported.projectId });
    expect(
      untrustedSkills.skills.find((skill) => skill.name === 'local-guide')?.warnings,
    ).toContain('project_untrusted');
    expect(
      (
        await client.call('skills/catalog', {
          projectId: imported.projectId,
          agentRole: 'engine-engineer',
          workType: 'code',
        })
      ).entries,
    ).not.toContainEqual(expect.objectContaining({ name: 'local-guide' }));
    await expect(
      client.call('skills/activate', { projectId: imported.projectId, name: 'local-guide' }),
    ).rejects.toMatchObject({ code: -32057 });
    expect(
      (await client.call('project/trust', { projectId: imported.projectId, trusted: true }))
        .trusted,
    ).toBe(true);
    expect(
      (
        await client.call('skills/catalog', {
          projectId: imported.projectId,
          agentRole: 'engine-engineer',
          workType: 'code',
        })
      ).entries.map((entry) => entry.name),
    ).toContain('local-guide');

    await client.call('skills/uninstall', { name: 'engine-guide' });
    expect(
      (await client.call('skills/list', { projectId: project.projectId })).skills.some(
        (skill) => skill.name === 'engine-guide' && skill.scope === 'platform',
      ),
    ).toBe(false);
    expect((await client.call('roles/list', {})).roles.map((role) => role.name)).toContain(
      'engine-engineer',
    );
  }, 60_000);
  it('ships searchable guides, enforces Project controls and reads references through RPC and role tools', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-bundled-integration-'));
    temporaryDirectories.push(root);
    const projectsDirectory = path.join(root, 'projects');
    mkdirSync(projectsDirectory);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') });
    service = await startService(paths);
    client = await connectService(service.socketPath, paths);
    const project = await client.call('project/create', {
      name: 'Bundled Skills',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'bundled',
    });
    currentProjectId = project.projectId;
    const entries = (await client.call('skills/list', { projectId: project.projectId })).skills;
    const guide = entries.find((skill) => skill.name === 'asset-pipeline')!;
    expect(guide).toMatchObject({
      source: 'builtin:gamecrafter',
      scope: 'platform',
      enablement: { enabled: true },
    });
    expect(entries.filter((skill) => skill.source === 'builtin:gamecrafter')).toHaveLength(30);
    const names = (
      await client.call('skills/catalog', { projectId: project.projectId })
    ).entries.map((skill) => skill.name);
    expect(names).toContain('godot-scene-audit');
    expect(names).not.toContain('unreal-development');
    expect(names).not.toContain('unity-development');
    await expect(
      client.call('skills/read-resource', {
        projectId: project.projectId,
        name: 'unreal-development',
        resource: 'SKILL.md',
      }),
    ).rejects.toMatchObject({ code: -32050 });
    const read = await client.call('skills/read-resource', {
      projectId: project.projectId,
      name: guide.name,
      resource: 'references/workflows.md',
      maxLines: 3,
    });
    expect(read).toMatchObject({
      schemaVersion: 1,
      name: guide.name,
      startLine: 1,
      endLine: 3,
      truncated: true,
      hash: guide.hash,
    });
    const next = await client.call('skills/read-resource', {
      projectId: project.projectId,
      name: guide.name,
      resource: read.resource,
      startLine: 4,
      maxLines: 3,
    });
    expect(next.startLine).toBe(4);
    await expect(
      client.call('skills/read-resource', {
        projectId: project.projectId,
        name: guide.name,
        resource: '../secret',
      }),
    ).rejects.toMatchObject({ code: -32051 });
    const task = await client.call('task/create', {
      projectId: project.projectId,
      kind: 'noop.tool',
      title: 'Read bundled reference',
      goal: 'Consult an asset handoff guide',
      assignee: { role: 'asset-producer' },
      input: {
        toolId: 'skills/read-resource',
        toolInput: { name: guide.name, resource: read.resource, maxLines: 3 },
      },
      maxAttempts: 1,
    });
    expect((await waitForTask(task.task.taskId)).state).toBe('succeeded');
    await client.call('skills/enable', {
      projectId: project.projectId,
      name: guide.name,
      enabled: false,
    });
    await expect(
      client.call('skills/read-resource', {
        projectId: project.projectId,
        name: guide.name,
        resource: read.resource,
      }),
    ).rejects.toMatchObject({ code: -32050 });
    await client.call('skills/enable', {
      projectId: project.projectId,
      name: guide.name,
      enabled: true,
      pin: true,
    });
    const overrideSource = path.join(root, 'override');
    writeSkill(overrideSource, guide.name, [], []);
    await client.call('skills/install', { source: overrideSource });
    await expect(
      client.call('skills/read-resource', {
        projectId: project.projectId,
        name: guide.name,
        resource: 'SKILL.md',
      }),
    ).rejects.toMatchObject({ code: -32051 });
    await client.call('skills/enable', {
      projectId: project.projectId,
      name: guide.name,
      enabled: true,
      pin: false,
    });
    let duplicates = (
      await client.call('skills/list', { projectId: project.projectId })
    ).skills.filter((skill) => skill.name === guide.name);
    expect(duplicates.find((skill) => !skill.shadowedBy)?.source).not.toBe('builtin:gamecrafter');
    expect(
      duplicates.find((skill) => skill.source === 'builtin:gamecrafter')?.shadowedBy,
    ).toBeTruthy();
    writeSkill(path.join(project.path, '.agents/skills'), guide.name, [], []);
    duplicates = (await client.call('skills/list', { projectId: project.projectId })).skills.filter(
      (skill) => skill.name === guide.name,
    );
    expect(duplicates.find((skill) => !skill.shadowedBy)?.scope).toBe('project');
    await client.call('project/trust', { projectId: project.projectId, trusted: false });
    await expect(
      client.call('skills/read-resource', {
        projectId: project.projectId,
        name: guide.name,
        resource: 'SKILL.md',
      }),
    ).rejects.toMatchObject({ code: -32057 });
    expect(
      await client.call('skills/read-resource', {
        projectId: project.projectId,
        name: 'game-development',
        resource: 'SKILL.md',
        maxLines: 1,
      }),
    ).toMatchObject({ name: 'game-development', endLine: 1 });
  }, 60_000);
});
