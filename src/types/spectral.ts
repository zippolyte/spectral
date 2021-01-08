import { IResolveOpts, IResolveResult } from '@stoplight/json-ref-resolver/types';
import { Dictionary, IDiagnostic, JsonPath } from '@stoplight/types';
import { JSONSchema4, JSONSchema6, JSONSchema7 } from 'json-schema';
import { ComputeFingerprintFunc } from '../utils';

export interface IConstructorOpts {
  resolver?: IResolver;
  computeFingerprint?: ComputeFingerprintFunc;
  useNimma?: boolean;
  proxyUri?: string;
}

export interface IRunOpts {
  ignoreUnknownFormat?: boolean;
  resolve?: {
    documentUri?: string;
  };
}

export interface IRuleResult extends IDiagnostic {
  path: JsonPath;
}

export interface ISpectralFullResult {
  resolved: unknown;
  results: IRuleResult[];
}

export interface IGivenNode {
  path: JsonPath;
  value: any;
}

export type ResolveResult = Omit<IResolveResult, 'runner'>;

export interface IResolver {
  resolve(source: unknown, opts?: IResolveOpts): Promise<ResolveResult>;
}

export type FormatLookup = (document: unknown, source: string | null) => boolean;
export type RegisteredFormats = Dictionary<FormatLookup, string>;

export type JSONSchema = JSONSchema4 | JSONSchema6 | JSONSchema7;
