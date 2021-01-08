import { stringify } from '@stoplight/json';
import { Resolver } from '@stoplight/json-ref-resolver';
import { DiagnosticSeverity, Dictionary, Optional } from '@stoplight/types';
import { YamlParserResult } from '@stoplight/yaml';
import { memoize } from 'lodash';
import type { Agent } from 'http';

import { STATIC_ASSETS } from './assets';
import { Document, IDocument, IParsedResult, isParsedResult, ParsedDocument, normalizeSource } from './document';
import { DocumentInventory } from './documentInventory';
import * as Parsers from './parsers';
import request from './request';
import { createHttpAndFileResolver } from './resolvers/http-and-file';
import { Runner, RunnerRuntime } from './runner';
import {
  FormatLookup,
  IConstructorOpts,
  IResolver,
  IRuleResult,
  IRunOpts,
  ISpectralFullResult,
  RegisteredFormats,
} from './types';
import { ComputeFingerprintFunc, defaultComputeResultFingerprint, empty, isNimmaEnvVariableSet } from './utils';
import { generateDocumentWideResult } from './utils/generateDocumentWideResult';
import { Ruleset } from './ruleset/ruleset';
import { IRulesetReadOptions } from './ruleset/types';

memoize.Cache = WeakMap;

export * from './types';

export class Spectral {
  private readonly _resolver: IResolver;
  private readonly agent: Agent | undefined;

  public ruleset?: Ruleset;
  public readonly formats: RegisteredFormats;

  protected readonly runtime: RunnerRuntime;

  private readonly _computeFingerprint: ComputeFingerprintFunc;

  constructor(protected readonly opts?: IConstructorOpts) {
    this._computeFingerprint = memoize(opts?.computeFingerprint ?? defaultComputeResultFingerprint);

    if (opts?.proxyUri !== void 0) {
      // using eval so bundlers do not include proxy-agent when Spectral is used in the browser
      const ProxyAgent = eval('require')('proxy-agent');
      this.agent = new ProxyAgent(opts.proxyUri);
    }

    if (opts?.resolver !== void 0) {
      this._resolver = opts.resolver;
    } else {
      this._resolver =
        typeof window === 'undefined' ? createHttpAndFileResolver({ agent: this.agent }) : new Resolver();
    }

    this.formats = {};
    this.runtime = new RunnerRuntime();
  }

  public static registerStaticAssets(assets: Dictionary<string, string>): void {
    empty(STATIC_ASSETS);
    Object.assign(STATIC_ASSETS, assets);
  }

  protected parseDocument(
    target: IParsedResult | IDocument | object | string,
    documentUri: Optional<string>,
  ): IDocument {
    const document =
      target instanceof Document
        ? target
        : isParsedResult(target)
        ? new ParsedDocument(target)
        : new Document<unknown, YamlParserResult<unknown>>(
            typeof target === 'string' ? target : stringify(target, void 0, 2),
            Parsers.Yaml,
            documentUri,
          );

    let i = -1;
    for (const diagnostic of document.diagnostics.slice()) {
      i++;
      if (diagnostic.code !== 'parser') continue;

      if (diagnostic.message.startsWith('Mapping key must be a string scalar rather than')) {
        diagnostic.severity = this.ruleset.parserOptions.incompatibleValues;
      } else if (diagnostic.message.startsWith('Duplicate key')) {
        diagnostic.severity = this.ruleset.parserOptions.duplicateKeys;
      }

      if (diagnostic.severity === -1) {
        document.diagnostics.splice(i, 1);
        i--;
      }
    }

    return document;
  }

  public async runWithResolved(
    target: IParsedResult | IDocument | object | string,
    opts: IRunOpts = {},
  ): Promise<ISpectralFullResult> {
    const document = this.parseDocument(target, opts.resolve?.documentUri);

    if (document.source === null && opts.resolve?.documentUri !== void 0) {
      (document as Omit<Document, 'source'> & { source: string }).source = normalizeSource(opts.resolve.documentUri);
    }

    const inventory = new DocumentInventory(document, this._resolver);
    await inventory.resolve();

    const runner = new Runner(this.runtime, inventory);

    if (document.formats === void 0) {
      const registeredFormats = Object.keys(this.formats);
      const foundFormats = registeredFormats.filter(format =>
        this.formats[format](inventory.resolved, document.source),
      );
      if (foundFormats.length === 0 && opts.ignoreUnknownFormat !== true) {
        document.formats = null;
        if (registeredFormats.length > 0) {
          runner.addResult(this._generateUnrecognizedFormatError(document));
        }
      } else {
        document.formats = foundFormats;
      }
    }

    await runner.run(this.ruleset);

    const results = runner.getResults(this._computeFingerprint);

    return {
      resolved: inventory.resolved,
      results,
    };
  }

  public async run(target: IParsedResult | Document | object | string, opts: IRunOpts = {}): Promise<IRuleResult[]> {
    return (await this.runWithResolved(target, opts)).results;
  }

  public async loadRuleset(uri: string, readOpts?: IRulesetReadOptions): Promise<void> {
    const ruleset = new Ruleset(uri, { readOpts, severity: 'recommended' });
    await ruleset.load();
    this.setRuleset(ruleset);
  }

  public setRuleset(ruleset: Ruleset): void {
    this.runtime.revoke();

    this.ruleset = ruleset;

    if (this.opts?.useNimma === true || isNimmaEnvVariableSet()) {
      for (const rule of Object.values(ruleset.rules)) {
        rule.optimize();
      }
    }

    if (ruleset.functions !== null) {
      for (const fn of Object.values(ruleset.functions)) {
        fn.compile({
          inject: {
            fetch: request,
            spectral: this.runtime.spawn(),
          },
        });
      }
    }
  }

  public registerFormat(format: string, fn: FormatLookup): void {
    this.formats[format] = fn;
  }

  private _generateUnrecognizedFormatError(document: IDocument): IRuleResult {
    return generateDocumentWideResult(
      document,
      `The provided document does not match any of the registered formats [${Object.keys(this.formats).join(', ')}]`,
      DiagnosticSeverity.Warning,
      'unrecognized-format',
    );
  }
}
