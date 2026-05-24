declare module 'heic-convert' {
  interface ConvertOptions {
    buffer: Buffer | ArrayBufferLike;
    format: string;
    quality?: number;
  }

  function convert(options: ConvertOptions): Promise<ArrayBuffer>;
  export = convert;
}
