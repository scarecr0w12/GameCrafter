import { describe, expect, it } from 'vitest';
import { DCC_HOST_OS, DCC_SUPPORT_MATRIX, DCC_TOOLS } from './support-matrix';
import {
  DccCapabilityReportSchema,
  DccInstallationSchema,
  DccOperationCapabilitySchema,
  DccRunSchema,
  DccToolSchema,
} from './schema';
import { compile, RpcErrorCode } from '..';
import { RpcMethods } from '../rpc/protocol';

const validateTool = compile(DccToolSchema);
const validateInstallation = compile(DccInstallationSchema);
const validateOperation = compile(DccOperationCapabilitySchema);
const validateReport = compile(DccCapabilityReportSchema);
const validateRun = compile(DccRunSchema);

describe('DCC contracts', () => {
  it('round-trips a WSL installation, capability report, operation, and run', () => {
    const tool = 'blender';
    const installation = {
      schemaVersion: 1,
      installationId: '019535d4-2c00-7000-8000-000000000001',
      tool,
      executable: '/mnt/d/Blender/blender.exe',
      kind: 'gui',
      version: '5.2.2',
      source: 'detected',
      hostOs: 'linux',
      viaWslInterop: true,
      detectedAt: '2026-09-29T12:00:00.000Z',
    };
    const operation = {
      operation: 'run-script',
      layer: 'headless',
      available: true,
      reason: null,
      sideEffects: 'destructive',
      requiresLiveBridge: false,
    };
    const report = {
      schemaVersion: 1,
      projectId: '019535d4-2c00-7000-8000-000000000002',
      tool,
      generatedAt: '2026-09-29T12:00:00.000Z',
      installation,
      layers: {
        headless: {
          status: 'ready',
          detail: 'Blender 5.2.2 responds to a background version probe.',
          checkedAt: '2026-09-29T12:00:00.000Z',
        },
        'live-bridge': {
          status: 'unverified',
          detail: 'No live bridge is bound.',
          checkedAt: '2026-09-29T12:00:00.000Z',
          connectionId: null,
          mcpRevision: null,
        },
      },
      operations: [operation],
      osSupport: DCC_SUPPORT_MATRIX.find((entry) => entry.tool === tool && entry.os === 'linux'),
    };
    const run = {
      schemaVersion: 1,
      runId: '019535d4-2c00-7000-8000-000000000003',
      projectId: report.projectId,
      tool,
      operation: 'discover',
      layer: 'headless',
      status: 'succeeded',
      startedAt: '2026-09-29T12:00:00.000Z',
      finishedAt: '2026-09-29T12:00:01.000Z',
      exitCode: 0,
      command: ['/mnt/d/Blender/blender.exe', '--background', '--version'],
      artifacts: [
        {
          kind: 'log',
          path: '.gamecrafter/dcc-runs/019535d4-2c00-7000-8000-000000000003/stdout.log',
        },
      ],
      evidence: [{ kind: 'process', ref: 'blender', detail: 'Version discovered.' }],
      summary: 'Blender 5.2.2 discovered.',
      taskId: null,
    };

    expect(validateTool.assert(tool)).toBe(tool);
    expect(validateInstallation.assert(installation)).toEqual(installation);
    expect(validateOperation.assert(operation)).toEqual(operation);
    expect(validateReport.assert(report)).toEqual(report);
    expect(validateRun.assert(run)).toEqual(run);
  });

  it('contains exactly one support record for every DCC tool and host OS', () => {
    expect(DCC_SUPPORT_MATRIX).toHaveLength(DCC_TOOLS.length * DCC_HOST_OS.length);
    for (const tool of DCC_TOOLS) {
      for (const os of DCC_HOST_OS) {
        expect(
          DCC_SUPPORT_MATRIX.filter((entry) => entry.tool === tool && entry.os === os),
        ).toHaveLength(1);
      }
    }
  });

  it('labels Blender script execution destructive in its capability contract', () => {
    expect(
      validateOperation.assert({
        operation: 'run-script',
        layer: 'headless',
        available: true,
        reason: null,
        sideEffects: 'destructive',
        requiresLiveBridge: false,
      }).sideEffects,
    ).toBe('destructive');
  });

  it('keeps DCC RPC and error codes unique', () => {
    expect(RpcMethods).toHaveProperty('dcc/installations');
    expect(RpcMethods).toHaveProperty('dcc/setLiveBridge');
    const codes = Object.values(RpcErrorCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(RpcErrorCode).toMatchObject({
      DccInstallationNotFound: expect.any(Number),
      DccToolUnsupportedOnHost: expect.any(Number),
      DccOperationUnavailable: expect.any(Number),
      DccRunNotFound: expect.any(Number),
      DccScriptRejected: expect.any(Number),
    });
  });
});
