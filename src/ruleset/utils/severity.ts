import { DiagnosticSeverity, Dictionary } from '@stoplight/types';
import { HumanReadableDiagnosticSeverity } from '../rule/types';

export const DEFAULT_SEVERITY_LEVEL = DiagnosticSeverity.Warning;

const SEVERITY_MAP: Dictionary<DiagnosticSeverity, HumanReadableDiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warn: DiagnosticSeverity.Warning,
  info: DiagnosticSeverity.Information,
  hint: DiagnosticSeverity.Hint,
  off: -1,
};

export function getDiagnosticSeverity(
  severity: DiagnosticSeverity | HumanReadableDiagnosticSeverity,
): DiagnosticSeverity {
  if (Number.isNaN(Number(severity))) {
    return SEVERITY_MAP[severity];
  }

  return Number(severity);
}
