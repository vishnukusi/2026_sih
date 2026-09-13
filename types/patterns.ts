/**
 * Canonical Pattern Intelligence Domain Types
 */

import type { CardData } from "./concerns";

export type PatternConfidence = "HIGH" | "MEDIUM" | "LOW";
export type TemporalTrend = "NEW" | "INCREASING" | "STABLE" | "DECREASING" | "INSUFFICIENT_DATA";
export type HsePriority = "HIGH" | "MEDIUM" | "LOW";

export interface PatternSourceReport {
  id: string;
  date: string;
  location: string;
  activity: string;
  observation: string;
  failedBarrier?: string;
  failedBarrierType?: string;
  sifCategory?: string;
  sifScore?: number;
  evidenceQuote?: string;
}

export interface PatternEvidence {
  sharedSafetyProtection?: string;
  sharedFailureState?: string;
  sharedActivity?: string;
  sharedLsr?: string;
  semanticRelationship: string;
  edgeReasons: string[];
  pairwiseLinkExplanations: Array<{
    reportPair: [string, string];
    reasons: string[];
    explanation: string;
  }>;
  sourceReports: PatternSourceReport[];
}

export interface WarningPatternRecord {
  patternId: string;
  title: string;
  reportIds: string[];
  reportCount: number;
  distinctDates: string[];
  activities: string[];
  locations: string[];
  safetyProtections: string[];
  failureStates: string[];
  lifeSavingRules: string[];
  patternConfidence: PatternConfidence;
  trend: TemporalTrend;
  trendMetrics: {
    recentShare: number;
    previousShare: number;
    recentReports: number;
    previousReports: number;
    totalAnalyzedInWindow: number;
  };
  hsePriority: HsePriority;
  priorityRationale: string;
  evidence: PatternEvidence;
  patternScope: "LOCAL" | "CROSS_SITE";
  createdAt: string;
  updatedAt: string;
  disclaimer: string;
}

export interface PatternEngineConfig {
  /** Minimum unique reports required to declare a pattern (default: 3) */
  minReports: number;
  /** Minimum distinct reporting dates required (default: 2) */
  minDistinctDates: number;
  /** Rolling analysis window in days (default: 90) */
  analysisWindowDays: number;
  /** Initial configurable experimental semantic similarity threshold (default: 0.55) */
  semanticSimilarityThreshold: number;
  /** Minimum cluster internal edge density to validate coherence (default: 0.40) */
  minClusterDensity: number;
}

export interface NormalizedSafetyFact {
  source_report_id: string;
  normalized_activity: string;
  normalized_location: string;
  normalized_hazard: string;
  normalized_safety_protection: string;
  normalized_failure_state: string;
  normalized_lsr: string[];
  normalized_issue_summary: string;
  dateStr: string;
  epochMs: number;
  duplicateFingerprint: string;
  rawCard: CardData;
  hasFailureEvidence: boolean;
}

export interface PatternExtractionResult {
  patterns: WarningPatternRecord[];
  totalAnalyzed: number;
  validNonDuplicateCount: number;
  clustersDetected: number;
  extractedAt: string;
}
