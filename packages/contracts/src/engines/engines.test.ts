import { describe, expect, it } from 'vitest';
import { RpcErrorCode, RpcMethods, RpcNotifications, uuidv7 } from '../index';
import { compile } from '../validation';
import {
  EngineCapabilityReportSchema,
  EngineInstallationSchema,
  EngineOperationRunSchema,
} from './schema';

const validateInstallation = compile(EngineInstallationSchema);
const validateReport = compile(EngineCapabilityReportSchema);
const validateRun = compile(EngineOperationRunSchema);

const report = {
  schemaVersion: 1,
  projectId: uuidv7(),
  family: 'godot',
  generatedAt: '2026-09-29T12:00:00.000Z',
  projectIdentity: {
    proven: true,
    evidence: [{ kind: 'file', ref: 'game/project.godot', detail: 'config/name=Smoke' }],
    projectVersion: '4.7',
  },
  layers: {
    'project-file': {
      status: 'ready',
      detail: 'Project manifest parsed',
      checkedAt: '2026-09-29T12:00:00.000Z',
    },
    'headless-process': {
      status: 'ready',
      detail: 'Godot 4.7.2 detected',
      checkedAt: '2026-09-29T12:00:00.000Z',
    },
    'live-editor': {
      status: 'unverified',
      detail: 'No live editor bridge is bound',
      checkedAt: '2026-09-29T12:00:00.000Z',
    },
  },
  engineVersion: { detected: '4.7.2.stable.official', preferred: '4.7', matches: true },
  operations: [
    {
      operation: 'check',
      executionMode: 'headless-process',
      available: true,
      via: 'cli',
      command: 'godot --headless --path <game> --check-only',
      sideEffects: 'none',
      evidence: 'GDScript parser result and captured process output',
      reason: null,
    },
  ],
  liveBridge: null,
};

const run = {
  runId: uuidv7(),
  projectId: report.projectId,
  family: 'godot',
  operation: 'check',
  executionMode: 'headless-process',
  status: 'succeeded',
  startedAt: '2026-09-29T12:00:00.000Z',
  finishedAt: '2026-09-29T12:00:01.000Z',
  exitCode: 0,
  command: ['godot', '--headless', '--path', '<game>', '--check-only'],
  artifacts: [{ kind: 'log', path: `.gamecrafter/engine-runs/${uuidv7()}/stdout.log` }],
  evidence: [{ kind: 'process', ref: 'exit-code', detail: 'Godot exited successfully' }],
  summary: 'Project scripts passed parser checks.',
  taskId: null,
};

describe('engine contracts', () => {
  it('validates installation, capability report, and operation run records', () => {
    expect(
      validateInstallation.check({
        installationId: uuidv7(),
        family: 'godot',
        version: '4.7.2.stable.official',
        executable: '/usr/local/bin/godot',
        kind: 'cli',
        source: 'detected',
        detectedAt: '2026-09-29T12:00:00.000Z',
      }),
    ).toBe(true);
    expect(validateReport.check(report)).toBe(true);
    expect(validateRun.check(run)).toBe(true);
    expect(validateRun.check({ ...run, status: 'unknown' })).toBe(false);
  });

  it('declares the engine RPC methods, notifications, and errors', () => {
    expect(RpcMethods['engine/installations']).toBeDefined();
    expect(RpcMethods['engine/capabilities']).toBeDefined();
    expect(RpcMethods['engine/run']).toBeDefined();
    expect(RpcMethods['engine/setLiveBridge']).toBeDefined();
    expect(RpcNotifications['engine/capabilitiesChanged']).toBeDefined();
    expect(RpcNotifications['engine/runChanged']).toBeDefined();
    expect(RpcErrorCode.EngineInstallationNotFound).toBe(-32090);
    expect(RpcErrorCode.EngineOperationUnavailable).toBe(-32091);
    expect(RpcErrorCode.EngineRunFailed).toBe(-32092);
    expect(RpcErrorCode.EngineProjectIdentityUnproven).toBe(-32093);
    expect(RpcErrorCode.EngineFamilyMismatch).toBe(-32094);
  });
});
