import { compileExportedFunction, evaluateExport } from '../utils/evaluators';
import type { JSONSchema, IFunction } from '../../types';
import { ValidationError } from '../validation';
import { IFunctionPaths, IFunctionValues } from '../../types';
import { Dictionary } from '@stoplight/types';

type CompileOptions = {
  inject: Dictionary<unknown>;
};

export class CustomFunction {
  protected readonly schema: JSONSchema | null;
  protected readonly source: string;

  constructor(
    public readonly name: string,
    protected readonly uri: string,
    { schema, source }: { schema: JSONSchema | null; source: string },
  ) {
    this.schema = schema;
    this.source = source;
  }

  public compile({ inject }: CompileOptions) {
    const exportedFn = evaluateExport(this.source, this.uri, inject);

    const fn = this.schema !== null ? decorateIFunctionWithSchemaValidation(exportedFn, this.schema) : exportedFn;

    Reflect.defineProperty(fn, 'name', {
      configurable: true,
      value: name,
    });

    Object.freeze(fn);
    return fn;
  }
}

function decorateIFunctionWithSchemaValidation(fn: IFunction<any>, schema: JSONSchema) {
  return (data: unknown, opts: unknown, ...args: [IFunctionPaths, IFunctionValues]) => {
    if (!ajv.validate(schema, opts)) {
      throw new ValidationError(ajv.errors ?? []);
    }

    return fn(data, opts, ...args);
  };
}
