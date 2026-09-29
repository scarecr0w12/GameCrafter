import path from 'node:path';
import type { DccOperation } from '@gamecrafter/contracts';
import type { DccCandidateSpec } from './common';
import { ScriptedDccAdapter, type PreparedDccScript } from './scripted';
import type { DccExecutionContext } from '../types';
import { maxScript } from '../scripts/3dsmax';

const candidateSpec: DccCandidateSpec = {
  tool: '3dsmax',
  names: [
    { name: '3dsmaxbatch.exe', kind: 'batch' },
    { name: '3dsmaxbatch', kind: 'batch' },
  ],
};

const implementedOperations: readonly DccOperation[] = [
  'discover',
  'inspect',
  'import',
  'export',
  'convert',
  'render-preview',
  'run-script',
  'validate',
];

export class Max3DAdapter extends ScriptedDccAdapter {
  readonly tool = '3dsmax' as const;
  protected readonly candidateSpec = candidateSpec;
  protected readonly implementedOperations = implementedOperations;

  protected versionArgs(): string[] {
    return ['-version'];
  }

  protected async prepareScript(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<PreparedDccScript> {
    if (operation === 'run-script') {
      const scriptPath = path.join(context.runDirectory, 'max-user-script.py');
      return {
        scriptName: path.basename(scriptPath),
        script: String(params.script),
        command: context.installation.executable,
        args: [await context.toHostPath(scriptPath)],
        summary: '3ds Max script completed.',
      };
    }
    const inputPath =
      operation === 'discover'
        ? ''
        : this.resolveInputPath(params, context, operation === 'convert' ? 'input' : 'file');
    const hostInput = inputPath ? await context.toHostPath(inputPath) : '';
    const format =
      typeof params.format === 'string' ? params.format : path.extname(inputPath).slice(1);
    const outputPath =
      operation === 'import'
        ? path.join(context.runDirectory, 'max-import.max')
        : operation === 'export' || operation === 'convert'
          ? context.resolveOutput(
              typeof params.output === 'string'
                ? params.output
                : path.posix.join(
                    '.gamecrafter',
                    'dcc-runs',
                    context.runId,
                    `max-export.${format || 'fbx'}`,
                  ),
            )
          : operation === 'render-preview'
            ? context.resolveOutput(
                typeof params.output === 'string'
                  ? params.output
                  : path.posix.join('.gamecrafter', 'dcc-runs', context.runId, 'max-preview.png'),
              )
            : undefined;
    const hostOutput = outputPath ? await context.toHostPath(outputPath) : '';
    const script = maxScript(operation, hostInput, hostOutput, format);
    const scriptName = `max-${operation}.py`;
    const scriptPath = await context.toHostPath(path.join(context.runDirectory, scriptName));
    const args = [scriptPath, ...(inputPath ? ['-sceneFile', hostInput] : [])];
    const outputKind =
      operation === 'render-preview'
        ? ('screenshot' as const)
        : operation === 'import'
          ? ('build' as const)
          : ('export' as const);
    return {
      scriptName,
      script,
      command: context.installation.executable,
      args,
      summary: `3ds Max ${operation} completed.`,
      ...(outputPath ? { outputs: [{ filePath: outputPath, kind: outputKind }] } : {}),
    };
  }
}
