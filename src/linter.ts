import { decodePointerFragment } from '@stoplight/json';
import { get } from 'lodash';

import { Document } from './document';
import { IMessageVars, message } from './rulesets/message';
import { getDiagnosticSeverity } from './rulesets/severity';
import { IRunningContext } from './runner';
import { IGivenNode, IRuleResult, IRunRule } from './types';
import { getClosestJsonPath, getLintTargets, printPath, PrintStyle } from './utils';

export const lintNode = async (
  context: IRunningContext,
  node: IGivenNode,
  rule: IRunRule,
  results: Array<Promise<Array<void | IRuleResult[]>>>,
) => {
  for (const then of Array.isArray(rule.then) ? rule.then : [rule.then]) {
    const func = context.functions[then.function];
    if (typeof func !== 'function') {
      throw new ReferenceError(`Function ${then.function} not found. Called by rule ${rule.name}.`);
    }

    const givenPath = node.path[0] === '$' ? node.path.slice(1) : node.path;
    const targets = getLintTargets(node.value, then.field);

    results.push(
      Promise.all(
        targets.map(async target => {
          const targetPath = [...givenPath, ...target.path];
          const targetResults = await func(
            target.value,
            then.functionOptions,
            {
              given: givenPath,
              target: targetPath,
            },
            {
              original: node.value,
              given: node.value,
              documentInventory: context.documentInventory,
            },
          );

          return targetResults === void 0
            ? void 0
            : targetResults.map<IRuleResult>(result => {
                const { documentInventory: inventory } = context;
                const escapedJsonPath = (result.path || targetPath).map(segment =>
                  decodePointerFragment(String(segment)),
                );
                const associatedItem = inventory.findAssociatedItemForPath(escapedJsonPath, rule.resolved !== false);
                const path = associatedItem?.path || getClosestJsonPath(inventory.resolved, escapedJsonPath);
                const document = associatedItem?.document || inventory.document;
                const range = document.getRangeForJsonPath(path, true) || Document.DEFAULT_RANGE;
                const value = path.length === 0 ? document.data : get(document.data, path);
                const source = associatedItem?.document.source;

                const vars: IMessageVars = {
                  property:
                    associatedItem?.missingPropertyPath && associatedItem.missingPropertyPath.length > path.length
                      ? printPath(associatedItem.missingPropertyPath.slice(path.length - 1), PrintStyle.Dot)
                      : path.length > 0
                      ? path[path.length - 1]
                      : '',
                  error: result.message,
                  path: printPath(path, PrintStyle.EscapedPointer),
                  description: rule.description,
                  value,
                };

                const resultMessage = message(result.message, vars);
                vars.error = resultMessage;

                return {
                  code: rule.name,
                  message: (rule.message === void 0
                    ? rule.description ?? resultMessage
                    : message(rule.message, vars)
                  ).trim(),
                  path,
                  severity: getDiagnosticSeverity(rule.severity),
                  ...(source !== null && { source }),
                  range,
                };
              });
        }),
      ),
    );
  }
};
