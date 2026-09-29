import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  RpcError,
  RpcErrorCode,
  type DccOperation,
  type EngineRunArtifact,
} from '@gamecrafter/contracts';
import { projectRelativePath } from '../../assets/path-utils';
import { extractVersion } from './common';
import { BaseDccAdapter } from './base';
import type { DccExecutionContext, DccOperationOutcome } from '../types';

export interface ScriptArtifactOutput {
  filePath: string;
  kind: EngineRunArtifact['kind'];
}

export interface PreparedDccScript {
  scriptName: string;
  script: string;
  command: string;
  args: string[];
  summary: string;
  outputs?: ScriptArtifactOutput[];
}

export abstract class ScriptedDccAdapter extends BaseDccAdapter {
  protected abstract prepareScript(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<PreparedDccScript>;

  async run(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome> {
    if (operation === 'discover') {
      const result = await context.runProcess(
        context.installation.executable,
        this.versionArgs(context.installation),
        context.projectPath,
      );
      const success = result.exitCode === 0 && !result.timedOut && !result.cancelled;
      const output = `${result.stdout}\n${result.stderr}`.trim();
      const version = extractVersion(output);
      return {
        status: success ? 'succeeded' : 'failed',
        exitCode: result.exitCode,
        command: result.command,
        summary: success
          ? `${this.tool} ${version ?? 'installation'} discovered.`
          : `${this.tool} version probe failed.`,
        evidence: [{ kind: 'process', ref: this.tool, detail: output }],
        artifacts: result.artifacts,
      };
    }

    if (operation === 'run-script' && typeof params.script !== 'string') {
      throw new RpcError('DCC run-script requires a script string.', RpcErrorCode.InvalidParams);
    }
    const prepared = await this.prepareScript(operation, params, context);
    const scriptArtifact = context.writeArtifact('report', prepared.scriptName, prepared.script);
    const result = await context.runProcess(prepared.command, prepared.args, context.projectPath);
    const success = result.exitCode === 0 && !result.timedOut && !result.cancelled;
    const artifacts = [...result.artifacts, scriptArtifact];
    for (const output of prepared.outputs ?? []) {
      if (success && exists(output.filePath)) {
        artifacts.push({
          kind: output.kind,
          path: projectRelativePath(context.projectPath, output.filePath),
        });
      }
    }
    return {
      status: success ? 'succeeded' : 'failed',
      exitCode: result.exitCode,
      command: result.command,
      summary: success
        ? prepared.summary
        : `${prepared.summary} Exit code ${result.exitCode ?? 'unknown'}.`,
      evidence: [
        {
          kind: 'process',
          ref: this.tool,
          detail: result.timedOut
            ? 'Process timed out.'
            : result.cancelled
              ? 'Process was cancelled.'
              : `Process exited with code ${result.exitCode ?? 'unknown'}.`,
        },
      ],
      artifacts,
    };
  }

  protected scriptPath(context: DccExecutionContext, fileName: string): string {
    return path.join(context.runDirectory, path.basename(fileName));
  }

  protected resolveInputPath(
    params: Record<string, unknown>,
    context: DccExecutionContext,
    key = 'file',
  ): string {
    const value = params[key];
    if (typeof value !== 'string' || !value) {
      throw new RpcError(
        `DCC parameter ${key} must be a Project-relative path.`,
        RpcErrorCode.InvalidParams,
      );
    }
    return context.resolveInput(value);
  }
}

function exists(filePath: string): boolean {
  return existsSync(filePath);
}
