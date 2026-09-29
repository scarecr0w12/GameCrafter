import type { Readable } from 'node:stream';
import type {
  BackupArchiveEntry,
  BackupDestinationConfig,
  BackupDestinationKind,
} from '@gamecrafter/contracts';

export type BackupProgress = (bytes: number) => void;

export interface BackupDestinationAdapter {
  readonly kind: BackupDestinationKind;
  put(
    archiveName: string,
    sourceFilePath: string,
    onProgress?: BackupProgress,
    signal?: AbortSignal,
  ): Promise<{ bytes: number }>;
  get(archiveName: string, signal?: AbortSignal): Promise<Readable>;
  list(signal?: AbortSignal): Promise<BackupArchiveEntry[]>;
  delete(archiveName: string, signal?: AbortSignal): Promise<void>;
  probe(): Promise<void>;
}

export type BackupDestinationFactory = (
  config: BackupDestinationConfig,
  secrets: Record<string, string>,
) => BackupDestinationAdapter;

export function assertArchiveName(archiveName: string): void {
  if (!/^[a-z0-9-]+\.gcbackup$/i.test(archiveName) || archiveName.includes('..')) {
    throw new Error('Invalid backup archive name');
  }
}
