import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { connect } from '@gamecrafter/service-client';
import { resolvePaths } from '../paths';
import { PlatformService } from '../service';

const directories: string[] = [];
let service: PlatformService | undefined;
let client: Awaited<ReturnType<typeof connect>> | undefined;

afterEach(async () => {
  client?.close();
  client = undefined;
  await service?.stop();
  service = undefined;
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('board decision synchronization', () => {
  it('binds a decision, commits its canon record, and treats identical retry as a no-op', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-board-sync-'));
    directories.push(root);
    const profileDirectory = path.join(root, 'profile');
    const projectsDirectory = path.join(root, 'projects');
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: profileDirectory }, 'linux');
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'board-sync-test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Board Sync Project',
      engine: { family: 'godot' },
      parentDirectory: projectsDirectory,
      folderName: 'board-sync-project',
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'restricted',
    });
    const thread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Combat escape route',
      kind: 'proposal',
      body: 'The room needs a clearly marked escape route.',
      type: 'proposal',
    });
    const decisionMessage = await client.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'decision',
      body: 'Every combat room must preserve a visible escape route.',
    });
    let resolveSynchronizedNotification: (event: unknown) => void = () => undefined;
    const synchronizedNotification = new Promise<unknown>((resolve) => {
      resolveSynchronizedNotification = resolve;
    });
    client.onNotification('board/decisionChanged', (event) => {
      if (event.projectId === project.projectId && event.decision.syncStatus === 'synchronized') {
        resolveSynchronizedNotification(event);
      }
    });
    const decision = await client.call('board/bind', {
      projectId: project.projectId,
      messageId: decisionMessage.messageId,
      title: 'Combat escape route',
      statement: decisionMessage.body,
      confirmedByUser: true,
    });
    const [synchronized] = await Promise.all([
      waitForDecision(project.projectId, decision.decisionId, 'synchronized'),
      synchronizedNotification,
    ]);
    expect(synchronized).toMatchObject({
      syncStatus: 'synchronized',
      canonRecordPath: expect.stringMatching(
        /^docs\/decisions\/\d{4}-\d{2}-\d{2}-combat-escape-route\.md$/,
      ),
      canonCommit: expect.stringMatching(/^[0-9a-f]{40}$/),
    });
    const recordPath = path.join(project.path, synchronized.canonRecordPath);
    expect(existsSync(recordPath)).toBe(true);
    const record = readFileSync(recordPath, 'utf8');
    expect(record).toContain(`decisionId: ${decision.decisionId}`);
    expect(record).toContain(`threadId: ${thread.thread.threadId}`);
    expect(record).toContain('status: binding');
    expect(record).toContain('board://');
    const commitMessage = execFileSync('git', ['log', '-1', '--format=%s'], {
      cwd: project.path,
      encoding: 'utf8',
    }).trim();
    expect(commitMessage).toBe(`board: bind decision ${decision.decisionId} — ${decision.title}`);
    const decisionDetails = await client.call('board/decision', {
      projectId: project.projectId,
      decisionId: decision.decisionId,
    });
    expect(decisionDetails.proposals[0]).toMatchObject({
      path: synchronized.canonRecordPath,
      appliedAt: expect.any(String),
      commit: synchronized.canonCommit,
    });
    const knowledgeRecord = await client.call('knowledge/record', {
      projectId: project.projectId,
      recordId: `decision.${decision.decisionId}`,
    });
    expect(knowledgeRecord.record).toMatchObject({
      type: 'decision',
      status: 'accepted',
      path: synchronized.canonRecordPath,
    });
    expect(knowledgeRecord.body).toContain(
      'Every combat room must preserve a visible escape route.',
    );

    const decisionSearch = await client.call('knowledge/search', {
      projectId: project.projectId,
      query: 'combat escape route',
      sources: ['decisions'],
      mode: 'lexical',
    });
    expect(decisionSearch.hits[0]?.recordId).toBe(`decision.${decision.decisionId}`);

    const commitCountBeforeRetry = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: project.path,
      encoding: 'utf8',
    }).trim();
    await client.call('board/retrySync', {
      projectId: project.projectId,
      decisionId: decision.decisionId,
    });
    await waitForTask(project.projectId, `retry:${decision.decisionId}`);
    expect(
      execFileSync('git', ['rev-list', '--count', 'HEAD'], {
        cwd: project.path,
        encoding: 'utf8',
      }).trim(),
    ).toBe(commitCountBeforeRetry);

    const supersedingMessage = await client.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'decision',
      body: 'The escape path must remain visible during combat.',
    });
    const superseding = await client.call('board/bind', {
      projectId: project.projectId,
      messageId: supersedingMessage.messageId,
      title: 'Visible escape path',
      statement: supersedingMessage.body,
      supersedes: decision.decisionId,
      confirmedByUser: true,
    });
    const supersededResult = await waitForDecision(
      project.projectId,
      superseding.decisionId,
      'synchronized',
    );
    expect(readFileSync(recordPath, 'utf8')).toContain('status: superseded');
    expect(readFileSync(recordPath, 'utf8')).toContain(`supersededBy: ${superseding.decisionId}`);
    const supersedingRecord = readFileSync(
      path.join(project.path, supersededResult.canonRecordPath),
      'utf8',
    );
    expect(supersedingRecord).toContain(`supersedes: ${decision.decisionId}`);
  }, 60_000);

  it('marks a canon path conflict without overwriting the existing record', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-board-conflict-'));
    directories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'board-conflict-test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Board Conflict Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'board-conflict-project',
    });
    const title = 'Preexisting record collision';
    const relativePath = `docs/decisions/${new Date().toISOString().slice(0, 10)}-preexisting-record-collision.md`;
    const absolutePath = path.join(project.path, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    const existingRecord = `---\ndecisionId: 019535d4-2c00-7000-8000-000000000099\nstatus: binding\n---\n\nKeep this record unchanged.\n`;
    writeFileSync(absolutePath, existingRecord, 'utf8');
    const thread = await client.call('board/createThread', {
      projectId: project.projectId,
      title,
      kind: 'proposal',
      body: 'Create a separate canon decision.',
      type: 'proposal',
    });
    const message = await client.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'decision',
      body: 'A different binding decision.',
    });
    const decision = await client.call('board/bind', {
      projectId: project.projectId,
      messageId: message.messageId,
      title,
      confirmedByUser: true,
    });
    await waitForDecision(project.projectId, decision.decisionId, 'conflict');
    expect(readFileSync(absolutePath, 'utf8')).toBe(existingRecord);
  }, 60_000);

  it('uses Project approvals for canon writes in Ask-always mode', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-board-approval-'));
    directories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'board-approval-test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Board Approval Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'board-approval-project',
    });
    const thread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Approved canon update',
      kind: 'proposal',
      body: 'Approval-gated project canon decision.',
      type: 'proposal',
    });
    const rejectedMessage = await client.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'decision',
      body: 'This decision will be rejected.',
    });
    const rejectedDecision = await client.call('board/bind', {
      projectId: project.projectId,
      messageId: rejectedMessage.messageId,
      title: 'Rejected canon update',
      confirmedByUser: true,
    });
    const rejectedApproval = await waitForPendingWriteApproval(project.projectId);
    await client.call('broker/approve', {
      projectId: project.projectId,
      approvalId: rejectedApproval.approvalId,
      approve: false,
      reason: 'Reject this canon write',
    });
    await waitForDecision(project.projectId, rejectedDecision.decisionId, 'failed');

    const approvedMessage = await client.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'decision',
      body: 'This decision will be approved.',
    });
    const approvedDecision = await client.call('board/bind', {
      projectId: project.projectId,
      messageId: approvedMessage.messageId,
      title: 'Approved canon update',
      confirmedByUser: true,
    });
    const approvedRequest = await waitForPendingWriteApproval(project.projectId);
    await client.call('broker/approve', {
      projectId: project.projectId,
      approvalId: approvedRequest.approvalId,
      approve: true,
      reason: 'Approve canon update',
    });
    const synchronized = await waitForDecision(
      project.projectId,
      approvedDecision.decisionId,
      'synchronized',
    );
    expect(existsSync(path.join(project.path, synchronized.canonRecordPath))).toBe(true);
  }, 60_000);

  it('records a failed restricted write and retries successfully after access is granted', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-board-sync-retry-'));
    directories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'board-sync-retry-test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Board Sync Retry Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'board-sync-retry-project',
    });
    await client.call('settings/set', {
      key: 'access.mode',
      scope: 'project',
      projectId: project.projectId,
      value: 'restricted',
    });
    await client.call('settings/set', {
      key: 'access.restricted.allowedSideEffects',
      scope: 'project',
      projectId: project.projectId,
      value: ['none'],
    });
    const thread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Retry canon write',
      kind: 'proposal',
      body: 'Retry this canon change after permissions are granted.',
      type: 'proposal',
    });
    const message = await client.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'decision',
      body: 'This write will first be denied.',
    });
    const decision = await client.call('board/bind', {
      projectId: project.projectId,
      messageId: message.messageId,
      confirmedByUser: true,
    });
    await waitForDecision(project.projectId, decision.decisionId, 'failed');
    const failed = await client.call('board/decision', {
      projectId: project.projectId,
      decisionId: decision.decisionId,
    });
    expect(failed.decision.syncAttempts).toBe(1);
    await client.call('settings/set', {
      key: 'access.restricted.allowedSideEffects',
      scope: 'project',
      projectId: project.projectId,
      value: ['none', 'workspace-write'],
    });
    await client.call('board/retrySync', {
      projectId: project.projectId,
      decisionId: decision.decisionId,
    });
    await waitForTask(project.projectId, `retry:${decision.decisionId}`);
    const synchronized = await waitForDecision(
      project.projectId,
      decision.decisionId,
      'synchronized',
    );
    expect(existsSync(path.join(project.path, synchronized.canonRecordPath))).toBe(true);
  }, 60_000);

  it('suppresses automatic maintenance when disabled and deduplicates an active manual sync', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gc-board-disabled-'));
    directories.push(root);
    const paths = resolvePaths({ GAMECRAFTER_PROFILE_DIR: path.join(root, 'profile') }, 'linux');
    service = await PlatformService.start({ paths, platformVersion: '0.1.0' });
    client = await connect({
      socketPath: service.socketPath,
      token: readFileSync(paths.tokenPath, 'utf8').trim(),
      clientName: 'board-disabled-test',
      clientVersion: '0.1.0',
    });
    const project = await client.call('project/create', {
      name: 'Board Disabled Project',
      engine: { family: 'godot' },
      parentDirectory: path.join(root, 'projects'),
      folderName: 'board-disabled-project',
    });
    await client.call('settings/set', {
      key: 'board.maintenanceEnabled',
      scope: 'project',
      projectId: project.projectId,
      value: false,
    });
    const thread = await client.call('board/createThread', {
      projectId: project.projectId,
      title: 'Manual sync only',
      kind: 'proposal',
      body: 'This requires an explicit manual sync.',
      type: 'proposal',
    });
    const message = await client.call('board/post', {
      projectId: project.projectId,
      threadId: thread.thread.threadId,
      type: 'decision',
      body: 'Preserve the manual sync boundary.',
    });
    await client.call('board/bind', {
      projectId: project.projectId,
      messageId: message.messageId,
      confirmedByUser: true,
    });
    expect(
      (await client.call('task/list', { projectId: project.projectId, limit: 500 })).tasks.filter(
        (task) => task.kind.startsWith('board-maintenance.'),
      ),
    ).toHaveLength(0);

    const firstRun = await client.call('board/maintenance/run', {
      projectId: project.projectId,
      mode: 'sync',
    });
    const duplicateRun = await client.call('board/maintenance/run', {
      projectId: project.projectId,
      mode: 'sync',
    });
    expect(duplicateRun.taskId).toBe(firstRun.taskId);
    const approval = await waitForPendingWriteApproval(project.projectId);
    await client.call('broker/approve', {
      projectId: project.projectId,
      approvalId: approval.approvalId,
      approve: false,
      reason: 'Keep canon changes disabled',
    });
    await waitForTaskState(project.projectId, firstRun.taskId, 'failed');
  }, 60_000);
});

async function waitForDecision(projectId: string, decisionId: string, status: string) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const result = await client!.call('board/decision', { projectId, decisionId });
    if (result.decision.syncStatus === status) return result.decision;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Board decision did not reach ${status}: ${decisionId}`);
}

async function waitForPendingWriteApproval(projectId: string) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const { approvals } = await client!.call('broker/approvals', {
      projectId,
      pendingOnly: true,
    });
    const approval = approvals.find((item) => item.toolId === 'fs/write-file');
    if (approval) return approval;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Canon write approval was not requested');
}

async function waitForTaskState(projectId: string, taskId: string, state: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const task = await client!.call('task/get', { projectId, taskId });
    if (task.state === state) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Task ${taskId} did not reach ${state}`);
}

async function waitForTask(projectId: string, goalFragment: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const { tasks } = await client!.call('task/list', { projectId, limit: 500 });
    const task = tasks.find((item) => item.goal.includes(goalFragment));
    if (task?.state === 'succeeded') return;
    if (task?.state === 'failed')
      throw new Error(`Board maintenance task failed: ${JSON.stringify(task.error)}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Board maintenance task did not finish: ${goalFragment}`);
}
