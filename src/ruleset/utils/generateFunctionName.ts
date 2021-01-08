import type { Ruleset } from '../ruleset';
import * as fnv1a from '@sindresorhus/fnv1a';
import { Dictionary } from '@stoplight/types';

const names = new Proxy<Dictionary<string>>(
  {},
  {
    get(target, name: string) {
      if (name in target) {
        return target[name];
      }

      target[name] = String(fnv1a.bigInt(name, { size: 64 }));
      return target[name];
    },
  },
);

export function generateFunctionName(baseName: string, ruleset: Ruleset): string {
  return `${baseName}-${names[ruleset.uri]}`;
}
