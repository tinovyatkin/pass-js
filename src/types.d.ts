// Ambient module declarations for untyped third-party packages.

declare module 'color-name' {
  const table: { [name: string]: [number, number, number] };
  export default table;
}

declare module 'imagesize' {
  type ImageInfo = {
    format: 'PNG' | 'JPEG' | 'GIF' | 'WEBP' | string;
    width: number;
    height: number;
  };
  interface ImagesizeParser {
    parse(chunk: Buffer): number | 'done' | 'invalid';
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
