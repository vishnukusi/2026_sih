/**
 * HSE Priority Scoring & Ranking Engine
 *
 * Defines mathematical, auditable prioritization calculations for:
 * 1. Warning Pattern HSE Priority (HIGH, MEDIUM, LOW)
 * 2. Operational Site HSE Priority Scores & Categorization (CRITICAL, HIGH, ELEVATED, ROUTINE)
 *
 * CORE PRINCIPLE: Precursor severity and barrier compromise ALWAYS outrank raw report volume.
 * Volume serves strictly as a minor tie-breaker (+0.01/report).
 */

import type { HsePriority, PatternConfidence, TemporalTrend } from "../../types/patterns";

export interface PatternPriorityEvaluationInput {
  reportCount: number;
  distinctDates: string[];
  trend: TemporalTrend;
  confidence: PatternConfidence;
  safetyProtections: string[];
  failureStates: string[];
  sifPotentials: boolean[];
  avgSifScore: number;
  patternScope: "LOCAL" | "CROSS_SITE";
}

export interface PatternPriorityEvaluationResult {
  priority: HsePriority;
  rationale: string;
}

export interface HsePriorityEvaluator {
  evaluate(pattern: PatternPriorityEvaluationInput): PatternPriorityEvaluationResult;
}

/**
 * Standard Rule-Based Priority Evaluator (Decision-Support Only).
 * Configurable weights combining SIF severity, recurrence, trend, and barrier criticality.
 */
export class StandardHsePriorityEvaluator implements HsePriorityEvaluator {
  evaluate(pattern: PatternPriorityEvaluationInput): PatternPriorityEvaluationResult {
    const hasSifPrecursor = pattern.sifPotentials.some((s) => s) || pattern.avgSifScore >= 65;
    const isCriticalBarrier = pattern.safetyProtections.some((p) => {
      const lower = p.toLowerCase();
      return (
        lower.includes("isolation") ||
        lower.includes("lockout") ||
        lower.includes("gas") ||
        lower.includes("fall") ||
        lower.includes("confined") ||
        lower.includes("pressure") ||
        lower.includes("bop")
      );
    });

    const isGrowing = pattern.trend === "INCREASING" || pattern.trend === "NEW";
    const isHighVolume = pattern.reportCount >= 4;

    // HIGH priority trigger: Critical barrier failure + (SIF Precursor OR Growing Trend OR Cross-Site)
    if (isCriticalBarrier && (hasSifPrecursor || isGrowing || pattern.patternScope === "CROSS_SITE")) {
      return {
        priority: "HIGH",
        rationale: `Critical barrier failure (${pattern.safetyProtections.join(", ") || "Safety Protection"}) with ${
          isGrowing ? "increasing recurrence trend" : "SIF precursor potential"
        }${pattern.patternScope === "CROSS_SITE" ? " observed across multiple operating sites" : ""}. Recommended for priority HSE engineering review.`,
      };
    }

    // MEDIUM priority trigger: Multi-report pattern with verified recurrence or moderate SIF
    if (hasSifPrecursor || isHighVolume || isGrowing) {
      return {
        priority: "MEDIUM",
        rationale: `Recurring safety weakness across ${pattern.reportCount} reports with ${pattern.trend.toLowerCase()} trend. Review recommended during site HSE coordination.`,
      };
    }

    // LOW priority baseline
    return {
      priority: "LOW",
      rationale: `Stable or lower-severity recurring observation pattern across ${pattern.reportCount} reports. Monitor during routine site inspections.`,
    };
  }
}

let activePriorityEvaluator: HsePriorityEvaluator = new StandardHsePriorityEvaluator();

export function getActivePriorityEvaluator(): HsePriorityEvaluator {
  return activePriorityEvaluator;
}

export function setHsePriorityEvaluator(evaluator: HsePriorityEvaluator) {
  activePriorityEvaluator = evaluator;
}

export interface SitePriorityInput {
  criticalPrecursorCount: number;
  moderatePrecursorCount: number;
  highPriorityPatternCount: number;
  avgSifScore: number;
  totalSiteReports: number;
}

export interface SitePriorityResult {
  hsePriorityScore: number;
  priorityLevel: "CRITICAL" | "HIGH" | "ELEVATED" | "ROUTINE";
  status: "Critical" | "Watch" | "Normal";
  rankingFactors: string[];
}

/**
 * Calculates standardized Site HSE Priority Score according to corporate safety formula.
 */
export function calculateSiteHsePriorityScore(input: SitePriorityInput): SitePriorityResult {
  const {
    criticalPrecursorCount,
    moderatePrecursorCount,
    highPriorityPatternCount,
    avgSifScore,
    totalSiteReports,
  } = input;

  const severityBonus = avgSifScore >= 65 ? 5 : 0;
  const volumeTieBreaker = totalSiteReports * 0.01;

  const rawScore =
    criticalPrecursorCount * 10 +
    highPriorityPatternCount * 8 +
    moderatePrecursorCount * 3 +
    severityBonus +
    volumeTieBreaker;

  const hsePriorityScore = Math.round(rawScore * 10) / 10;

  const priorityLevel: "CRITICAL" | "HIGH" | "ELEVATED" | "ROUTINE" =
    hsePriorityScore >= 20 || criticalPrecursorCount >= 2
      ? "CRITICAL"
      : hsePriorityScore >= 10 || criticalPrecursorCount === 1
      ? "HIGH"
      : hsePriorityScore >= 4 || moderatePrecursorCount >= 1
      ? "ELEVATED"
      : "ROUTINE";

  const status: "Normal" | "Watch" | "Critical" =
    priorityLevel === "CRITICAL"
      ? "Critical"
      : priorityLevel === "HIGH" || priorityLevel === "ELEVATED"
      ? "Watch"
      : "Normal";

  const rankingFactors: string[] = [];
  if (criticalPrecursorCount > 0) {
    rankingFactors.push(`${criticalPrecursorCount} Critical Precursor${criticalPrecursorCount > 1 ? "s" : ""}`);
  }
  if (highPriorityPatternCount > 0) {
    rankingFactors.push(`${highPriorityPatternCount} High Priority Pattern${highPriorityPatternCount > 1 ? "s" : ""}`);
  }
  if (moderatePrecursorCount > 0) {
    rankingFactors.push(`${moderatePrecursorCount} Moderate Precursor${moderatePrecursorCount > 1 ? "s" : ""}`);
  }
  if (severityBonus > 0) {
    rankingFactors.push("High Mean Severity Bonus (+5)");
  }

  return {
    hsePriorityScore,
    priorityLevel,
    status,
    rankingFactors,
  };
}
