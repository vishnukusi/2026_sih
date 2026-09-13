/**
 * Main Pattern Intelligence Engine
 *
 * Ingests safety cards, builds explainable graph, clusters coherent warning patterns.
 * Employs `@/lib/prioritization` for HSE priority signal evaluation.
 */

import type {
  CardData,
  NormalizedSafetyFact,
  PatternEngineConfig,
  PatternExtractionResult,
  PatternSourceReport,
  WarningPatternRecord,
  HsePriority,
} from "../../types";
import { normalizeCard, filterExactDuplicates } from "./normalization";
import { computeHybridSimilarity } from "./similarity";
import {
  buildCandidatePairs,
  validateClusterCoherence,
  generatePatternTitle,
  type PatternEdge,
} from "./clustering";
import { calculateTemporalTrend, calculatePatternConfidence } from "./trends";
import { getActivePriorityEvaluator } from "../prioritization";

export const DEFAULT_PATTERN_CONFIG: PatternEngineConfig = {
  minReports: 3,
  minDistinctDates: 2,
  analysisWindowDays: 90,
  semanticSimilarityThreshold: 0.55,
  minClusterDensity: 0.4,
};

interface PatternCacheEntry {
  key: string;
  timestamp: number;
  result: PatternExtractionResult;
}
let patternCache: PatternCacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000;

export function invalidatePatternCache() {
  patternCache = null;
}

/**
 * Main Pattern Intelligence Engine entrypoint.
 */
