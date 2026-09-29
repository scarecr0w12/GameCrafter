import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  AssetPreviewSchema,
  RpcError,
  RpcErrorCode,
  compile,
  uuidv7,
  type AssetPreview,
  type AssetPreviewMetadata,
} from '@gamecrafter/contracts';
import type { ProjectDatabases } from '../../projects/project-databases';
import type { ProfileStore } from '../../profile/profile-store';
import type { SettingsService } from '../../settings/settings-service';
import type { AssetStore } from '../asset-store';
import { projectRelativePath, resolveProjectPath } from '../path-utils';
import {
  hasExternalGltfResources,
  inspectGltfDocument,
  parseGlbDocument,
  parseGltfDocument,
} from './gltf-inspector';
import { inspectImageDimensions } from './image-inspector';

const previewValidator = compile<AssetPreview>(AssetPreviewSchema);

export interface PreviewServiceOptions {
  projects: ProfileStore;
  projectDatabases: ProjectDatabases;
  settings: SettingsService;
  store: AssetStore;
  now?: () => Date;
}

export class PreviewService {
  private readonly now: () => Date;

  constructor(private readonly options: PreviewServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  preview(projectId: string, sourcePath: string, refresh = false): AssetPreview {
    const project = this.options.projects.getById(projectId);
    if (!project) {
      throw new RpcError(`Project not found: ${projectId}`, RpcErrorCode.ProjectNotFound);
    }
    this.options.projectDatabases.get(projectId);
    const absoluteSource = resolveProjectPath(project.path, sourcePath);
    if (!existsSync(absoluteSource) || !statSync(absoluteSource).isFile()) {
      throw new RpcError(
        `Asset preview source was not found: ${sourcePath}`,
        RpcErrorCode.AssetPreviewUnavailable,
      );
    }
    const relativeSource = projectRelativePath(project.path, absoluteSource);
    const bytes = readFileSync(absoluteSource);
    const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
    const cached = this.options.store.preview(projectId, relativeSource);
    if (
      !refresh &&
      cached?.sourceSha256 === sourceSha256 &&
      (!cached.derivativePath ||
        existsSync(resolveProjectPath(project.path, cached.derivativePath)))
    ) {
      return previewValidator.assert(cached);
    }

    const extension = path.extname(absoluteSource).toLowerCase();
    let kind: AssetPreview['kind'] = 'unavailable';
    let derivativePath: string | null = null;
    let mimeType: string | null = null;
    let metadata: AssetPreviewMetadata = {};
    let warnings: string[] = [];
    if (extension === '.glb') {
      try {
        const inspection = inspectGltfDocument(parseGlbDocument(bytes));
        metadata = inspection.metadata;
        warnings = inspection.warnings;
        if (inspection.supportedVersion) {
          kind = 'model-gltf';
          mimeType = 'model/gltf-binary';
          derivativePath = this.copyDerivative(
            project.path,
            sourceSha256,
            extension,
            absoluteSource,
          );
        } else {
          warnings = [...warnings, versionWarning(inspection.metadata.gltfVersion)];
        }
      } catch (error) {
        warnings = [previewErrorMessage(error)];
      }
    } else if (extension === '.gltf') {
      try {
        const inspection = inspectGltfDocument(parseGltfDocument(bytes.toString('utf8')));
        metadata = inspection.metadata;
        warnings = inspection.warnings;
        if (!inspection.supportedVersion) {
          warnings = [...warnings, versionWarning(inspection.metadata.gltfVersion)];
        } else if (hasExternalGltfResources(inspection.document)) {
          warnings = [...warnings, 'external buffers are not bundled into the preview'];
        } else {
          kind = 'model-gltf';
          mimeType = 'model/gltf+json';
          derivativePath = this.copyDerivative(
            project.path,
            sourceSha256,
            extension,
            absoluteSource,
          );
        }
      } catch (error) {
        warnings = [previewErrorMessage(error)];
      }
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(extension)) {
      const dimensions = inspectImageDimensions(bytes, extension);
      metadata = {
        ...(dimensions.width === undefined ? {} : { width: dimensions.width }),
        ...(dimensions.height === undefined ? {} : { height: dimensions.height }),
      };
      kind = 'image';
      mimeType = imageMimeType(extension);
      derivativePath = this.copyDerivative(project.path, sourceSha256, extension, absoluteSource);
    } else {
      warnings = [
        `No preview converter for ${extension || '(no extension)'}; open the file in its authoring tool`,
      ];
    }

    const preview = previewValidator.assert({
      schemaVersion: 1,
      previewId: uuidv7(),
      projectId,
      sourcePath: relativeSource,
      sourceSha256,
      sourceBytes: bytes.length,
      kind,
      derivativePath,
      mimeType,
      warnings: [...new Set(warnings)],
      metadata,
      createdAt: this.now().toISOString(),
    });
    this.options.store.savePreview(preview);
    this.evictOldPreviews(projectId, project.path, relativeSource);
    return preview;
  }

  private copyDerivative(
    projectPath: string,
    sourceSha256: string,
    extension: string,
    sourcePath: string,
  ): string {
    const relativePath = `.gamecrafter/cache/asset-previews/${sourceSha256}${extension}`;
    const targetPath = resolveProjectPath(projectPath, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
    return relativePath;
  }

  private evictOldPreviews(projectId: string, projectPath: string, keepSourcePath: string): void {
    const configured = this.options.settings.resolve('assets.previewCacheMb', { projectId }).value;
    const limit = (typeof configured === 'number' ? configured : 500) * 1024 * 1024;
    const previews = this.options.store.previews(projectId);
    const sizes = previews.map((preview) => {
      if (!preview.derivativePath) return { preview, size: 0 };
      try {
        const file = resolveProjectPath(projectPath, preview.derivativePath);
        return { preview, size: existsSync(file) ? statSync(file).size : 0 };
      } catch {
        return { preview, size: 0 };
      }
    });
    let total = sizes.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of sizes) {
      if (total <= limit || entry.preview.sourcePath === keepSourcePath) continue;
      if (entry.preview.derivativePath) {
        try {
          rmSync(resolveProjectPath(projectPath, entry.preview.derivativePath), { force: true });
        } catch {
          // A cache entry with an unsafe derivative path is removed from the index only.
        }
      }
      this.options.store.removePreview(projectId, entry.preview.sourcePath);
      total -= entry.size;
    }
  }
}

function imageMimeType(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/svg+xml';
  }
}

function versionWarning(version?: string): string {
  return version === '1.0'
    ? 'glTF 1.0 is not supported by the viewer'
    : `glTF version ${version ?? 'unknown'} is not supported by the viewer`;
}

function previewErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not inspect this glTF asset';
}
