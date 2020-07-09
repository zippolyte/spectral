export declare class Dependencies {

}

export declare class ModuleRegistry extends Map<any, any> {

}

export type GenerateOptions = {
  module: 'esm' | 'cjs';
  fs: {
    read(source): Promise<unknown>;
    write(source, content): Promise<void>;
  },
  path: {
    isAbsolute(uri): boolean;
    dirname(uri): string;
    filename(uri): string;
    extname(uri): string;
    normalize(uri): string;
    join(...parts: string[]): string;
  },
  shouldResolve(source): boolean;
  dependencies: Dependencies;
  moduleRegistry: ModuleRegistry;
}

export default function(source: string, opts: GenerateOptions);
