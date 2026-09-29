import { createReadStream, realpathSync } from 'node:fs';
import path from 'node:path';
import { inject, injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import type { Application, Request, Response } from 'express';
import {
  ControlRoomService,
  type ControlRoomService as ControlRoomServiceApi,
} from '../common/control-room-protocol';

@injectable()
export class AssetPreviewContribution implements BackendApplicationContribution {
  constructor(
    @inject(ControlRoomService)
    private readonly service: ControlRoomServiceApi,
  ) {}

  configure(app: Application): void {
    app.get('/gamecrafter/asset-preview', (request, response) => {
      void this.streamPreview(request, response);
    });
  }

  private async streamPreview(request: Request, response: Response): Promise<void> {
    const projectId = request.query.projectId;
    const sourcePath = request.query.path;
    if (typeof projectId !== 'string' || typeof sourcePath !== 'string') {
      response.status(400).end();
      return;
    }
    try {
      const preview = await this.service.previewAsset({ projectId, path: sourcePath });
      if (!preview.derivativePath || !preview.mimeType) {
        response.status(404).end();
        return;
      }
      const project = await this.service.getProject(projectId);
      const projectRoot = realpathSync(project.path);
      const candidate = path.resolve(projectRoot, preview.derivativePath);
      if (!isWithin(projectRoot, candidate)) {
        response.status(404).end();
        return;
      }
      const actualPath = realpathSync(candidate);
      if (!isWithin(projectRoot, actualPath)) {
        response.status(404).end();
        return;
      }
      response.setHeader('Content-Type', preview.mimeType);
      response.setHeader('Cache-Control', 'no-store');
      const stream = createReadStream(actualPath);
      stream.once('error', () => {
        if (!response.headersSent) response.status(404).end();
      });
      stream.pipe(response);
    } catch {
      if (!response.headersSent) response.status(404).end();
    }
  }
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}
