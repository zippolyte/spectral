const { JSONPath } = require('jsonpath-plus');
import { DiagnosticSeverity } from '@stoplight/types';

import { STDIN } from './document';
import { DocumentInventory } from './documentInventory';
import { lintNode } from './linter';
import { getDiagnosticSeverity } from './rulesets/severity';
import { FunctionCollection, IRule, IRuleResult, IRunRule, RunRuleCollection } from './types';
import { RulesetExceptionCollection } from './types/ruleset';
import { hasIntersectingElement } from './utils/';
import { generateDocumentWideResult } from './utils/generateDocumentWideResult';
// import { pivotExceptions } from './utils/pivotExceptions';
// import { IExceptionLocation } from './utils/pivotExceptions';

// const arePathsEqual = (one: JsonPath, another: JsonPath): boolean => {
//   if (one.length !== another.length) {
//     return false;
//   }
//
//   for (let i = 0; i < one.length; i++) {
//     if (one[i] !== another[i]) {
//       return false;
//     }
//   }
//
//   return true;
// };
//
// const isAKnownException = (violation: IRuleResult, locations: IExceptionLocation[]): boolean => {
//   for (const location of locations) {
//     if (violation.source !== location.source) {
//       continue;
//     }
//
//     if (arePathsEqual(violation.path, location.path)) {
//       return true;
//     }
//   }
//
//   return false;
// };

export const isRuleEnabled = (rule: IRule) => rule.severity !== void 0 && getDiagnosticSeverity(rule.severity) !== -1;

const isStdInSource = (inventory: DocumentInventory): boolean => {
  return inventory.document.source === STDIN;
};

const generateDefinedExceptionsButStdIn = (documentInventory: DocumentInventory): IRuleResult => {
  return generateDocumentWideResult(
    documentInventory.document,
    'The ruleset contains `except` entries. However, they cannot be enforced when the input is passed through stdin.',
    DiagnosticSeverity.Warning,
    'except-but-stdin',
  );
};

export interface IRunningContext {
  documentInventory: DocumentInventory;
  rules: RunRuleCollection;
  functions: FunctionCollection;
  exceptions: RulesetExceptionCollection;
}

export const runRules = async (context: IRunningContext): Promise<IRuleResult[]> => {
  const { documentInventory, rules, exceptions } = context;

  const results: Array<Promise<Array<void | IRuleResult[]>>> = [];

  const isStdIn = isStdInSource(documentInventory);

  if (isStdIn && Object.keys(exceptions).length > 0) {
    void generateDefinedExceptionsButStdIn(documentInventory);
  }

  for (const rule of Object.values(rules)) {
    if (!isRuleEnabled(rule)) continue;

    if (
      rule.formats !== void 0 &&
      (documentInventory.formats === null ||
        (documentInventory.formats !== void 0 && !hasIntersectingElement(rule.formats, documentInventory.formats)))
    ) {
      continue;
    }

    runRule(context, rule, results);
  }

  return (await Promise.allSettled(results))
    .flatMap(result => {
      if (result.status === 'fulfilled') {
        return result.value.filter(Boolean);
      }

      return null;
    })
    .flat();
};

const runRule = (
  context: IRunningContext,
  rule: IRunRule,
  results: Array<Promise<Array<void | IRuleResult[]>>>,
): void => {
  const target = rule.resolved === false ? context.documentInventory.unresolved : context.documentInventory.resolved;

  for (const given of Array.isArray(rule.given) ? rule.given : [rule.given]) {
    // don't have to spend time running jsonpath if given is $ - can just use the root object
    if (given === '$') {
      void lintNode(
        context,
        {
          path: ['$'],
          value: target,
        },
        rule,
        results,
      );
    } else {
      JSONPath({
        path: given,
        json: target,
        resultType: 'all',
        callback: (result: any) => {
          void lintNode(
            context,
            {
              path: JSONPath.toPathArray(result.path),
              value: result.value,
            },
            rule,
            results,
          );
        },
      });
    }
  }
};
