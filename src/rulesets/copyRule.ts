import { IRule, IThen } from '../types';

function copyRuleThen(then: IThen): IThen {
  return {
    ...then,
    ...('functionOptions' in then ? { ...then.functionOptions } : null),
  };
}

export function copyRule(rule: IRule): IRule {
  return {
    ...rule,
    ...('then' in rule
      ? { then: Array.isArray(rule.then) ? rule.then.map(copyRuleThen) : copyRuleThen(rule.then) }
      : null),
  };
}
