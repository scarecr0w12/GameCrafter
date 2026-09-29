import path from 'node:path';
import type { DccOperation } from '@gamecrafter/contracts';
import type { DccCandidateSpec } from './common';
import { ScriptedDccAdapter, type PreparedDccScript } from './scripted';
import type { DccCapabilityContext, DccExecutionContext } from '../types';
import { cinemaScript } from '../scripts/cinema4d';

const candidateSpec: DccCandidateSpec = {
  tool: 'cinema4d',
  names: [
    { name: 'c4dpy', kind: 'python' },
    { name: 'c4dpy.exe', kind: 'python' },
    { name: 'Commandline', kind: 'batch' },
    { name: 'Commandline.exe', kind: 'batch' },
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

export class Cinema4DAdapter extends ScriptedDccAdapter {
  readonly tool = 'cinema4d' as const;
  protected readonly candidateSpec = candidateSpec;
  protected readonly implementedOperations = implementedOperations;

  protected versionArgs(): string[] {
    return ['--version'];
  }

  operations(context: DccCapabilityContext) {
    const capabilities = super.operations(context);
    if (context.osSupport.os !== 'linux' || context.installation?.kind !== 'batch')
      return capabilities;
    return capabilities.map((capability) =>
      capability.operation === 'render-preview'
        ? { ...capability, available: true, reason: null }
        : capability,
    );
  }

  protected async prepareScript(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<PreparedDccScript> {
    const inputPath =
      operation === 'discover'
        ? ''
        : this.resolveInputPath(params, context, operation === 'convert' ? 'input' : 'file');
    const hostInput = inputPath ? await context.toHostPath(inputPath) : '';
    const format =
      typeof params.format === 'string' ? params.format : path.extname(inputPath).slice(1);
    const outputPath =
      operation === 'import'
        ? path.join(context.runDirectory, 'cinema4d-import.c4d')
        : operation === 'export' || operation === 'convert'
          ? context.resolveOutput(
              typeof params.output === 'string'
                ? params.output
                : path.posix.join(
                    '.gamecrafter',
                    'dcc-runs',
                    context.runId,
                    `cinema4d-export.${format || 'fbx'}`,
                  ),
            )
          : operation === 'render-preview'
            ? context.resolveOutput(
                typeof params.output === 'string'
                  ? params.output
                  : path.posix.join(
                      '.gamecrafter',
                      'dcc-runs',
                      context.runId,
                      'cinema4d-preview.png',
                    ),
              )
            : undefined;
    const hostOutput = outputPath ? await context.toHostPath(outputPath) : '';
    if (operation === 'render-preview' && context.installation.kind === 'batch') {
      const args = ['-render', hostInput, '-oimage', hostOutput];
      return {
        scriptName: 'cinema4d-render-command.txt',
        script: args.join(' '),
        command: context.installation.executable,
        args,
        summary: 'Cinema 4D command-line render completed.',
        outputs: [{ filePath: outputPath!, kind: 'screenshot' }],
      };
    }
    const renderResolution =
      typeof params.renderPreviewResolution === 'number' ? params.renderPreviewResolution : 512;
    const source = cinemaScript(
      operation,
      hostInput,
      hostOutput,
      format,
      typeof params.script === 'string' ? params.script : '',
      renderResolution,
    );
    const scriptName =
      operation === 'run-script' ? 'cinema4d-user-script.py' : `cinema4d-${operation}.py`;
    const scriptPath = await context.toHostPath(path.join(context.runDirectory, scriptName));
    const args = context.installation.kind === 'python' ? [scriptPath] : ['-python', scriptPath];
    const kind =
      operation === 'render-preview'
        ? ('screenshot' as const)
        : operation === 'import'
          ? ('build' as const)
          : ('export' as const);
    return {
      scriptName,
      script: source,
      command: context.installation.executable,
      args,
      summary: `Cinema 4D ${operation} completed.`,
      ...(outputPath ? { outputs: [{ filePath: outputPath, kind }] } : {}),
    };
  }
}
