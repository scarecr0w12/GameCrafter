import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { DCC_SUPPORT_MATRIX } from '@gamecrafter/contracts';
import type {
  DccInstallation,
  DccOperation,
  DccOperationCapability,
  DccOsSupport,
  DccTool,
} from '@gamecrafter/contracts';
import { uuidv7 } from '@gamecrafter/contracts';
import { isExecutable, probeCommand } from '../../engines/utils';
import { wslInterop, wslInteropEnvironment, type WslInterop } from '../wsl-interop';
import type { DccAdapter, DccCapabilityContext } from '../types';

export const DCC_OPERATIONS: readonly DccOperation[] = [
  'discover',
  'inspect',
  'import',
  'export',
  'convert',
  'render-preview',
  'run-script',
  'validate',
];

export function dccSideEffect(operation: DccOperation): DccOperationCapability['sideEffects'] {
  if (operation === 'run-script') return 'destructive';
  if (
    operation === 'import' ||
    operation === 'export' ||
    operation === 'convert' ||
    operation === 'render-preview'
  ) {
    return 'workspace-write';
  }
  return 'none';
}

export function getDccOsSupport(tool: DccTool, host: DccOsSupport['os']): DccOsSupport {
  const entry = DCC_SUPPORT_MATRIX.find(
    (candidate) => candidate.tool === tool && candidate.os === host,
  );
  if (!entry) throw new Error(`DCC support matrix is missing ${tool}/${host}`);
  return entry;
}

export interface DccCommandCandidate {
  executable: string;
  kind: DccInstallation['kind'];
  viaWslInterop: boolean;
}

export interface DccCandidateSpec {
  tool: DccTool;
  names: Array<{ name: string; kind: DccInstallation['kind'] }>;
}

export function detectDccCandidates(
  spec: DccCandidateSpec,
  environment: NodeJS.ProcessEnv,
  interop: WslInterop = wslInterop,
): DccCommandCandidate[] {
  const candidates: DccCommandCandidate[] = [];
  const searchPaths = parseSearchPaths(environment.GAMECRAFTER_DCC_SEARCH_PATHS);
  for (const name of spec.names) {
    for (const candidate of findOnPath([name.name], environment)) {
      addCandidate(candidates, candidate, name.kind, interop);
    }
    for (const candidate of searchPaths.flatMap((entry) => resolveSearchEntry(entry, name.name))) {
      addCandidate(candidates, candidate, name.kind, interop);
    }
  }

  for (const candidate of commonCandidates(spec, environment, interop)) {
    addCandidate(candidates, candidate.executable, candidate.kind, interop);
  }
  return candidates;
}

export function makeInstallation(tool: DccTool, candidate: DccCommandCandidate): DccInstallation {
  return {
    schemaVersion: 1,
    installationId: uuidv7(),
    tool,
    executable: path.resolve(candidate.executable),
    kind: candidate.kind,
    version: null,
    source: 'detected',
    hostOs: hostOs(process.platform),
    viaWslInterop: candidate.viaWslInterop,
    detectedAt: new Date().toISOString(),
  };
}

export function hostOs(platform: NodeJS.Platform): DccOsSupport['os'] {
  if (platform === 'win32' || platform === 'darwin' || platform === 'linux') return platform;
  return 'linux';
}

export function createDccOperationCapabilities(
  adapter: Pick<DccAdapter, 'tool'> & { implementedOperations: readonly DccOperation[] },
  context: DccCapabilityContext,
): DccOperationCapability[] {
  return DCC_OPERATIONS.map((operation) => {
    const sideEffects = dccSideEffect(operation);
    if (context.osSupport.headless === 'unsupported') {
      return {
        operation,
        layer: 'headless',
        available: false,
        reason: `${adapter.tool} headless operations are unsupported on ${context.osSupport.os}.`,
        sideEffects,
        requiresLiveBridge: false,
      };
    }
    if (!context.installation) {
      return {
        operation,
        layer: 'headless',
        available: false,
        reason: `No ${adapter.tool} installation is available.`,
        sideEffects,
        requiresLiveBridge: false,
      };
    }
    if (!adapter.implementedOperations.includes(operation)) {
      return {
        operation,
        layer: 'headless',
        available: false,
        reason: `${operation} is not supported by the ${adapter.tool} scripted surface implemented by this connector.`,
        sideEffects,
        requiresLiveBridge: false,
      };
    }
    if (context.osSupport.headless === 'unverified' && operation !== 'discover') {
      return {
        operation,
        layer: 'headless',
        available: false,
        reason: `${adapter.tool} headless ${operation} is unverified on ${context.osSupport.os}.`,
        sideEffects,
        requiresLiveBridge: false,
      };
    }
    return {
      operation,
      layer: 'headless',
      available: true,
      reason: null,
      sideEffects,
      requiresLiveBridge: false,
    };
  });
}

