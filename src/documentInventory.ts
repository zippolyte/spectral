import { extractPointerFromRef, extractSourceFromRef, hasRef, isLocalRef } from '@stoplight/json';
import { resolve } from '@stoplight/path';
import { Dictionary, IParserResult, JsonPath, Optional } from '@stoplight/types';
import * as $RefParser from 'json-schema-ref-parser';
import { get } from 'lodash';
import { Document, IDocument } from './document';

import { formatParserDiagnostics, formatResolverErrors } from './errorMessages';
import * as Parsers from './parsers';
import { IParser } from './parsers/types';
import { IResolver, IRuleResult } from './types';
import { getClosestJsonPath, getEndRef, isAbsoluteRef, safePointerToPath, traverseObjUntilRef } from './utils';

const yamlDefaultParser = require('json-schema-ref-parser/lib/parsers/yaml');
const jsonDefaultParser = require('json-schema-ref-parser/lib/parsers/json');

export type DocumentInventoryItem = {
  document: IDocument;
  path: JsonPath;
  missingPropertyPath: JsonPath;
};

export class DocumentInventory {
  private static readonly _cachedRemoteDocuments = new WeakMap<IResolver, Dictionary<Document>>();

  public resolved: unknown;
  public errors!: IRuleResult[];
  public diagnostics: IRuleResult[] = [];

  protected readonly refParser: $RefParser;

  public readonly referencedDocuments: Dictionary<Document>;

  public get source() {
    return this.document.source;
  }

  public get unresolved() {
    return this.document.data;
  }

  public get formats() {
    return this.document.formats;
  }

  constructor(public readonly document: IDocument<unknown>, protected resolver: Optional<IResolver>) {
    const cacheKey = resolver || ({} as any);
    const cachedDocuments = DocumentInventory._cachedRemoteDocuments.get(cacheKey);
    this.refParser = new $RefParser();

    if (cachedDocuments) {
      this.referencedDocuments = cachedDocuments;
    } else {
      this.referencedDocuments = {};
      DocumentInventory._cachedRemoteDocuments.set(cacheKey, this.referencedDocuments);
    }
  }

  public hasNode(path: string) {
    const ref = extractPointerFromRef(path);
    if (ref === null) {
      return this.refParser.$refs.exists(path);
    }

    // @ts-ignore
    return !!this.refParser.$refs._resolve(path)?.$ref?.paths.includes(ref);
  }

  public async resolve() {
    this.resolved = await this.refParser.dereference(this.document.source || '', Object(this.document.data), {
      failFast: false,
      parse: {
        yaml: this.wrapParser(yamlDefaultParser),
        json: this.wrapParser(jsonDefaultParser),
      },
    });

    this.errors = formatResolverErrors(this.document, this.refParser.errors);
  }

  public findAssociatedItemForPath(path: JsonPath, resolved: boolean): DocumentInventoryItem | null {
    if (!resolved) {
      const newPath: JsonPath = getClosestJsonPath(this.unresolved, path);

      return {
        document: this.document,
        path: newPath,
        missingPropertyPath: path,
      };
    }

    try {
      const newPath: JsonPath = getClosestJsonPath(this.resolved, path);
      let $ref = traverseObjUntilRef(this.unresolved, newPath);

      if ($ref === null) {
        return {
          document: this.document,
          path: getClosestJsonPath(this.unresolved, path),
          missingPropertyPath: path,
        };
      }

      const missingPropertyPath =
        newPath.length === 0 ? [] : path.slice(path.lastIndexOf(newPath[newPath.length - 1]) + 1);

      let { source } = this;

      while (true) {
        if (source === null) return null;

        console.log(this.refParser.$refs.paths(source));
        getEndRef(this.refParser.$refs.paths(source) as any, $ref);

        if ($ref === null) return null;

        const scopedPath: JsonPath = [...safePointerToPath($ref), ...newPath];
        let resolvedDoc;

        if (isLocalRef($ref)) {
          resolvedDoc = source === this.document.source ? this.document : this.referencedDocuments[source];
        } else {
          const extractedSource: string = extractSourceFromRef($ref)!;
          source = isAbsoluteRef(extractedSource) ? extractedSource : resolve(source, '..', extractedSource);

          resolvedDoc = source === this.document.source ? this.document : this.referencedDocuments[source];
          const obj =
            scopedPath.length === 0 || hasRef(resolvedDoc.data) ? resolvedDoc.data : get(resolvedDoc.data, scopedPath);

          if (hasRef(obj)) {
            $ref = obj.$ref;
            continue;
          }
        }

        const closestPath = getClosestJsonPath(resolvedDoc.data, scopedPath);
        return {
          document: resolvedDoc,
          path: closestPath,
          missingPropertyPath: [...closestPath, ...missingPropertyPath],
        };
      }
    } catch {
      return null;
    }
  }

  protected wrapParser(parserOptions: $RefParser.ParserOptions) {
    return {
      ...parserOptions,
      read: (file: $RefParser.FileInfo) => {
        console.log('ca;led');
        const { url: source, extension: ext } = file;

        const content = String(file.data);
        const parser: IParser<IParserResult<unknown, any, any, any>> = ext === '.json' ? Parsers.Json : Parsers.Yaml;
        const document = new Document(content, parser, source);

        if (document.diagnostics.length > 0) {
          this.diagnostics.push(...formatParserDiagnostics(document.diagnostics, document.source));
        }

        this.referencedDocuments[source] = document;

        return document.data;
      },
    };
  }
}
