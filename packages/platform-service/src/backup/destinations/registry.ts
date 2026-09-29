import type {
  BackupDestination,
  BackupDestinationConfig,
  BackupDestinationKind,
} from '@gamecrafter/contracts';
import { FtpBackupDestination } from './ftp';
import { GoogleDriveBackupDestination } from './google-drive';
import { LocalBackupDestination } from './local';
import { S3BackupDestination } from './s3';
import type { BackupDestinationAdapter, BackupDestinationFactory } from './destination';

export class BackupDestinationRegistry {
  private readonly factories = new Map<BackupDestinationKind, BackupDestinationFactory>();

  constructor() {
    this.register('local', (config) => new LocalBackupDestination(config));
    this.register('s3', (config, secrets) => new S3BackupDestination(config, secrets));
    this.register('ftp', (config, secrets) => new FtpBackupDestination(config, secrets));
    this.register(
      'google-drive',
      (config, secrets) => new GoogleDriveBackupDestination(config, secrets),
    );
  }

  register(kind: BackupDestinationKind, factory: BackupDestinationFactory): void {
    this.factories.set(kind, factory);
  }

  create(
    destination: BackupDestination,
    secrets: Record<string, string>,
  ): BackupDestinationAdapter {
    const factory = this.factories.get(destination.kind);
    if (!factory) throw new Error(`No backup destination adapter for ${destination.kind}`);
    return factory(destination.config as BackupDestinationConfig, secrets);
  }
}
