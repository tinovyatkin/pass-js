// Ambient module declarations for untyped third-party packages.

declare module 'color-name' {
  const table: { [name: string]: [number, number, number] };
  export default table;
}

declare module 'imagesize' {
  type ImageInfo = {
    // Any image format string the underlying parser recognizes
    // (e.g. 'PNG', 'JPEG', 'GIF', 'WEBP').
    format: string;
    width: number;
    height: number;
  };
  interface ImagesizeParser {
    // Returns one of the numeric constants on the parser factory:
    // Parser.DONE, Parser.INVALID, Parser.EAGAIN.
    parse(chunk: Buffer): number;
    getResult(): ImageInfo;
  }
  interface ParserFactory {
    (): ImagesizeParser;
    readonly DONE: number;
    readonly INVALID: number;
    readonly EAGAIN: number;
  }
  const imagesize: {
    (input: Buffer | NodeJS.ReadableStream): ImageInfo;
    Parser: ParserFactory;
    readonly DONE: number;
    readonly INVALID: number;
    readonly EAGAIN: number;
  };
  export default imagesize;
}
