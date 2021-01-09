import { DiagnosticSeverity } from '@stoplight/types/dist';
import { HumanReadableDiagnosticSeverity } from '../../types';
import { getDiagnosticSeverity } from '../severity';

describe('Ruleset severity', () => {
  describe('getDiagnosticSeverity', () => {
    test.each([
      ['error', DiagnosticSeverity.Error],
      ['warn', DiagnosticSeverity.Warning],
      ['info', DiagnosticSeverity.Information],
      ['hint', DiagnosticSeverity.Hint],
    ])('should successfully match %s human readable severity', (human, severity) => {
      expect(getDiagnosticSeverity(human as HumanReadableDiagnosticSeverity)).toEqual(severity);
    });

    test.each([
      DiagnosticSeverity.Error,
      DiagnosticSeverity.Warning,
      DiagnosticSeverity.Information,
      DiagnosticSeverity.Hint,
    ])('should understand diagnostic severity', severity => {
      expect(getDiagnosticSeverity(severity)).toEqual(severity);
    });
  });
});
