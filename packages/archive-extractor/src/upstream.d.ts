declare module '@xhmikosr/decompress' {
  export default function decompress(
    input: string | Buffer,
    outputOrOptions?: unknown,
    options?: unknown,
  ): Promise<Array<{ path: string; data: Buffer; type: string; mode: number }>>;
}
