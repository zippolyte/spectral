import { Optional } from '@stoplight/types';

import { httpAndFileResolver } from '../../resolvers/http-and-file';
import { getDefaultRulesetFile } from '../../rulesets/loader';
import { isOpenApiv2, isOpenApiv3 } from '../../rulesets/lookups';
import { readRuleset } from '../../rulesets/reader';
import { Spectral } from '../../spectral';
import { ILintConfig } from '../../types/config';
import { loadRulesets, skipRules } from './linter';

export async function initialize(flags: ILintConfig, rulesetFile: Optional<string[]>) {
  const rulesetFiles = rulesetFile || (await getDefaultRulesetFile(process.cwd()));
  const ruleset = await (rulesetFiles
    ? loadRulesets(process.cwd(), Array.isArray(rulesetFiles) ? rulesetFiles : [rulesetFiles])
    : readRuleset('spectral:oas'));

  const spectral = new Spectral({ resolver: httpAndFileResolver });

  if (flags.verbose) {
    if (ruleset) {
      console.info(`Found ${Object.keys(ruleset.rules).length} rules`);
    } else {
      console.info('No rules loaded, will auto-detect document types');
    }
  }

  spectral.registerFormat('oas2', document => {
    if (isOpenApiv2(document)) {
      return true;
    }
    return false;
  });

  spectral.registerFormat('oas3', document => {
    if (isOpenApiv3(document)) {
      return true;
    }
    return false;
  });

  spectral.setRuleset(ruleset);

  if (flags.skipRule) {
    spectral.setRules(skipRules(ruleset.rules, flags));
  }

  return spectral;
}
