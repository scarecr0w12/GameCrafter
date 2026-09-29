import type {
  DccCapabilityReport,
  DccInstallation,
  DccLayer,
  DccOperation,
  DccOperationCapability,
  DccOsSupport,
  DccRun,
  DccTool,
  EngineOperationEvidence,
  EngineRunArtifact,
} from '@gamecrafter/contracts';
import type { EngineProcessResult } from '../engines/types';

export interface DccOperationOutcome {
  status: DccRun['status'];
  exitCode: number | null;
  command: string[];
  summary: string;
  evidence: EngineOperationEvidence[];
  artifacts: EngineRunArtifact[];
}

export interface DccCapabilityContext {
  projectId: string;
  projectPath: string;
  tool: DccTool;
  installation: DccInstallation | null;
  installations: DccInstallation[];
  osSupport: DccOsSupport;
}

export interface DccExecutionContext {
  projectId: string;
  projectPath: string;
  tool: DccTool;
  installation: DccInstallation;
  runId: string;
  runDirectory: string;
  startedAt: string;
  timeoutMs: number;
  signal: AbortSignal;
  runProcess(command: string, args: string[], cwd?: string): Promise<EngineProcessResult>;
  resolveInput(relativePath: string): string;
  resolveOutput(relativePath: string): string;
  toHostPath(filePath: string): Promise<string>;
  toWslPath(filePath: string): Promise<string>;
  writeArtifact(
    kind: EngineRunArtifact['kind'],
    fileName: string,
    content: string | Buffer,
  ): EngineRunArtifact;
  redactCommand(command: string, args: string[]): string[];
}

export interface DccAdapter {
  readonly tool: DccTool;
  detectInstallations(environment: NodeJS.ProcessEnv): Promise<DccInstallation[]>;
  probeVersion(installation: DccInstallation): Promise<string | null>;
  selectInstallation(
    operation: DccOperation,
    installations: DccInstallation[],
  ): DccInstallation | null;
  hostSupport(host: NodeJS.Platform, viaWslInterop: boolean): DccOsSupport;
  operations(context: DccCapabilityContext): DccOperationCapability[];
  run(
    operation: DccOperation,
    params: Record<string, unknown>,
    context: DccExecutionContext,
  ): Promise<DccOperationOutcome>;
}

export interface DccAdapterRegistryEntry {
  tool: DccTool;
  adapter: DccAdapter;
}

export interface DccProjectContext {
  projectId: string;
  projectPath: string;
}

export interface DccLiveBridgeProbe {
  connectionId: string | null;
  mcpRevision: string | null;
  status: DccCapabilityReport['layers']['live-bridge']['status'];
  detail: string;
  toolCount: number;
}

export type DccOperationLayer = DccLayer;
