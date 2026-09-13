/**
 * Fact Normalization & Duplicate Suppression
 */

import type { CardData, NormalizedSafetyFact } from "../../types";
import { isCompliantStatement, findRuleByNameOrNumber } from "../safety";

/**
 * Checks if text contains explicit failure indicators, even when mixed with compliant terms.
 */
export function hasExplicitFailureEvidence(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const failureKeywords = [
    "skipped",
    "failed",
    "bypassed",
    "remained energized",
    "not performed",
    "not completed",
    "not conducted",
    "not worn",
    "missing",
    "damaged",
    "defeated",
    "unauthorized",
    "uninspected",
    "exceeded",
    "overridden",
    "leaking",
    "corroded",
    "non-compliant",
    "violation",
    "gap",
    "relied on previous shift",
    "no gas test",
    "no standby",
    "not tied off",
  ];
  return failureKeywords.some((kw) => lower.includes(kw));
}

/**
 * Safe string normalization (lowercased, trimmed, stripped of special punct).
 */
export function cleanNormalizeStr(str?: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts ISO date string YYYY-MM-DD from card metadata.
 */
export function extractCardDate(card: CardData): { dateStr: string; epochMs: number } {
  if (card.reportedAt) {
    const clean = card.reportedAt.replace(/•/g, " ").replace(/IST/g, "").trim();
    const p = Date.parse(clean);
    if (!isNaN(p) && p > 0) {
      const d = new Date(p);
      return {
        dateStr: d.toISOString().slice(0, 10),
        epochMs: p,
      };
    }
  }

  if (card.createdAt) {
    const p = new Date(card.createdAt).getTime();
    if (!isNaN(p) && p > 0) {
      const d = new Date(p);
      return {
        dateStr: d.toISOString().slice(0, 10),
        epochMs: p,
      };
    }
  }

  if (card.date) {
    const p = Date.parse(`${card.date}, 2026`);
    if (!isNaN(p) && p > 0) {
      const d = new Date(p);
      return {
        dateStr: d.toISOString().slice(0, 10),
        epochMs: p,
      };
    }
  }

  if (card.id && card.id.startsWith("worker-concern-")) {
    const epoch = parseInt(card.id.replace("worker-concern-", ""), 10);
    if (!isNaN(epoch) && epoch > 1000000000) {
      const d = new Date(epoch);
      return {
        dateStr: d.toISOString().slice(0, 10),
        epochMs: epoch,
      };
    }
  }

  // Fallback to today if unparseable
  const fallback = new Date();
  return {
    dateStr: fallback.toISOString().slice(0, 10),
    epochMs: fallback.getTime(),
  };
}

/**
 * Normalizes a single card into a NormalizedSafetyFact.
 * Preserves reports containing both compliance and failure evidence.
 * Excludes ONLY purely compliant statements describing no breach.
 */
export function normalizeCard(card: CardData): NormalizedSafetyFact | null {
  const observation = card.observation || card.title || "";
  const isPureCompliant = isCompliantStatement(observation);
  const failurePresent = hasExplicitFailureEvidence(observation);

  if (isPureCompliant && !failurePresent) {
    return null;
  }

  const { dateStr, epochMs } = extractCardDate(card);

  const lsrRules: string[] = [];
  if (Array.isArray(card.iogp_rules) && card.iogp_rules.length > 0) {
    for (const r of card.iogp_rules) {
      const parsed = findRuleByNameOrNumber(r);
      if (parsed) lsrRules.push(parsed.name);
      else if (r.trim()) lsrRules.push(r.trim());
    }
  } else if (card.iogp_rule) {
    const parsed = findRuleByNameOrNumber(card.iogp_rule);
    if (parsed) lsrRules.push(parsed.name);
    else if (card.iogp_rule.trim()) lsrRules.push(card.iogp_rule.trim());
  }

  const duplicateFingerprint =
    card.duplicateFingerprint ||
    `${cleanNormalizeStr(observation)}|${cleanNormalizeStr(card.site_location)}|${dateStr}`;

  return {
    source_report_id: card.id,
    normalized_activity: cleanNormalizeStr(card.operational_activity || "operational maintenance"),
    normalized_location: cleanNormalizeStr(card.site_location || "unspecified installation"),
    normalized_hazard: cleanNormalizeStr(card.hazard || ""),
    normalized_safety_protection: cleanNormalizeStr(card.safety_protection || card.failed_barrier || "safety control"),
    normalized_failure_state: cleanNormalizeStr(card.protection_failure_state || card.failed_barrier_type || "verification failure"),
    normalized_lsr: lsrRules,
    normalized_issue_summary: cleanNormalizeStr(observation),
    dateStr,
    epochMs,
    duplicateFingerprint,
    rawCard: card,
    hasFailureEvidence: failurePresent || true,
  };
}

/**
 * Filters exact duplicates using duplicateFingerprint.
 * Preserves legitimate recurring events (distinct dates or locations).
 */
export function filterExactDuplicates(facts: NormalizedSafetyFact[]): NormalizedSafetyFact[] {
  const seen = new Set<string>();
  const filtered: NormalizedSafetyFact[] = [];

  for (const fact of facts) {
    if (!seen.has(fact.duplicateFingerprint)) {
      seen.add(fact.duplicateFingerprint);
      filtered.push(fact);
    }
  }

  return filtered;
}
