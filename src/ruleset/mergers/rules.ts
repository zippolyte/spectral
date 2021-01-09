import { IRule } from '../../types';
import { FileRule, FileRuleCollection, FileRulesetSeverity } from '../../types/ruleset';
import { DEFAULT_SEVERITY_LEVEL, getDiagnosticSeverity } from '../severity';
import { isValidRule } from '../validation';
import { DiagnosticSeverity } from '@stoplight/types/dist';

/*
- if rule is object, simple deep merge (or we could replace to be a bit stricter?)
- if rule is true, use parent rule with it's default severity
- if rule is false, use parent rule but set it's severity to "off"
- if rule is string or number, use parent rule and set it's severity to the given string/number value
- if rule is array, index 0 should be false/true/string/number - same severity logic as above. optional second
*/
export function mergeRules(
  target: FileRuleCollection,
  source: FileRuleCollection,
  rulesetSeverity?: FileRulesetSeverity,
): FileRuleCollection {
  for (const [name, rule] of Object.entries(source)) {
    if (rulesetSeverity !== void 0) {
      if (isValidRule(rule) && !(ENABLED in rule)) {
        let enabled;
        if (rulesetSeverity === 'all') {
          enabled = true;
        } else if (rulesetSeverity === 'off') {
          enabled = false;
        } else {
          enabled = rule.recommended !== false;
        }

        Object.defineProperty(rule, ENABLED, {
          writable: true,
          value: enabled,
        });
      }

      processRule(target, name, rule);
    } else {
      processRule(target, name, rule);
    }
  }

  return target;
}

export const ENABLED = Symbol('enabled');

function processRule(rules: FileRuleCollection, name: string, rule: FileRule): void {
  const existingRule = rules[name];

  switch (typeof rule) {
    case 'boolean':
      if (isValidRule(existingRule)) {
        existingRule[ENABLED] = rule;
      }

      break;
    case 'string':
    case 'number':
      // what if rule does not exist (yet)? throw, store the invalid state somehow?
      if (isValidRule(existingRule)) {
        if (rule === 'off') {
          existingRule[ENABLED] = false;
        } else {
          existingRule.severity = getDiagnosticSeverity(rule);
          existingRule[ENABLED] = true;
        }
      }

      break;
    case 'object':
      if (Array.isArray(rule)) {
        processRule(rules, name, rule[0]);

        if (isValidRule(existingRule) && rule.length === 2 && rule[1] !== void 0) {
          if ('functionOptions' in existingRule.then) {
            existingRule.then.functionOptions = rule[1];
          }
        }
      } else if (isValidRule(existingRule)) {
        Object.assign(existingRule, normalizeRule(rule));
      } else {
        rules[name] = normalizeRule(rule);
      }

      break;
    default:
      throw new Error('Invalid value for a rule');
  }
}

function normalizeRule(rule: IRule): IRule & { recommended: boolean; severity: DiagnosticSeverity } {
  return Object.assign(Object.defineProperties({}, Object.getOwnPropertyDescriptors(rule)), {
    recommended: rule.recommended !== false,
    severity: rule.severity === void 0 ? DEFAULT_SEVERITY_LEVEL : getDiagnosticSeverity(rule.severity),
  });
}
