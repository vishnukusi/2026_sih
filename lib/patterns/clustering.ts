/**
 * Graph Candidate Matching & Cluster Coherence Validation
 */

import type { NormalizedSafetyFact } from "../../types";
import { cleanNormalizeStr } from "./normalization";
import { SAFETY_DOMAINS } from "./similarity";

export interface PatternEdge {
  sourceId: string;
  targetId: string;
  weight: number;
  reasons: string[];
  explanation: string;
}

/**
 * Builds candidate pairs using structured dimension buckets to avoid O(N^2) brute-force.
 */
export function buildCandidatePairs(facts: NormalizedSafetyFact[]): [number, number][] {
  const buckets = new Map<string, number[]>();

  const addToBucket = (key: string, idx: number) => {
    if (!key || key.length < 3) return;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(idx);
  };

  facts.forEach((fact, idx) => {
    if (fact.normalized_safety_protection) {
      addToBucket(`prot:${fact.normalized_safety_protection}`, idx);
      for (const w of fact.normalized_safety_protection.split(" ")) {
        if (w.length > 3) addToBucket(`prot_w:${w}`, idx);
      }
    }
    if (fact.normalized_failure_state) {
      addToBucket(`fail:${fact.normalized_failure_state}`, idx);
      for (const w of fact.normalized_failure_state.split(" ")) {
        if (w.length > 3) addToBucket(`fail_w:${w}`, idx);
      }
    }
    if (fact.normalized_activity) {
      addToBucket(`act:${fact.normalized_activity}`, idx);
      for (const w of fact.normalized_activity.split(" ")) {
        if (w.length > 3) addToBucket(`act_w:${w}`, idx);
      }
    }
    if (fact.normalized_hazard) {
      addToBucket(`haz:${fact.normalized_hazard}`, idx);
    }
    if (fact.normalized_location) {
      addToBucket(`loc:${fact.normalized_location}`, idx);
    }
    for (const lsr of fact.normalized_lsr) {
      addToBucket(`lsr:${cleanNormalizeStr(lsr)}`, idx);
    }

    const combined = `${fact.normalized_issue_summary} ${fact.normalized_safety_protection}`.toLowerCase();
    for (const d of SAFETY_DOMAINS) {
      if (d.barrierTerms.some((t) => combined.includes(t)) || d.failureTerms.some((t) => combined.includes(t))) {
        addToBucket(`domain:${d.domain}`, idx);
      }
    }
  });

  const pairSet = new Set<string>();
  const candidatePairs: [number, number][] = [];

  for (const indices of buckets.values()) {
    if (indices.length > 1) {
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const idxA = Math.min(indices[i], indices[j]);
          const idxB = Math.max(indices[i], indices[j]);
          const key = `${idxA}:${idxB}`;
          if (!pairSet.has(key)) {
            pairSet.add(key);
            candidatePairs.push([idxA, idxB]);
          }
        }
      }
    }
  }

  return candidatePairs;
}

/**
 * Evaluates internal cluster coherence to prevent loose transitive chaining.
 */
export function validateClusterCoherence(
  memberIndices: number[],
  edges: PatternEdge[],
  facts: NormalizedSafetyFact[],
  minDensity: number
): boolean {
  if (memberIndices.length < 3) return false;

  const memberSet = new Set(memberIndices.map((idx) => facts[idx].source_report_id));

  let internalEdgeCount = 0;
  for (const edge of edges) {
    if (memberSet.has(edge.sourceId) && memberSet.has(edge.targetId)) {
      internalEdgeCount++;
    }
  }

  const n = memberIndices.length;
  const maxEdges = (n * (n - 1)) / 2;
  const density = maxEdges > 0 ? internalEdgeCount / maxEdges : 0;

  if (density >= minDensity) {
    return true;
  }

  const protections = memberIndices.map((i) => facts[i].normalized_safety_protection);
  const failureStates = memberIndices.map((i) => facts[i].normalized_failure_state);

  const mostFrequent = (arr: string[]) => {
    const counts = new Map<string, number>();
    for (const v of arr) {
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    let maxV = "";
    let maxC = 0;
    for (const [k, c] of counts) {
      if (c > maxC) {
        maxC = c;
        maxV = k;
      }
    }
    return { val: maxV, ratio: arr.length > 0 ? maxC / arr.length : 0 };
  };

  const topProt = mostFrequent(protections);
  const topFail = mostFrequent(failureStates);

  return topProt.ratio >= 0.7 || topFail.ratio >= 0.7;
}

export function generatePatternTitle(facts: NormalizedSafetyFact[]): string {
  const getTop = (arr: string[], fallback: string) => {
    const counts = new Map<string, number>();
    for (const val of arr) {
      if (val && val.trim()) counts.set(val.trim(), (counts.get(val.trim()) || 0) + 1);
    }
    let top = fallback;
    let max = 0;
    for (const [k, c] of counts) {
      if (c > max) {
        max = c;
        top = k;
      }
    }
    return top;
  };

  const rawBarriers = facts.map((f) => f.rawCard.failed_barrier || f.normalized_safety_protection);
  const rawFailures = facts.map((f) => f.rawCard.failed_barrier_type || f.normalized_failure_state);
  const rawActivities = facts.map((f) => f.rawCard.operational_activity || f.normalized_activity);
  const rawLsrs = facts.flatMap((f) => f.normalized_lsr);

  const dominantBarrier = getTop(rawBarriers, "Safety Control");
  const dominantFailure = getTop(rawFailures, "Verification Gap");
  const dominantActivity = getTop(rawActivities, "Operations");
  const dominantLsr = getTop(rawLsrs, "");

  const lowerB = dominantBarrier.toLowerCase();

  if (lowerB.includes("isolation") || lowerB.includes("lockout") || dominantLsr.includes("Energy Isolation")) {
    return `Repeated Energy Isolation Verification Failures During ${capitalizeWords(dominantActivity)}`;
  }

  if (lowerB.includes("gas") || lowerB.includes("confined") || dominantLsr.includes("Confined Space")) {
    return `Recurring Gas Testing Gaps During Confined-Space Entry`;
  }

  if (lowerB.includes("fall") || dominantLsr.includes("Height")) {
    return `Repeated Fall Protection Verification Gaps During ${capitalizeWords(dominantActivity)}`;
  }

  if (lowerB.includes("lift") || dominantLsr.includes("Lifting")) {
    return `Repeated Rigging & Mechanical Lifting Controls Breaches`;
  }

  if (lowerB.includes("hot work") || dominantLsr.includes("Hot Work")) {
    return `Recurring Flammable Vapor Control Gaps During Hot Work`;
  }

  return `Recurring ${capitalizeWords(dominantBarrier)} ${capitalizeWords(dominantFailure)} During ${capitalizeWords(
    dominantActivity
  )}`;
}

export function capitalizeWords(str: string): string {
  if (!str) return "";
  return str
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
