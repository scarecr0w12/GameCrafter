import { createHash, sign, verify } from 'node:crypto';
import { createReadStream, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ReleaseManifestSchema,
  type ReleaseManifest,
  type ReleasePlatform,
} from '@gamecrafter/contracts';
import { compile } from '@gamecrafter/contracts';

const releaseManifestValidator = compile<ReleaseManifest>(ReleaseManifestSchema);

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export async function writeChecksums(directory: string): Promise<string> {
  const entries = await Promise.all(
    readdirSync(directory)
      .filter((name) => name !== 'SHA256SUMS.txt' && name !== 'SHA256SUMS.txt.sig')
      .map(async (name) => {
        const filePath = path.join(directory, name);
        if (!statSync(filePath).isFile()) return null;
        return { name, checksum: await sha256File(filePath) };
      }),
  );
  const contents = entries
    .filter((entry): entry is { name: string; checksum: string } => entry !== null)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(({ checksum, name }) => `${checksum}  ${name}`)
    .join('\n');
  const outputPath = path.join(directory, 'SHA256SUMS.txt');
  writeFileSync(outputPath, contents.length > 0 ? `${contents}\n` : '', 'utf8');
  return outputPath;
}

export function parseChecksums(contents: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of contents.split(/\r?\n/)) {
    if (!line) continue;
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || entries.has(match[2]!)) throw new Error(`Invalid SHA256SUMS entry: ${line}`);
    entries.set(match[2]!, match[1]!);
  }
  return entries;
}

export function signContents(contents: Uint8Array, privateKeyPem: string): string {
  return sign(null, contents, privateKeyPem).toString('base64');
}

export function verifyContents(
  contents: Uint8Array,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    return verify(null, contents, publicKeyPem, Buffer.from(signatureBase64.trim(), 'base64'));
  } catch {
    return false;
  }
}

export function createReleaseManifest(input: {
  version: string;
  tag: string;
  commit: string;
  builtAt?: string;
  platforms: ReleasePlatform[];
  compatibility: ReleaseManifest['compatibility'];
  notes?: string;
}): ReleaseManifest {
  return releaseManifestValidator.assert({
    schemaVersion: 1,
    version: input.version,
    tag: input.tag,
    commit: input.commit,
    builtAt: input.builtAt ?? new Date().toISOString(),
    platforms: input.platforms,
    compatibility: input.compatibility,
    notes: input.notes ?? '',
  });
}