export async function probeDccVersion(
  executable: string,
  args: string[],
  viaWslInterop = false,
): Promise<string | null> {
  try {
    const result = await probeCommand(
      executable,
      args,
      30_000,
      viaWslInterop ? wslInteropEnvironment() : {},
    );
    return extractVersion(result);
  } catch {
    return null;
  }
}

export function extractVersion(value: string): string | null {
  const patterns = [
    /Blender\s+(\d+\.\d+(?:\.\d+)?)/i,
    /Autodesk Maya\s+(\d{4}(?:\.\d+)?)/i,
    /Maya\s+(\d{4}(?:\.\d+)?)/i,
    /3ds\s*Max\s+(\d{4}(?:\.\d+)?)/i,
    /Cinema\s*4D\s+(\d{4}(?:\.\d+)?)/i,
    /ZBrush\s+(\d+(?:\.\d+)+)/i,
    /DCC_VERSION\s*[:=]\s*([\w.-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(value);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function hostExecutablePaths(tool: DccTool, root: string): string[] {
  const programFiles = [path.join(root, 'Program Files'), path.join(root, 'Program Files (x86)')];
  const result: string[] = [];
  for (const programRoot of programFiles) {
    const vendorPath =
      tool === 'blender'
        ? path.join(programRoot, 'Blender Foundation')
        : tool === 'maya' || tool === '3dsmax'
          ? path.join(programRoot, 'Autodesk')
          : path.join(programRoot, 'Maxon');
    for (const applicationPath of listDirectories(vendorPath)) {
      for (const name of executableNames(tool)) {
        for (const candidate of executablePathsInApplication(tool, applicationPath, name)) {
          if (isFile(candidate)) result.push(candidate);
        }
      }
    }
  }
  if (tool === 'blender') {
    const direct = path.join(root, 'Blender', 'blender.exe');
    if (isFile(direct)) result.push(direct);
  }
  return result;
}

function commonCandidates(
  spec: DccCandidateSpec,
  environment: NodeJS.ProcessEnv,
  interop: WslInterop,
): DccCommandCandidate[] {
  const osPaths =
    process.platform === 'win32'
      ? windowsCommonPaths(spec.tool, environment)
      : process.platform === 'darwin'
        ? darwinCommonPaths(spec.tool)
        : linuxCommonPaths(spec.tool);
  const candidates = osPaths.map((entry) => ({
    executable: entry.path,
    kind: entry.kind,
    viaWslInterop: false,
  }));
  if (process.platform === 'linux' && interop.isWsl()) {
    for (const root of mountedWindowsDrives()) {
      for (const executable of hostExecutablePaths(spec.tool, root)) {
        const kind = kindForExecutable(spec.tool, executable);
        candidates.push({ executable, kind, viaWslInterop: true });
      }
    }
  }
  return candidates.filter((candidate) =>
    fileExistsForDcc(candidate.executable, candidate.viaWslInterop),
  );
}

function windowsCommonPaths(
  tool: DccTool,
  environment: NodeJS.ProcessEnv,
): Array<{ path: string; kind: DccInstallation['kind'] }> {
  const roots = [
    environment.ProgramFiles,
    environment['ProgramFiles(x86)'],
    environment.ProgramW6432,
  ].filter((entry): entry is string => Boolean(entry));
  return roots.flatMap((root) =>
    hostExecutablePaths(tool, path.dirname(root))
      .filter((candidate) => candidate.startsWith(root))
      .map((candidate) => ({ path: candidate, kind: kindForExecutable(tool, candidate) })),
  );
}

function darwinCommonPaths(tool: DccTool): Array<{ path: string; kind: DccInstallation['kind'] }> {
  if (tool === 'blender')
    return [{ path: '/Applications/Blender.app/Contents/MacOS/Blender', kind: 'gui' }];
  if (tool === 'cinema4d') {
    return [
      { path: '/Applications/Maxon Cinema 4D.app/Contents/MacOS/c4dpy', kind: 'python' },
      { path: '/Applications/Maxon Cinema 4D.app/Contents/MacOS/Commandline', kind: 'batch' },
    ];
  }
  return [];
}

function linuxCommonPaths(tool: DccTool): Array<{ path: string; kind: DccInstallation['kind'] }> {
  const binNames = executableNames(tool).map((name) => ({
    path: path.join('/usr/bin', name),
    kind: kindForExecutable(tool, name),
  }));
  if (tool === 'blender') {
    binNames.push({ path: '/snap/bin/blender', kind: 'gui' });
    for (const directory of listDirectories('/opt')) {
      if (/^blender/i.test(path.basename(directory)))
        binNames.push({ path: path.join(directory, 'blender'), kind: 'gui' });
    }
  }
  return binNames;
}

function executableNames(tool: DccTool): string[] {
  switch (tool) {
    case 'blender':
      return ['blender', 'blender.exe'];
    case 'maya':
      return ['mayapy', 'mayapy.exe', 'mayabatch', 'mayabatch.exe'];
    case '3dsmax':
      return ['3dsmaxbatch.exe', '3dsmaxbatch'];
    case 'cinema4d':
      return ['c4dpy', 'c4dpy.exe', 'Commandline', 'Commandline.exe'];
    case 'zbrush':
      return ['ZBrush.exe', 'ZBrush'];
  }
}

function kindForExecutable(tool: DccTool, executable: string): DccInstallation['kind'] {
  const basename = path.basename(executable).toLowerCase();
  if (tool === 'maya') return basename.includes('mayapy') ? 'python' : 'batch';
  if (tool === 'cinema4d') return basename.startsWith('c4dpy') ? 'python' : 'batch';
  if (tool === '3dsmax') return 'batch';
  return 'gui';
}

function findOnPath(names: string[], environment: NodeJS.ProcessEnv): string[] {
  const pathValue = environment.PATH ?? environment.Path ?? '';
  return pathValue
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((directory) => names.map((name) => path.resolve(directory, name)))
    .filter((candidate) =>
      fileExistsForDcc(
        candidate,
        process.platform === 'linux' &&
          candidate.startsWith('/mnt/') &&
          candidate.toLowerCase().endsWith('.exe'),
      ),
    );
}

function resolveSearchEntry(entry: string, name: string): string[] {
  const absolute = path.resolve(entry);
  if (isFile(absolute)) return [absolute];
  return [path.join(absolute, name)];
}

function parseSearchPaths(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : [];
  } catch {
    return [];
  }
}

function addCandidate(
  candidates: DccCommandCandidate[],
  executable: string,
  kind: DccInstallation['kind'],
  interop: WslInterop,
): void {
  const viaWslInterop =
    process.platform === 'linux' &&
    interop.isWsl() &&
    executable.startsWith('/mnt/') &&
    executable.toLowerCase().endsWith('.exe');
  if (!fileExistsForDcc(executable, viaWslInterop)) return;
  const resolved = path.resolve(executable);
  if (!candidates.some((entry) => entry.executable.toLowerCase() === resolved.toLowerCase())) {
    candidates.push({ executable: resolved, kind, viaWslInterop });
  }
}

function fileExistsForDcc(filePath: string, viaWslInterop: boolean): boolean {
  try {
    const info = statSync(filePath);
    return info.isFile() && (isExecutable(filePath) || viaWslInterop);
  } catch {
    return false;
  }
}

function isFile(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function listDirectories(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

function executablePathsInApplication(tool: DccTool, root: string, name: string): string[] {
  const candidates = [path.join(root, name)];
  if (tool === 'maya') candidates.push(path.join(root, 'bin', name));
  return candidates;
}

function mountedWindowsDrives(): string[] {
  try {
    return readdirSync('/mnt', { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[a-z]$/i.test(entry.name))
      .map((entry) => path.join('/mnt', entry.name));
  } catch {
    return [];
  }
}

export function executableExists(executable: string): boolean {
  return (
    existsSync(executable) &&
    (isExecutable(executable) || executable.toLowerCase().endsWith('.exe'))
  );
}
