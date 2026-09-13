/**
 * Conservative Pre-Inference PII Sanitizer.
 * Redacts personal identifiers (phone numbers, email addresses, employee/badge IDs)
 * while strictly preserving operational and engineering identifiers (Rig #04, Well #12, Valve V-104, etc.).
 */

export function sanitizePii(text: string): string {
  if (!text || typeof text !== "string") return "";
  let cleaned = text;

  // 1. Email addresses
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL_REDACTED]");

  // 2. Official OIL Employee / Badge IDs (e.g. OIL-FLD-5542, OIL-MGR-1002, EMP-4451)
  cleaned = cleaned.replace(/\bOIL-(?:FLD|MGR|EMP|ENG|DIR|SEC|STN)-\d{3,6}\b/gi, "[BADGE_REDACTED]");
  cleaned = cleaned.replace(/\b(?:EMP|BADGE)[\s:#-]*[0-9]{4,6}\b/gi, "[BADGE_REDACTED]");

  // 3. Indian & International mobile phone numbers (10 digits starting with 6-9, optional +91 prefix)
  cleaned = cleaned.replace(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, "[PHONE_REDACTED]");
  cleaned = cleaned.replace(/(?:\+91[\s-]?)?\(?0?\d{3,4}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[PHONE_REDACTED]");

  return cleaned;
}
