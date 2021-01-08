import { Dictionary } from '@stoplight/types';
import { DiagnosticSeverity } from '@stoplight/types';
import { IHttpAndFileResolverOptions } from '../resolvers/http-and-file';
import { HumanReadableDiagnosticSeverity, IRule } from '../types/rule';
import { JSONSchema } from '../types/spectral';
import { CustomFunction } from './customFunction/customFunction';

export type FileRuleSeverity = DiagnosticSeverity | HumanReadableDiagnosticSeverity | boolean;
export type FileRulesetSeverity = 'off' | 'recommended' | 'all';

export type FileRule = IRule | FileRuleSeverity | [FileRuleSeverity] | [FileRuleSeverity, object];

export type FileRuleCollection = Dictionary<FileRule, string>;

export type RulesetFunctionCollection = Dictionary<CustomFunction, string>;
export type RulesetExceptionCollection = Dictionary<string[], string>;

export interface IParserOptions {
  duplicateKeys?: DiagnosticSeverity | HumanReadableDiagnosticSeverity;
  incompatibleValues?: DiagnosticSeverity | HumanReadableDiagnosticSeverity;
}

export type RulesetDefinition = {
  documentationUrl?: string;
  formats?: string[];
  functionsDir?: string;
  functions?: Array<string | [string, JSONSchema]>;
  except?: RulesetExceptionCollection;
  parserOptions?: IParserOptions;
} & {
  extends: Array<string | [string, FileRulesetSeverity]>;
} & {
  rules: FileRuleCollection; // todo: make it IRule once validation is in place
} & {
  extends: Array<string | [string, FileRulesetSeverity]>;
  rules: FileRuleCollection;
};

export interface IRulesetReadOptions extends IHttpAndFileResolverOptions {
  timeout?: number;
}
