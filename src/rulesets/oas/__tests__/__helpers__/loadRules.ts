import { STATIC_ASSETS } from '../../../../assets';
import { empty } from '../../../../utils';
import { Spectral } from '../../../../spectral';
import { isOpenApiv2, isOpenApiv3 } from '../../../../formats';
import * as ruleset from '../../index.json';

export async function loadRules(rules: (keyof typeof ruleset['rules'])[]): Promise<Spectral> {
  try {
    Object.assign(STATIC_ASSETS, await import('../../../../../rulesets/assets/assets.oas.json'), {
      'my-ruleset': JSON.stringify({
        extends: [['spectral:oas', 'off']],
        rules: rules.reduce((obj, name) => {
          obj[name] = true;
          return obj;
        }, {}),
      }),
    });

    const s = new Spectral();
    s.registerFormat('oas2', isOpenApiv2);
    s.registerFormat('oas3', isOpenApiv3);
    await s.loadRuleset('my-ruleset');
    return s;
  } finally {
    empty(STATIC_ASSETS);
  }
}
