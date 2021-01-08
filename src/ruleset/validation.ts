import * as AJV from 'ajv';
import { isObject } from 'lodash';

import * as ruleSchema from '../meta/rule.schema.json';
import * as rulesetSchema from '../meta/ruleset.schema.json';
import * as shared from '../meta/shared.json';
import { RulesetDefinition, FileRule } from './types';

const ajv = new AJV({ allErrors: true, jsonPointers: true });
const validate = ajv.addSchema(ruleSchema).addSchema(shared).compile(rulesetSchema);

const serializeAJVErrors = (errors: AJV.ErrorObject[]): string =>
  errors.map(({ message, dataPath }) => `${dataPath} ${message}`).join('\n');

export class ValidationError extends AJV.ValidationError {
  public message: string;

  constructor(public errors: AJV.ErrorObject[]) {
    super(errors);
    this.message = serializeAJVErrors(errors);
  }
}

export function assertValidRuleset(ruleset: unknown): asserts ruleset is RulesetDefinition {
  if (!isObject(ruleset)) {
    throw new Error('Provided ruleset is not an object');
  }

  if (!('rules' in ruleset) && !('extends' in ruleset)) {
    throw new Error('Ruleset must have rules or extends property');
  }

  if (!validate(ruleset)) {
    throw new ValidationError(validate.errors ?? []);
  }
}

export function isValidRule(rule: FileRule): rule is IRule {
  return typeof rule === 'object' && rule !== null && !Array.isArray(rule) && ('given' in rule || 'then' in rule);
}

export function assertValidRule(rule: FileRule): asserts rule is IRule {
  if (!isValidRule(rule)) {
    throw new TypeError('Invalid rule');
  }
}
