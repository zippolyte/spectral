import { Segment } from '@stoplight/types';
import { capitalize, isObject } from 'lodash';
import { Replacer } from '../utils/replacer';

export interface IMessageVars {
  property: Segment;
  error: string;
  description: string | null;
  value: unknown;
  path: string;
}

export type MessageInterpolator = (str: string, values: IMessageVars) => string;

export const messageReplacer = new Replacer<IMessageVars>(2);

messageReplacer.addTransformer('double-quotes', (id, value) => (value ? `"${value}"` : ''));
messageReplacer.addTransformer('single-quotes', (id, value) => (value ? `'${value}'` : ''));
messageReplacer.addTransformer('gravis', (id, value) => (value ? `\`${value}\`` : ''));
messageReplacer.addTransformer('capitalize', (id, value) => capitalize(String(value)));

messageReplacer.addTransformer('append-property', (id, value) => (value ? `${value} property ` : ''));
messageReplacer.addTransformer('optional-typeof', (id, value, values) =>
  typeof value === 'string' ? String(value) : `${typeof values.value} `,
);

messageReplacer.addTransformer('to-string', (id, value) => {
  if (isObject(value)) {
    return Array.isArray(value) ? 'Array[]' : 'Object{}';
  }

  return JSON.stringify(value);
});

export const message: MessageInterpolator = messageReplacer.print.bind(messageReplacer);
