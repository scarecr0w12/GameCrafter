import path from 'node:path';
import type { DccOperation } from '@gamecrafter/contracts';
import type { DccCandidateSpec } from './common';
import { ScriptedDccAdapter, type PreparedDccScript } from './scripted';
import type { DccExecutionContext } from '../types';

const candidateSpec: DccCandidateSpec = {
  tool: 'zbrush',
  names: [
    { name: 'ZBrush.exe', kind: 'gui' },
    { name: 'ZBrush', kind: 'gui' },
  ],
};

const implementedOperations: readonly DccOperation[] = ['discover', 'run-script'];

export class ZBrushAdapter extends ScriptedDccAdapter {
  readonly tool = 'zbrush' as const;
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
    const scriptName = 'zbrush-user-script.py';
    const script = typeof params.script === 'string' ? params.script : '';
    const scriptPath = await context.toHostPath(path.join(context.runDirectory, scriptName));
    return {
      scriptName,
      script,
      command: context.installation.executable,
      args: ['-script', scriptPath, '-batch'],
      summary:
        operation === 'run-script' ? 'ZBrush script completed.' : 'ZBrush operation completed.',
    };
  }
}
