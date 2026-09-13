/**
 * Semantic & Hybrid Similarity Computation
 */

import type { NormalizedSafetyFact, PatternEngineConfig } from "../../types";

export const SAFETY_DOMAINS = [
  {
    domain: "Energy Isolation",
    barrierTerms: ["isolation", "lockout", "tagout", "loto", "breaker", "switchgear", "valve", "electrical"],
    failureTerms: ["skipped", "not verified", "energized", "zero energy", "previous shift", "live", "unlocked", "no tag"],
  },
  {
    domain: "Confined Space",
    barrierTerms: ["confined space", "vessel entry", "manhole", "tank", "cellar", "pit"],
    failureTerms: ["gas test", "atmosphere", "toxic", "h2s", "lel", "oxygen", "standby", "ventilation", "continuous monitor"],
  },
  {
    domain: "Work at Height",
    barrierTerms: ["fall protection", "harness", "lanyard", "tie off", "anchor", "scaffolding", "ladder", "derrick"],
    failureTerms: ["not tied off", "100%", "unsecured", "unclipped", "missing toe board", "missing guardrail"],
  },
  {
    domain: "Safe Lifting",
    barrierTerms: ["crane", "lifting", "rigging", "sling", "shackle", "hoist", "drop zone"],
    failureTerms: ["uninspected", "frayed", "damaged sling", "under load", "tag line", "sway", "exceeded limit"],
  },
  {
    domain: "Hot Work",
    barrierTerms: ["hot work", "welding", "cutting", "grinding", "spark", "flame"],
    failureTerms: ["flammable vapor", "gas test", "fire watch", "combustible", "unshielded"],
  },
  {
    domain: "Bypassing Controls",
    barrierTerms: ["interlock", "safety switch", "trip", "alarm", "sensor", "relief valve", "bop"],
    failureTerms: ["bypassed", "overridden", "jumper", "defeated", "gagged", "disabled"],
  },
];

export function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const tokens = new Set<string>(words);

  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(`${words[i]} ${words[i + 1]}`);
  }

  return tokens;
}

export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function evaluateDomainAlignment(
  a: NormalizedSafetyFact,
  b: NormalizedSafetyFact
): { alignedDomain: string | null; score: number } {
  const textA = `${a.normalized_issue_summary} ${a.normalized_safety_protection} ${a.normalized_failure_state} ${a.normalized_hazard}`.toLowerCase();
  const textB = `${b.normalized_issue_summary} ${b.normalized_safety_protection} ${b.normalized_failure_state} ${b.normalized_hazard}`.toLowerCase();

  for (const cat of SAFETY_DOMAINS) {
    const hasBarrierA = cat.barrierTerms.some((t) => textA.includes(t));
    const hasBarrierB = cat.barrierTerms.some((t) => textB.includes(t));
    const hasFailureA = cat.failureTerms.some((t) => textA.includes(t));
    const hasFailureB = cat.failureTerms.some((t) => textB.includes(t));

    if (hasBarrierA && hasBarrierB && hasFailureA && hasFailureB) {
      return { alignedDomain: cat.domain, score: 0.85 };
    }
    if ((hasBarrierA && hasBarrierB) || (hasFailureA && hasFailureB)) {
      return { alignedDomain: cat.domain, score: 0.5 };
    }
  }

  return { alignedDomain: null, score: 0 };
}

