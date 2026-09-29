import type {
  EngineFamily,
  EngineIdentityEvidence,
  EngineInstallation,
  EngineOperation,
  EngineOperationCapability,
  EngineOperationEvidence,
  EngineRunArtifact,
  ProjectManifest,
} from '@gamecrafter/contracts';

export interface EngineProjectIdentity {
  proven: boolean;
  evidence: EngineIdentityEvidence[];
  projectVersion: string | null;
}

export interface EngineProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
  command: string[];
  artifacts: EngineRunArtifact[];
}

export interface EngineOperationOutcome {
  status: 'succeeded' | 'failed' | 'unavailable';
  exitCode: number | null;
  command: string[];
  summary: string;
  evidence: EngineOperationEvidence[];
  artifacts: EngineRunArtifact[];
}

export interface EngineExecutionContext {
  projectId: string;
  family: EngineFamily;
  projectPath: string;
  gamePath: string;
  manifest: ProjectManifest;
  installation: EngineInstallation | null;
  runId: string;
  runDirectory: string;
  startedAt: string;
  timeoutMs: number;
  signal: AbortSignal;
  runProcess(command: string, args: string[], cwd?: string): Promise<EngineProcessResult>;
  writeArtifact(
    kind: EngineRunArtifact['kind'],
    fileName: string,
    content: string | Buffer,
  ): EngineRunArtifact;
  redactCommand(command: string, args: string[]): string[];
}

export interface EngineCapabilityContext {
  projectId: string;
  family: EngineFamily;
  projectPath: string;
  gamePath: string;
  manifest: ProjectManifest;
  installation: EngineInstallation | null;
  installations: EngineInstallation[];
  identity: EngineProjectIdentity;
}

export interface EngineConnector {
  readonly family: EngineFamily;
  detectInstallations(environment: NodeJS.ProcessEnv): Promise<EngineInstallation[]>;
  probeVersion(installation: EngineInstallation): Promise<string | null>;
  selectInstallation(
    operation: EngineOperation,
    installations: EngineInstallation[],
  ): EngineInstallation | null;
  proveIdentity(gamePath: string): Promise<EngineProjectIdentity>;
  operations(context: EngineCapabilityContext): EngineOperationCapability[];
  run(
    operation: EngineOperation,
    params: Record<string, unknown>,
    context: EngineExecutionContext,
  ): Promise<EngineOperationOutcome>;
}
