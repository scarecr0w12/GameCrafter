import path from 'node:path';
import type { DccOperation } from '@gamecrafter/contracts';
import type { DccCandidateSpec } from './common';
import { ScriptedDccAdapter, type PreparedDccScript } from './scripted';
import type { DccExecutionContext } from '../types';
import { mayaScript } from '../scripts/maya';

const candidateSpec: DccCandidateSpec = {
  tool: 'maya',
  names: [
    { name: 'mayapy', kind: 'python' },
    { name: 'mayapy.exe', kind: 'python' },
    { name: 'mayabatch', kind: 'batch' },
    { name: 'mayabatch.exe', kind: 'batch' },
  ],
};

const implementedOperations: readonly DccOperation[] = [
  'discover',
  'inspect',
  'import',
  'export',
  'convert',
  'run-script',
  'validate',
];

export class MayaAdapter extends ScriptedDccAdapter {
  readonly tool = 'maya' as const;
  protected readonly candidateSpec = candidateSpec;
  protected readonly implementedOperations = implementedOperations;

  protected versionArgs(installation: { kind: string }): string[] {
    return installation.kind === 'python'
      ? ['-c', "import maya; print('Maya ' + maya.__version__)"]
      : ['-batch', '-command', 'print(`about -version`)'];
  }

  protected async prepareScript(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<PreparedDccScript> {
    if (operation === 'run-script') {
      return {
        scriptName: 'maya-user-script.py',
        script: String(params.script),
        command: context.installation.executable,
        args: await this.scriptArgs(context, 'maya-user-script.py'),
        summary: 'Maya script completed.',
      };
    }
    const filePath =
      operation === 'discover'
        ? ''
        : this.resolveInputPath(params, context, operation === 'convert' ? 'input' : 'file');
    const hostInput = filePath ? await context.toHostPath(filePath) : '';
    const format =
      typeof params.format === 'string' ? params.format : path.extname(filePath).slice(1);
    const outputPath =
      operation === 'import'
        ? path.join(context.runDirectory, 'maya-import.ma')
        : operation === 'export' || operation === 'convert'
          ? context.resolveOutput(
              typeof params.output === 'string'
                ? params.output
                : path.posix.join(
                    '.gamecrafter',
                    'dcc-runs',
                    context.runId,
                    `maya-export.${format || 'fbx'}`,
                  ),
            )
          : undefined;
    const hostOutput = outputPath ? await context.toHostPath(outputPath) : '';
    const script = mayaScript(operation, hostInput, hostOutput, format);
    return {
      scriptName: `maya-${operation}.py`,
      script,
      command: context.installation.executable,
      args: await this.scriptArgs(context, `maya-${operation}.py`),
      summary: `Maya ${operation} completed.`,
      ...(outputPath
        ? {
            outputs: [
              {
                filePath: outputPath,
                kind: operation === 'import' ? ('build' as const) : ('export' as const),
              },
            ],
          }
        : {}),
    };
  }

  private async scriptArgs(context: DccExecutionContext, scriptName: string): Promise<string[]> {
    const scriptPath = path.join(context.runDirectory, scriptName);
    const hostScriptPath = await context.toHostPath(scriptPath);
    if (context.installation.kind === 'python') return [hostScriptPath];
    const escaped = hostScriptPath.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    return ['-batch', '-command', `python("exec(open('${escaped}').read())")`];
  }
}
