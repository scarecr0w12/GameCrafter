import type { DccInstallation, DccOperation, DccOsSupport, DccTool } from '@gamecrafter/contracts';
import {
  createDccOperationCapabilities,
  detectDccCandidates,
  getDccOsSupport,
  makeInstallation,
  probeDccVersion,
  type DccCandidateSpec,
} from './common';
import { wslInterop, type WslInterop } from '../wsl-interop';
import type {
  DccAdapter,
  DccCapabilityContext,
  DccExecutionContext,
  DccOperationOutcome,
} from '../types';

export abstract class BaseDccAdapter implements DccAdapter {
  abstract readonly tool: DccTool;
  protected abstract readonly candidateSpec: DccCandidateSpec;
  protected abstract readonly implementedOperations: readonly DccOperation[];

  constructor(protected readonly interop: WslInterop = wslInterop) {}

  async detectInstallations(environment: NodeJS.ProcessEnv): Promise<DccInstallation[]> {
    return detectDccCandidates(this.candidateSpec, environment, this.interop).map((candidate) =>
      makeInstallation(this.tool, candidate),
    );
  }

  async probeVersion(installation: DccInstallation): Promise<string | null> {
    return probeDccVersion(
      installation.executable,
      this.versionArgs(installation),
      installation.viaWslInterop,
    );
  }

  selectInstallation(
    operation: DccOperation,
    installations: DccInstallation[],
  ): DccInstallation | null {
    const matching = installations.filter((installation) => installation.tool === this.tool);
    if (this.tool === 'maya') {
      return matching.find((installation) => installation.kind === 'python') ?? matching[0] ?? null;
    }
    if (this.tool === 'cinema4d') {
      const preferredKind = operation === 'render-preview' ? 'batch' : 'python';
      return (
        matching.find((installation) => installation.kind === preferredKind) ?? matching[0] ?? null
      );
    }
    return matching[0] ?? null;
  }

  hostSupport(host: NodeJS.Platform, viaWslInterop: boolean): DccOsSupport {
    const os = host === 'win32' || host === 'darwin' || host === 'linux' ? host : 'linux';
    const support = getDccOsSupport(this.tool, os);
    return viaWslInterop
      ? {
          ...support,
          sourceNote: `${support.sourceNote} Installation is invoked through WSL interop.`,
        }
      : support;
  }

  operations(context: DccCapabilityContext) {
    return createDccOperationCapabilities(
      { tool: this.tool, implementedOperations: this.implementedOperations },
      context,
    );
  }

  abstract run(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome>;

  protected abstract versionArgs(installation: DccInstallation): string[];
}
