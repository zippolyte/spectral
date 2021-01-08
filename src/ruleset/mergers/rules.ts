import { Dictionary, Optional } from '@stoplight/types';
import { assertValidRule } from '../validation';
import { Rule } from '../rule/rule';
import { FileRuleCollection } from '../types';

function assertExistingRule(maybeRule: Optional<Rule>): asserts maybeRule is Rule {
  if (maybeRule === void 0) {
    throw new ReferenceError('Cannot extend non-existing rule');
  }
}

/*
- if rule is object, simple deep merge (or we could replace to be a bit stricter?)
- if rule is true, use parent rule with it's default severity
- if rule is false, use parent rule but set it's severity to "off"
- if rule is string or number, use parent rule and set it's severity to the given string/number value
- if rule is array, index 0 should be false/true/string/number - same severity logic as above. optional second
*/
export function mergeRules(inheritedRules: Dictionary<Rule>, rules: FileRuleCollection): void {
  for (const [name, rule] of Object.entries(rules)) {
    const existingRule = inheritedRules[name];
    inheritedRules[name] = existingRule.clone();
    existingRule.isInherited = true;

    switch (typeof rule) {
      case 'boolean':
        existingRule.enabled = rule;
        break;
      case 'string':
      case 'number':
        assertExistingRule(existingRule);
        existingRule.severity = Rule.getNormalizedSeverity(rule);
        break;
      case 'object':
        if (Array.isArray(rule)) {
          assertExistingRule(existingRule);

          if (typeof rule[0] === 'boolean') {
            existingRule.enabled = rule[0];
          } else {
            existingRule.severity = Rule.getNormalizedSeverity(rule[0]);
          }

          if (rule.length === 2 && rule[1] !== undefined) {
            if ('functionOptions' in existingRule.then) {
              // existingRule.then.functionOptions = rule[1];
            }
          }
        } else if (existingRule !== void 0) {
          existingRule.merge(rule);
        } else {
          assertValidRule(rule);
          inheritedRules[name] = new Rule(name, rule);
        }

        break;
      default:
        throw new Error('Invalid value for a rule');
    }
  }
}