export async function extractWarningPatterns(
  cards?: CardData[],
  customConfig?: Partial<PatternEngineConfig>
): Promise<PatternExtractionResult> {
  const config: PatternEngineConfig = { ...DEFAULT_PATTERN_CONFIG, ...customConfig };

  let inputCards = cards;
  if (!inputCards) {
    const { getBoard } = await import("../data/concerns");
    const board = await getBoard();
    inputCards = [];
    for (const col of board) {
      for (const card of col.cards) {
        if (!card.id.match(/^c-[1-4]$/)) {
          inputCards.push(card);
        }
      }
    }
  }

  const idsHash = inputCards.map((c) => c.id || c.title || "").sort().join(",");
  const cacheKey = `${idsHash}:${config.minReports}:${config.minDistinctDates}:${config.semanticSimilarityThreshold}`;
  if (patternCache && patternCache.key === cacheKey && Date.now() - patternCache.timestamp < CACHE_TTL_MS) {
    return patternCache.result;
  }

  const rawFacts: NormalizedSafetyFact[] = [];
  for (const card of inputCards) {
    const norm = normalizeCard(card);
    if (norm) rawFacts.push(norm);
  }

  const validFacts = filterExactDuplicates(rawFacts);
  const allValidEpochs = validFacts.map((f) => f.epochMs);

  if (validFacts.length < config.minReports) {
    const emptyResult: PatternExtractionResult = {
      patterns: [],
      totalAnalyzed: inputCards.length,
      validNonDuplicateCount: validFacts.length,
      clustersDetected: 0,
      extractedAt: new Date().toISOString(),
    };
    patternCache = { key: cacheKey, timestamp: Date.now(), result: emptyResult };
    return emptyResult;
  }

  const candidatePairs = buildCandidatePairs(validFacts);

  const graphEdges: PatternEdge[] = [];
  const adjacency = new Map<number, number[]>();

  for (let i = 0; i < validFacts.length; i++) {
    adjacency.set(i, []);
  }

  for (const [idxA, idxB] of candidatePairs) {
    const factA = validFacts[idxA];
    const factB = validFacts[idxB];

    const match = computeHybridSimilarity(factA, factB, config);
    if (match) {
      graphEdges.push({
        sourceId: factA.source_report_id,
        targetId: factB.source_report_id,
        weight: match.similarity,
        reasons: match.reasons,
        explanation: match.explanation,
      });

      adjacency.get(idxA)!.push(idxB);
      adjacency.get(idxB)!.push(idxA);
    }
  }

  const visited = new Set<number>();
  const rawClusters: number[][] = [];

  for (let i = 0; i < validFacts.length; i++) {
    if (!visited.has(i)) {
      const component: number[] = [];
      const queue: number[] = [i];
      visited.add(i);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        component.push(curr);

        for (const neighbor of adjacency.get(curr) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      if (component.length >= config.minReports) {
        rawClusters.push(component);
      }
    }
  }

  const patterns: WarningPatternRecord[] = [];
  let patternCounter = 1;

  for (const clusterIndices of rawClusters) {
    const isCoherent = validateClusterCoherence(clusterIndices, graphEdges, validFacts, config.minClusterDensity);
    if (!isCoherent) {
      continue;
    }

    const clusterFacts = clusterIndices.map((idx) => validFacts[idx]);

    const distinctDates = Array.from(new Set(clusterFacts.map((f) => f.dateStr))).sort();
    if (distinctDates.length < config.minDistinctDates) {
      continue;
    }

    const locations = Array.from(new Set(clusterFacts.map((f) => f.rawCard.site_location || f.normalized_location))).filter(
      Boolean
    );
    const activities = Array.from(
      new Set(clusterFacts.map((f) => f.rawCard.operational_activity || f.normalized_activity))
    ).filter(Boolean);
    const safetyProtections = Array.from(
      new Set(clusterFacts.map((f) => f.rawCard.failed_barrier || f.normalized_safety_protection))
    ).filter(Boolean);
    const failureStates = Array.from(
      new Set(clusterFacts.map((f) => f.rawCard.failed_barrier_type || f.normalized_failure_state))
    ).filter(Boolean);
    const lifeSavingRules = Array.from(new Set(clusterFacts.flatMap((f) => f.normalized_lsr))).filter(Boolean);

    const patternScope: "LOCAL" | "CROSS_SITE" = locations.length > 1 ? "CROSS_SITE" : "LOCAL";

    const clusterReportIds = new Set(clusterFacts.map((f) => f.source_report_id));
    const clusterEdges = graphEdges.filter(
      (e) => clusterReportIds.has(e.sourceId) && clusterReportIds.has(e.targetId)
    );

    const edgeReasons = Array.from(new Set(clusterEdges.flatMap((e) => e.reasons)));
    const pairwiseExplanations = clusterEdges.slice(0, 5).map((e) => ({
      reportPair: [e.sourceId, e.targetId] as [string, string],
      reasons: e.reasons,
      explanation: e.explanation,
    }));

    const title = generatePatternTitle(clusterFacts);
    const confidence = calculatePatternConfidence(clusterFacts.length, distinctDates.length, edgeReasons);

    const clusterEpochs = clusterFacts.map((f) => f.epochMs);
    const trendResult = calculateTemporalTrend(clusterEpochs, allValidEpochs, config.analysisWindowDays);

    const sifPotentials = clusterFacts.map((f) => Boolean(f.rawCard.sif_potential));
    const avgSifScore = Math.round(
      clusterFacts.reduce((sum, f) => sum + (f.rawCard.sif_score || 0), 0) / clusterFacts.length
    );

    const priorityResult = getActivePriorityEvaluator().evaluate({
      reportCount: clusterFacts.length,
      distinctDates,
      trend: trendResult.trend,
      confidence,
      safetyProtections,
      failureStates,
      sifPotentials,
      avgSifScore,
      patternScope,
    });

    const sourceReports: PatternSourceReport[] = clusterFacts.map((f) => ({
      id: f.source_report_id,
      date: f.dateStr,
      location: f.rawCard.site_location || f.normalized_location,
      activity: f.rawCard.operational_activity || f.normalized_activity,
      observation: f.rawCard.observation || f.rawCard.title,
      failedBarrier: f.rawCard.failed_barrier,
      failedBarrierType: f.rawCard.failed_barrier_type,
      sifCategory: f.rawCard.sif_category,
      sifScore: f.rawCard.sif_score,
      evidenceQuote: f.rawCard.evidence_quote,
    }));

    const patternRecord: WarningPatternRecord = {
      patternId: `WP-2026-${String(patternCounter++).padStart(3, "0")}`,
      title,
      reportIds: clusterFacts.map((f) => f.source_report_id),
      reportCount: clusterFacts.length,
      distinctDates,
      activities,
      locations,
      safetyProtections,
      failureStates,
      lifeSavingRules,
      patternConfidence: confidence,
      trend: trendResult.trend,
      trendMetrics: {
        recentShare: trendResult.recentShare,
        previousShare: trendResult.previousShare,
        recentReports: trendResult.recentReports,
        previousReports: trendResult.previousReports,
        totalAnalyzedInWindow: trendResult.totalAnalyzedInWindow,
      },
      hsePriority: priorityResult.priority,
      priorityRationale: priorityResult.rationale,
      evidence: {
        sharedSafetyProtection: safetyProtections[0] || "Safety Control",
        sharedFailureState: failureStates[0] || "Verification Gap",
        sharedActivity: activities[0] || "Operations",
        sharedLsr: lifeSavingRules[0] || undefined,
        semanticRelationship:
          pairwiseExplanations[0]?.explanation || "Semantic agreement across diverse operational phrasing",
        edgeReasons,
        pairwiseLinkExplanations: pairwiseExplanations,
        sourceReports,
      },
      patternScope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      disclaimer:
        "DECISION SUPPORT ONLY. Surfaces recurring safety warning precursors requiring HSE attention. Does not predict accidents, guarantee outcomes, or calculate harm probability.",
    };

    patterns.push(patternRecord);
  }

  const priorityOrder: Record<HsePriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  patterns.sort((a, b) => {
    const diff = priorityOrder[b.hsePriority] - priorityOrder[a.hsePriority];
    if (diff !== 0) return diff;
    return b.reportCount - a.reportCount;
  });

  const finalResult: PatternExtractionResult = {
    patterns,
    totalAnalyzed: inputCards.length,
    validNonDuplicateCount: validFacts.length,
    clustersDetected: patterns.length,
    extractedAt: new Date().toISOString(),
  };

  patternCache = {
    key: cacheKey,
    timestamp: Date.now(),
    result: finalResult,
  };

  return finalResult;
}
