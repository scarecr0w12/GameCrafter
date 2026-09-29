import type { BackupDestinationConfig, BackupDestinationKind } from '@gamecrafter/contracts';

export interface RecoveryIdentityForm {
  label: string;
  secret: string;
  confirmation: string;
}

export function validateRecoveryIdentity(form: RecoveryIdentityForm): string | undefined {
  if (!form.label.trim()) return 'Enter an identity label.';
  if (form.secret.length < 12) return 'Recovery secrets must be at least 12 characters.';
  if (form.secret !== form.confirmation) return 'Recovery secrets do not match.';
  return undefined;
}

export function parseDestinationConfig(
  kind: BackupDestinationKind,
  value: string,
): BackupDestinationConfig | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
  const config = parsed as Record<string, unknown>;
  if (kind === 'local')
    return typeof config.directory === 'string' && config.directory
      ? (config as unknown as BackupDestinationConfig)
      : undefined;
  if (kind === 's3') {
    return typeof config.region === 'string' && typeof config.bucket === 'string'
      ? (config as unknown as BackupDestinationConfig)
      : undefined;
  }
  if (kind === 'ftp') {
    return typeof config.host === 'string' &&
      Number.isInteger(config.port) &&
      typeof config.user === 'string'
      ? (config as unknown as BackupDestinationConfig)
      : undefined;
  }
  return typeof config.folderId === 'string' && typeof config.clientId === 'string'
    ? (config as unknown as BackupDestinationConfig)
    : undefined;
}

export function formatBackupBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
