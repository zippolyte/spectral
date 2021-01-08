import { extname, join } from '@stoplight/path';
import { IReadOptions, readParsable, readFile } from '../fs/reader';
import { createHttpAndFileResolver } from '../resolvers/http-and-file';
import { Dictionary, Optional } from '@stoplight/types';
import { parseYaml } from '../parsers';
import { assertValidRuleset, assertValidRule } from './validation';
import { Cache } from '@stoplight/json-ref-resolver';
import { findFile, isNPMSource } from './utils/findFile';
import { mergeExceptions, mergeRules } from './mergers';
import { Rule } from './rule/rule';
import {
  RulesetFunctionCollection,
  IParserOptions,
  RulesetDefinition,
  FileRulesetSeverity,
  IRulesetReadOptions,
  RulesetExceptionCollection,
} from './types';
import { generateFunctionName } from './utils/generateFunctionName';
import { DEFAULT_PARSER_OPTIONS } from '../consts';
import { CustomFunction } from './customFunction/customFunction';

function parseContent(content: string, source: string): unknown {
  if (extname(source) === '.json') {
    return JSON.parse(content);
  }

  return parseYaml(content).data;
}

type RulesetContext = {
  readOpts: Optional<IRulesetReadOptions>;
  severity: FileRulesetSeverity;
};

function assertReadRuleset(
  ruleset: Ruleset,
): asserts ruleset is Ruleset & {
  definition: RulesetDefinition;
  extends: Ruleset[] | null;
  resolvedFunctions: RulesetFunctionCollection | null;
} {
  // @ts-ignore
  if (ruleset.definition === void 0 || ruleset.extends === void 0 || ruleset.resolvedFunctions === void 0) {
    throw new ReferenceError('Ruleset has not been read yet');
  }
}

export class OfflineRuleset {}

export class Ruleset {
  protected readonly readOpts: Readonly<IReadOptions>;

  protected definition?: RulesetDefinition;
  protected extends?: Ruleset[] | null;
  protected resolvedFunctions?: RulesetFunctionCollection | null;

  constructor(public readonly uri: string, protected readonly context: RulesetContext) {
    this.readOpts = {
      timeout: this.context.readOpts?.timeout,
      encoding: 'utf8',
      agent: this.context.readOpts?.agent,
    };
  }

  public get exceptions(): RulesetExceptionCollection | null {
    assertReadRuleset(this);

    if ((this.extends === null || this.extends.length === 0) && this.definition.except === void 0) {
      return null;
    }

    const exceptions: RulesetExceptionCollection = {};

    if (this.extends !== null && this.extends.length > 0) {
      for (const extendedRuleset of this.extends) {
        Object.assign(exceptions, extendedRuleset.exceptions);
      }
    }

    if (this.definition.except !== void 0) {
      mergeExceptions(exceptions, this.definition.except, this.uri);
    }

    return exceptions;
  }

  public get functions(): RulesetFunctionCollection | null {
    assertReadRuleset(this);

    if ((this.extends === null || this.extends.length === 0) && this.resolvedFunctions === null) {
      return null;
    }

    const functions: RulesetFunctionCollection = {};

    if (this.extends !== null) {
      for (const extendedRuleset of this.extends) {
        Object.assign(functions, extendedRuleset.functions);
      }
    }

    if (this.resolvedFunctions !== null) {
      for (const [name, definition] of Object.entries(this.resolvedFunctions)) {
        const newName = generateFunctionName(name, this);
        functions[newName] = definition;
        Reflect.defineProperty(functions, name, {
          configurable: true,
          enumerable: true,
          get() {
            return this[newName];
          },
        });
      }
    }

    return functions;
  }

  public get rules(): Dictionary<Rule> {
    assertReadRuleset(this);

    if (!('extends' in this.definition)) {
      const rules: Dictionary<Rule> = {};
      for (const [name, rule] of Object.entries(this.definition.rules)) {
        assertValidRule(rule); // todo: move it to json schema
        rules[name] = new Rule(name, rule);
      }

      return rules;
    }

    const rules: Dictionary<Rule> = {};

    if (this.extends !== null && this.extends.length > 0) {
      for (const extendedRuleset of this.extends) {
        Object.assign(rules, extendedRuleset.rules);
      }
    }

    mergeRules(rules, this.definition.rules);
    for (const [name, rule] of Object.entries(rules)) {
      if (rule.isInherited) {
        rule.enabled = this.context.severity === 'all' || (this.context.severity === 'recommended' && rule.recommended);
        continue;
      }

      if (this.definition.documentationUrl !== void 0 && rule.documentationUrl === void 0) {
        rule.documentationUrl = `${this.definition.documentationUrl}#${name}`;
      }

      if (this.resolvedFunctions !== null) {
        for (const then of rule.then) {
          if (then.function in this.resolvedFunctions) {
            then.function = generateFunctionName(then.function, this);
          }
        }
      }

      if (this.definition.formats !== void 0 && rule.formats === void 0) {
        rule.formats = this.definition.formats;
      }
    }

    return rules;
  }

  public get parserOptions(): IParserOptions {
    assertReadRuleset(this);

    return this.definition.parserOptions ?? DEFAULT_PARSER_OPTIONS;
  }

  protected async loadDependencies(ruleset: RulesetDefinition): Promise<void> {
    const dependencies: Promise<unknown>[] = [];

    if (ruleset.functions !== void 0) {
      const rulesetFunctionsBaseDir = join(
        this.uri,
        isNPMSource(this.uri) ? '.' : '..',
        ruleset.functionsDir ?? 'functions',
      );

      const resolvedFunctions = (this.resolvedFunctions = {});

      dependencies.push(
        Promise.all(
          ruleset.functions.map(async fn => {
            const fnName = Array.isArray(fn) ? fn[0] : fn;
            const fnSchema = Array.isArray(fn) ? fn[1] : null;
            const uri = await findFile(rulesetFunctionsBaseDir, `./${fnName}.js`);
            const source = await readFile(uri, this.readOpts);

            resolvedFunctions[fnName] = new CustomFunction(fnName, uri, {
              schema: fnSchema,
              source,
            });
          }),
        ),
      );
    } else {
      this.resolvedFunctions = null;
    }

    if (ruleset.extends !== void 0) {
      this.extends = [];
      const extendedRulesets = Array.isArray(ruleset.extends) ? ruleset.extends : [ruleset.extends];
      for (const extendedRuleset of extendedRulesets) {
        const context = { ...this.context };
        let uri;
        if (Array.isArray(extendedRuleset)) {
          context.severity = extendedRuleset[1];
          uri = extendedRuleset[0];
        } else {
          uri = extendedRuleset;
        }

        const ruleset = new Ruleset(uri, context);
        this.extends.push(ruleset);
        dependencies.push(ruleset.load());
      }
    } else {
      this.extends = null;
    }

    await Promise.all(dependencies);
  }

  async load(): Promise<RulesetDefinition> {
    const content = await readParsable(this.uri, this.readOpts);

    if (content.trim().length === 0) {
      throw new Error('Ruleset must not empty');
    }

    const { result } = await createHttpAndFileResolver({ agent: this.readOpts?.agent }).resolve(
      parseContent(content, this.uri),
      {
        baseUri: this.uri,
        dereferenceInline: false,
        uriCache: new Cache(), // todo: share?
        async parseResolveResult(opts) {
          opts.result = parseContent(opts.result, opts.targetAuthority.pathname());
          return opts;
        },
      },
    );

    assertValidRuleset(JSON.parse(JSON.stringify(result)));

    await this.loadDependencies(result);

    this.definition = result;

    return result;
  }
}
