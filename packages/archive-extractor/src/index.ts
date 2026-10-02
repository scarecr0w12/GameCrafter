interface ArchiveFile {
  path: string;
  data: Buffer;
  type: string;
  mode: number;
}

interface ExtractOptions {
  filter?: (file: ArchiveFile) => boolean;
  map?: (file: ArchiveFile) => ArchiveFile;
  strip?: number;
}

/** Theia requires a callable CommonJS export; the maintained extractor is ESM. */
async function decompress(
  input: string | Buffer,
  outputOrOptions?: string | ExtractOptions,
  options?: ExtractOptions,
): Promise<ArchiveFile[]> {
  const { default: extract } = await import('@xhmikosr/decompress');
  return extract(input, outputOrOptions, options);
}

export = decompress;
