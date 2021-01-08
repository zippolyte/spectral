import type { DocumentInventory } from '../documentInventory';
import type { IRuleResult } from '../types';
import type { Ruleset } from '../ruleset/ruleset';

export interface IRunnerInternalContext {
  ruleset: Ruleset;
  documentInventory: DocumentInventory;
  results: IRuleResult[];
  promises: Array<Promise<void>>;
}
