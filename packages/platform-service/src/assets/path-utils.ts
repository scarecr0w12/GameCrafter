import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { RpcError, RpcErrorCode } from '@gamecrafter/contracts';

export function resolveProjectPath(projectPath: string, relativePath: string): string {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.includes('\0') ||
    relativePath.replaceAll('\\', '/').split('/').includes('..')
  ) {
    throw outsideProject(relativePath);
  }
  const projectRoot = realpathSync(projectPath);
  const absolutePath = path.resolve(projectRoot, relativePath);
  if (!isWithin(projectRoot, absolutePath)) throw outsideProject(relativePath);

  let existingPath = absolutePath;
  while (!existsSync(existingPath)) {
    const parentPath = path.dirname(existingPath);
    if (parentPath === existingPath) throw outsideProject(relativePath);
    existingPath = parentPath;
  }
  const realExistingPath = realpathSync(existingPath);
  const resolvedPath = path.resolve(realExistingPath, path.relative(existingPath, absolutePath));
  if (!isWithin(projectRoot, resolvedPath)) throw outsideProject(relativePath);
  return resolvedPath;
}

export function requireExistingProjectPath(projectPath: string, relativePath: string): string {
  const candidate = resolveProjectPath(projectPath, relativePath);
  if (!existsSync(candidate)) throw outsideProject(relativePath);
  const actual = realpathSync(candidate);
  if (!isWithin(realpathSync(projectPath), actual)) throw outsideProject(relativePath);
  return actual;
}

export function isWithin(rootPath: string, targetPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

export function projectRelativePath(projectPath: string, absolutePath: string): string {
  return path.relative(realpathSync(projectPath), absolutePath).split(path.sep).join('/');
}

function outsideProject(relativePath: string): RpcError {
  return new RpcError(
    `Asset path is outside the Project: ${relativePath}`,
    RpcErrorCode.AssetPathOutsideProject,
  );
}
