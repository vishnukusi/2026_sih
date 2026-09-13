/**
 * Temporal Trend & Pattern Confidence Calculations
 */

import type { PatternConfidence, TemporalTrend } from "../../types";

/**
 * Calculates temporal trend based on PATTERN SHARE:
 * pattern reports in period / all valid analyzed reports in period
 * Compares equal recent and previous windows.
 */
export function calculateTemporalTrend(
  patternEpochs: number[],
  allValidEpochs: number[],
  windowDays: number
): {
  trend: TemporalTrend;
  recentShare: number;
  previousShare: number;
  recentReports: number;
  previousReports: number;
  totalAnalyzedInWindow: number;
} {
  const now = Date.now();
  const halfWindowMs = (windowDays / 2) * 24 * 60 * 60 * 1000;
  const fullWindowMs = windowDays * 24 * 60 * 60 * 1000;

  const recentStart = now - halfWindowMs;
  const previousStart = now - fullWindowMs;

  const recentPattern = patternEpochs.filter((ep) => ep >= recentStart).length;
  const previousPattern = patternEpochs.filter((ep) => ep >= previousStart && ep < recentStart).length;

  const totalRecent = allValidEpochs.filter((ep) => ep >= recentStart).length;
  const totalPrevious = allValidEpochs.filter((ep) => ep >= previousStart && ep < recentStart).length;

  const totalAnalyzedInWindow = totalRecent + totalPrevious;

  if (totalAnalyzedInWindow < 4) {
    return {
      trend: "INSUFFICIENT_DATA",
      recentShare: 0,
      previousShare: 0,
      recentReports: recentPattern,
      previousReports: previousPattern,
      totalAnalyzedInWindow,
    };
  }

  const recentShare = totalRecent > 0 ? recentPattern / totalRecent : 0;
  const previousShare = totalPrevious > 0 ? previousPattern / totalPrevious : 0;

  let trend: TemporalTrend = "STABLE";
  if (previousShare === 0 && recentShare > 0) {
    trend = "NEW";
  } else if (recentShare > previousShare * 1.15) {
    trend = "INCREASING";
  } else if (recentShare < previousShare * 0.85) {
    trend = "DECREASING";
  } else {
    trend = "STABLE";
  }

  return {
    trend,
    recentShare: Math.round(recentShare * 1000) / 1000,
    previousShare: Math.round(previousShare * 1000) / 1000,
    recentReports: recentPattern,
    previousReports: previousPattern,
    totalAnalyzedInWindow,
  };
}

export function calculatePatternConfidence(
  reportCount: number,
  distinctDatesCount: number,
  edgeReasons: string[]
): PatternConfidence {
  const hasStrongProtectionAgreement = edgeReasons.includes("shared_safety_protection");
  const hasSemanticConfirmation = edgeReasons.includes("semantic_similarity");

  if (reportCount >= 5 && distinctDatesCount >= 3 && hasStrongProtectionAgreement && hasSemanticConfirmation) {
    return "HIGH";
  }

  if (reportCount >= 3 && distinctDatesCount >= 2 && (hasStrongProtectionAgreement || hasSemanticConfirmation)) {
    return "MEDIUM";
  }

  return "LOW";
}