export function computeHybridSimilarity(
  a: NormalizedSafetyFact,
  b: NormalizedSafetyFact,
  config: PatternEngineConfig
): { similarity: number; reasons: string[]; explanation: string } | null {
  const reasons: string[] = [];
  const explanationParts: string[] = [];

  let structuredScore = 0;

  // 1. Safety Protection / Failed Barrier Agreement (Weight: 0.30)
  const barrierA = a.normalized_safety_protection;
  const barrierB = b.normalized_safety_protection;
  const tokensProtA = tokenize(barrierA);
  const tokensProtB = tokenize(barrierB);
  const hasSharedProtToken = [...tokensProtA].some((t) => tokensProtB.has(t) && !["the", "and", "for", "with"].includes(t));
  const barrierOverlap = barrierA && barrierB && (barrierA.includes(barrierB) || barrierB.includes(barrierA) || hasSharedProtToken);
  if (barrierOverlap) {
    structuredScore += 0.3;
    reasons.push("shared_safety_protection");
    explanationParts.push(`Same safety protection: "${a.rawCard.failed_barrier || barrierA}"`);
  }

  // 2. Failure State Agreement (Weight: 0.25)
  const failA = a.normalized_failure_state;
  const failB = b.normalized_failure_state;
  const tokensFailA = tokenize(failA);
  const tokensFailB = tokenize(failB);
  const hasSharedFailToken = [...tokensFailA].some((t) => tokensFailB.has(t) && !["not", "the", "and"].includes(t));
  const failOverlap = failA && failB && (failA.includes(failB) || failB.includes(failA) || hasSharedFailToken);
  if (failOverlap) {
    structuredScore += 0.25;
    reasons.push("shared_failure_state");
    explanationParts.push(`Similar failure state: "${a.rawCard.failed_barrier_type || failA}"`);
  }

  // 3. Operational Activity Agreement (Weight: 0.15)
  const actA = a.normalized_activity;
  const actB = b.normalized_activity;
  const tokensActA = tokenize(actA);
  const tokensActB = tokenize(actB);
  const hasSharedActToken = [...tokensActA].some((t) => tokensActB.has(t) && !["and", "the", "for"].includes(t));
  const actOverlap = actA && actB && (actA.includes(actB) || actB.includes(actA) || hasSharedActToken);
  if (actOverlap) {
    structuredScore += 0.15;
    reasons.push("shared_activity");
    explanationParts.push(`Related operational activity: "${a.rawCard.operational_activity || actA}"`);
  }

  // 4. Site Location (Weight: 0.10)
  const locA = a.normalized_location;
  const locB = b.normalized_location;
  if (locA && locB && locA === locB) {
    structuredScore += 0.1;
    reasons.push("shared_location");
    explanationParts.push(`Same operational site: "${a.rawCard.site_location || locA}"`);
  }

  // 5. Life Saving Rules (Weight: 0.10)
  const sharedLsr = a.normalized_lsr.filter((rule) => b.normalized_lsr.includes(rule));
  if (sharedLsr.length > 0) {
    structuredScore += 0.1;
    reasons.push("shared_lsr");
    explanationParts.push(`Shared Life-Saving Rule: ${sharedLsr.join(", ")}`);
  }

  // 6. Semantic Similarity
  const tokensA = tokenize(`${a.normalized_issue_summary} ${a.normalized_hazard}`);
  const tokensB = tokenize(`${b.normalized_issue_summary} ${b.normalized_hazard}`);
  const lexicalJaccard = jaccardSimilarity(tokensA, tokensB);

  const domainAlignment = evaluateDomainAlignment(a, b);
  const semanticScore = Math.max(lexicalJaccard, domainAlignment.score);

  if (semanticScore >= config.semanticSimilarityThreshold) {
    reasons.push("semantic_similarity");
    explanationParts.push(
      domainAlignment.alignedDomain
        ? `Different wording describing the same safety domain (${domainAlignment.alignedDomain})`
        : `Semantic phrasing similarity (${Math.round(semanticScore * 100)}% match)`
    );
  }

  const totalScore = Math.min(1.0, structuredScore * 0.5 + semanticScore * 0.5);

  const hasSubstantiveLink =
    (reasons.includes("shared_safety_protection") &&
      (reasons.includes("shared_failure_state") ||
        reasons.includes("semantic_similarity") ||
        reasons.includes("shared_activity"))) ||
    (reasons.includes("shared_failure_state") && reasons.includes("semantic_similarity")) ||
    (reasons.includes("semantic_similarity") && domainAlignment.score >= 0.8 && reasons.includes("shared_activity"));

  if (totalScore >= config.semanticSimilarityThreshold && hasSubstantiveLink) {
    return {
      similarity: totalScore,
      reasons,
      explanation: explanationParts.join(" • "),
    };
  }

  return null;
}
