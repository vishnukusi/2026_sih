/**
 * Domain Safety Validation & Negation Verification
 */

import type { SafetyRuleValidationResult } from "../../types";

/**
 * Checks if a statement describes a compliant/verified condition rather than a breach.
 * Prevents treating statements like "Lockout verification was completed successfully"
 * as a safety breach merely because "lockout" appears in the text.
 */
export function isCompliantStatement(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const compliantPhrases = [
    "completed successfully",
    "verified compliant",
    "100% compliant",
    "no breach observed",
    "passed safety inspection",
    "verified and signed off",
    "properly isolated and locked",
    "zero energy confirmed",
    "clear of hazards",
  ];

  const negativeModifiers = [
    "not ",
    "failed",
    "skipped",
    "bypassed",
    "violation",
    "breached",
    "compromised",
    "missing",
  ];

  const hasCompliantPhrase = compliantPhrases.some((phrase) => lower.includes(phrase));
  const hasNegativeModifier = negativeModifiers.some((neg) => lower.includes(neg));

  return hasCompliantPhrase && !hasNegativeModifier;
}

/**
 * Domain Safety Rule Validation pass.
 * Validates AI predictions against controlled IOGP rules and compliance negations.
 * ARCHITECTURAL RULE: NEVER silently overwrite AI outputs.
 * If AI flags a SIF potential on a statement indicating compliance or ambiguous control verification,
 * flag it as "NEEDS_HSE_REVIEW" so human HSE managers make the authoritative decision.
 */
export function validateSafetyRules(
  originalText: string,
  aiSifPotential?: boolean,
  aiCriticalBarrierFailure?: boolean
): SafetyRuleValidationResult {
  const isCompliant = isCompliantStatement(originalText);

  if (isCompliant && (aiSifPotential || aiCriticalBarrierFailure)) {
    return {
      validation_flag: "NEEDS_HSE_REVIEW",
      validation_notes:
        "Observation text describes a verified or compliant condition, but AI inference indicated SIF precursor potential. Marked for Human HSE Expert review to prevent false alarms without overwriting AI findings.",
      flagged_for_review: true,
    };
  }

  return {
    validation_flag: "PASSED",
    flagged_for_review: false,
  };
}
