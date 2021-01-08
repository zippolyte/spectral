import type { JSONSchema } from '../../types';
import { Dictionary } from '@stoplight/types';

export type CompileOptions = {
  code: string;
  name: string;
  source: string | null;
  schema: JSONSchema | null;
  inject: Dictionary<unknown>;
};

export type RulesetFunctionDefinition = {
  code?: string;
  ref?: string;
  schema: JSONSchema | null;
  name: string;
  source: string | null;
};
