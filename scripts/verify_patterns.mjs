/**
 * SENTINELSIF AI — CROSS-REPORT WARNING PATTERN ENGINE TEST SUITE
 *
 * Verifies all 9 core domain tests (A through I) plus architectural invariants:
 * - TEST A: Different wording, same Energy Isolation failure -> ONE recurring pattern.
 * - TEST B: Different wording, same Confined Space gas-testing failure -> ONE recurring pattern.
 * - TEST C: Same keyword but compliant statement -> NOT treated as a failure pattern.
 * - TEST D: Same issue, different sites -> Cross-site pattern detected.
 * - TEST E: Same report duplicated 5 times -> Exact duplicates suppressed, no false pattern.
 * - TEST F: Only one report -> No recurring pattern.
 * - TEST G: Two reports on one date -> No recurring pattern (requires min 2 distinct dates).
 * - TEST H: Pattern count increases but total reporting volume also increases -> Trend based on pattern share.
 * - TEST I: Insufficient historical data -> INSUFFICIENT_DATA.
 * - TEST J: Cluster coherence validation prevents loose transitive chaining.
 * - TEST K: Mixed report (compliance + failure) is retained for analysis.
 * - TEST L: LSR alone is NOT sufficient evidence for grouping.
 * - TEST M: Auth protection on /api/patterns endpoint.
 */

import {
  extractWarningPatterns,
  calculateTemporalTrend,
  normalizeCard,
  filterExactDuplicates,
  computeHybridSimilarity,
  validateClusterCoherence,
  DEFAULT_PATTERN_CONFIG,
} from "../lib/patterns.ts";
import { createSessionToken, verifySessionToken } from "../lib/auth.ts";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n==================================================");
  console.log("SENTINELSIF AI — WARNING PATTERN ENGINE TEST SUITE");
  console.log("==================================================\n");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST A: Different wording, same Energy Isolation failure
  // ──────────────────────────────────────────────────────────────────────────
  console.log("=== TEST A: Different Wording, Same Energy Isolation Failure ===");
  const testACards = [
    {
      id: "R-101",
      title: "Isolation skipped on pump switchgear",
      observation: "Isolation verification was skipped before beginning pump maintenance.",
      failed_barrier: "Positive Isolation",
      failed_barrier_type: "Verification Skipped",
      operational_activity: "Switchgear Maintenance",
      site_location: "Moran Rig #04",
      date: "Sep 01",
      iogp_rule: "Energy Isolation",
      sif_potential: true,
      sif_score: 75,
    },
    {
      id: "R-102",
      title: "Equipment remained energized during overhaul",
      observation: "Equipment remained energized when electrical maintenance began.",
      failed_barrier: "Energy Isolation LOTO",
      failed_barrier_type: "Zero Energy Not Confirmed",
      operational_activity: "Switchgear Maintenance",
      site_location: "Moran Rig #04",
      date: "Sep 02",
      iogp_rule: "Energy Isolation",
      sif_potential: true,
      sif_score: 80,
    },
    {
      id: "R-103",
      title: "Zero-energy confirmation not performed",
      observation: "Zero-energy confirmation was not performed before opening MCC breaker box.",
      failed_barrier: "Positive Isolation",
      failed_barrier_type: "Verification Skipped",
      operational_activity: "Switchgear Maintenance",
      site_location: "Moran Rig #04",
      date: "Sep 03",
      iogp_rule: "Energy Isolation",
      sif_potential: true,
      sif_score: 78,
    },
  ];

  const resultA = await extractWarningPatterns(testACards);
  assert(resultA.patterns.length === 1, `Expected exactly 1 recurring pattern, found ${resultA.patterns.length}`);
  if (resultA.patterns.length === 1) {
    const p = resultA.patterns[0];
    assert(p.title.includes("Energy Isolation"), `Title reflects Energy Isolation: "${p.title}"`);
    assert(p.reportCount === 3, `Pattern contains all 3 reports (found ${p.reportCount})`);
    assert(p.distinctDates.length === 3, `Pattern spans 3 distinct dates (found ${p.distinctDates.length})`);
    assert(p.evidence.pairwiseLinkExplanations.length > 0, "Audit evidence contains link explanations");
    assert(p.hsePriority === "HIGH" || p.hsePriority === "MEDIUM", `HSE Priority signal generated: ${p.hsePriority}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST B: Different wording, same Confined Space gas-testing failure
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST B: Different Wording, Same Confined Space Gas-Testing Failure ===");
  const testBCards = [
    {
      id: "R-201",
      title: "Atmospheric test skipped at vessel entry",
      observation: "Atmospheric gas test was not conducted prior to technician entering separator tank.",
      failed_barrier: "Gas Testing",
      failed_barrier_type: "Atmospheric Testing Skipped",
      operational_activity: "Vessel Cleanout",
      site_location: "Naharkatiya OCS-1",
      date: "Sep 01",
      iogp_rule: "Confined Space Entry",
      sif_potential: true,
      sif_score: 85,
    },
    {
      id: "R-202",
      title: "Tank entry without continuous toxic gas monitoring",
      observation: "Technicians entered confined vessel cellar with no gas test performed for H2S and LEL.",
      failed_barrier: "Continuous Gas Monitoring",
      failed_barrier_type: "Atmospheric Testing Skipped",
      operational_activity: "Vessel Cleanout",
      site_location: "Naharkatiya OCS-1",
      date: "Sep 03",
      iogp_rule: "Confined Space Entry",
      sif_potential: true,
      sif_score: 90,
    },
    {
      id: "R-203",
      title: "Oxygen and toxic gas meter not used before tank entry",
      observation: "Multi-gas detector was uncalibrated and continuous atmosphere monitoring skipped during confined space entry.",
      failed_barrier: "Gas Testing",
      failed_barrier_type: "Atmospheric Testing Skipped",
      operational_activity: "Vessel Cleanout",
      site_location: "Naharkatiya OCS-1",
      date: "Sep 05",
      iogp_rule: "Toxic Gas & Atmosphere",
      sif_potential: true,
      sif_score: 88,
    },
  ];

  const resultB = await extractWarningPatterns(testBCards);
  assert(resultB.patterns.length === 1, `Expected exactly 1 Confined Space pattern, found ${resultB.patterns.length}`);
  if (resultB.patterns.length === 1) {
    const p = resultB.patterns[0];
    assert(
      p.title.toLowerCase().includes("gas") || p.title.toLowerCase().includes("confined"),
      `Title reflects gas/confined space: "${p.title}"`
    );
    assert(p.reportCount === 3, `Pattern contains 3 reports`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST C: Same keyword but compliant statement
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST C: Same Keyword But Pure Compliant Statement ===");
  const testCCards = [
    {
      id: "R-301",
      title: "Lockout completed and verified",
      observation: "Lockout was completed and independently verified with zero energy confirmed.",
      failed_barrier: "Positive Isolation",
      failed_barrier_type: "Verified Compliant",
      operational_activity: "Routine Servicing",
      site_location: "Duliajan Central GGS",
      date: "Sep 01",
    },
    {
      id: "R-302",
      title: "Zero energy confirmed properly",
      observation: "Electrical breaker was properly isolated and locked. Verified and signed off by supervisor.",
      failed_barrier: "Positive Isolation",
      failed_barrier_type: "Verified Compliant",
      operational_activity: "Routine Servicing",
      site_location: "Duliajan Central GGS",
      date: "Sep 02",
    },
    {
      id: "R-303",
      title: "Passed safety inspection",
      observation: "Passed safety inspection with no breach observed and clear of hazards.",
      failed_barrier: "Positive Isolation",
      failed_barrier_type: "Verified Compliant",
      operational_activity: "Routine Servicing",
      site_location: "Duliajan Central GGS",
      date: "Sep 03",
    },
  ];

  const resultC = await extractWarningPatterns(testCCards);
  assert(resultC.patterns.length === 0, `Compliant statements must NOT form a failure pattern (found ${resultC.patterns.length})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST D: Same issue, different sites (Cross-Site Pattern)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST D: Cross-Site Warning Pattern ===");
  const testDCards = [
    {
      id: "R-401",
      title: "Fall protection harness unhooked at Rig 4",
      observation: "Roustabout working at 12m elevation was not tied off. 100% tie-off was skipped.",
      failed_barrier: "Fall Protection",
      failed_barrier_type: "Not Tied Off",
      operational_activity: "Derrick Mast Maintenance",
      site_location: "Moran Rig #04",
      date: "Sep 01",
      iogp_rule: "Work at Height",
      sif_potential: true,
      sif_score: 82,
    },
    {
      id: "R-402",
      title: "Lanyard detached at GGS Station",
      observation: "Technician on pipe rack walkway unclipped harness lanyard while traversing girder without fall protection.",
      failed_barrier: "Fall Protection",
      failed_barrier_type: "Not Tied Off",
      operational_activity: "Pipe Rack Maintenance",
      site_location: "Duliajan Central GGS",
      date: "Sep 02",
      iogp_rule: "Work at Height",
      sif_potential: true,
      sif_score: 85,
    },
    {
      id: "R-403",
      title: "Height work tie-off neglected at OCS",
      observation: "Scaffolding worker detached safety harness and was working at height without anchor tie-off.",
      failed_barrier: "Fall Protection",
      failed_barrier_type: "Not Tied Off",
      operational_activity: "Scaffolding Inspection",
      site_location: "Naharkatiya OCS-1",
      date: "Sep 03",
      iogp_rule: "Work at Height",
      sif_potential: true,
      sif_score: 80,
    },
  ];

  const resultD = await extractWarningPatterns(testDCards);
  assert(resultD.patterns.length === 1, `Expected 1 cross-site pattern, found ${resultD.patterns.length}`);
  if (resultD.patterns.length === 1) {
    const p = resultD.patterns[0];
    assert(p.patternScope === "CROSS_SITE", `Pattern correctly marked as CROSS_SITE (found ${p.patternScope})`);
    assert(p.locations.length === 3, `Pattern detected across 3 distinct sites (found ${p.locations.length})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST E: Same report duplicated 5 times
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST E: Exact Duplicate Suppression ===");
  const baseCard = {
    id: "R-501",
    title: "Valve leak detected",
    observation: "Isolation valve handle was broken and leaking hydraulic fluid.",
    failed_barrier: "Physical Barrier",
    failed_barrier_type: "Damaged Equipment",
    operational_activity: "Wellhead Inspection",
    site_location: "Moran Rig #04",
    date: "Sep 01",
    duplicateFingerprint: "dup-hash-501",
  };

  const testECards = [
    { ...baseCard, id: "R-501-a" },
    { ...baseCard, id: "R-501-b" },
    { ...baseCard, id: "R-501-c" },
    { ...baseCard, id: "R-501-d" },
    { ...baseCard, id: "R-501-e" },
  ];

  const resultE = await extractWarningPatterns(testECards);
  assert(resultE.patterns.length === 0, `Exact duplicates must NOT create false recurring pattern (found ${resultE.patterns.length})`);
  assert(resultE.validNonDuplicateCount === 1, `De-duplicated to 1 valid card (found ${resultE.validNonDuplicateCount})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST F: Only one report
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST F: Single Report (Threshold Check) ===");
  const testFCards = [testACards[0]];
  const resultF = await extractWarningPatterns(testFCards);
  assert(resultF.patterns.length === 0, `Single report must NOT form recurring pattern (found ${resultF.patterns.length})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST G: Two reports on one date
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST G: Two Reports on Single Date ===");
  const testGCards = [
    { ...testACards[0], id: "R-701", date: "Sep 01" },
    { ...testACards[1], id: "R-702", date: "Sep 01" },
  ];
  const resultG = await extractWarningPatterns(testGCards);
  assert(resultG.patterns.length === 0, `Two reports on same date must NOT form pattern (requires >= 3 reports & >= 2 dates)`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST H: Pattern share vs raw count trend evaluation
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST H: Trend Evaluated by Pattern Share (Not Raw Count Alone) ===");
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Previous window (day 45 to day 90 ago):
  // 2 pattern reports out of 10 total valid reports = 20% share
  const prevPatternEpochs = [now - 60 * dayMs, now - 55 * dayMs];
  const prevTotalEpochs = [
    ...prevPatternEpochs,
    now - 70 * dayMs,
    now - 68 * dayMs,
    now - 65 * dayMs,
    now - 62 * dayMs,
    now - 58 * dayMs,
    now - 56 * dayMs,
    now - 52 * dayMs,
    now - 50 * dayMs,
  ];

  // Recent window (day 0 to day 45 ago):
  // 4 pattern reports out of 40 total valid reports (raw count doubled, but share halved to 10%!)
  const recentPatternEpochs = [now - 20 * dayMs, now - 18 * dayMs, now - 15 * dayMs, now - 10 * dayMs];
  const recentTotalEpochs = [...recentPatternEpochs];
  for (let i = 1; i <= 36; i++) {
    recentTotalEpochs.push(now - (i % 40) * dayMs);
  }

  const allPatternEpochs = [...prevPatternEpochs, ...recentPatternEpochs];
  const allValidEpochs = [...prevTotalEpochs, ...recentTotalEpochs];

  const trendResultH = calculateTemporalTrend(allPatternEpochs, allValidEpochs, 90);
  assert(
    trendResultH.trend === "DECREASING",
    `Trend based on share: pattern share dropped from 20% to ~10%, expected DECREASING (got ${trendResultH.trend})`
  );
  assert(trendResultH.recentReports === 4, `Recent pattern count is 4 (raw count doubled)`);
  assert(trendResultH.previousReports === 2, `Previous pattern count is 2`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST I: Insufficient historical data
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST I: Insufficient Historical Data ===");
  const sparsePattern = [now - 5 * dayMs];
  const sparseAll = [now - 5 * dayMs, now - 10 * dayMs]; // Total 2 reports < 4
  const trendResultI = calculateTemporalTrend(sparsePattern, sparseAll, 90);
  assert(trendResultI.trend === "INSUFFICIENT_DATA", `Expected INSUFFICIENT_DATA when sample size < 4 (got ${trendResultI.trend})`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST J: Cluster Coherence Validation (Anti-Transitive Chaining)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST J: Cluster Coherence Validation (Anti-Chaining) ===");
  // Create 3 unrelated reports that chained loosely (A-B on activity, B-C on something else)
  const factsMock = [
    { source_report_id: "A", normalized_safety_protection: "loto", normalized_failure_state: "skipped" },
    { source_report_id: "B", normalized_safety_protection: "gas detector", normalized_failure_state: "uncalibrated" },
    { source_report_id: "C", normalized_safety_protection: "fall harness", normalized_failure_state: "damaged" },
  ];
  // Only 1 edge between A-B, 1 edge between B-C (total 2 edges out of 3 possible = 0.66 density, BUT NO DOMINANT BARRIER OR FAILURE)
  const edgesMock = [
    { sourceId: "A", targetId: "B", weight: 0.55, reasons: ["shared_activity"], explanation: "same activity" },
    { sourceId: "B", targetId: "C", weight: 0.55, reasons: ["shared_activity"], explanation: "same activity" },
  ];
  // When member protections and failure states are completely discordant:
  const isCoherent = validateClusterCoherence([0, 1, 2], edgesMock, factsMock, 0.8);
  assert(!isCoherent, `Incoherent cluster without common failure domain or sufficient density is rejected`);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST K: Mixed Statement Preservation (Compliance + Failure Evidence)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST K: Mixed Statement Preservation ===");
  const mixedCard = {
    id: "R-MIX-01",
    title: "Mixed observation",
    observation: "Lockout was completed on Pump A, but zero energy confirmation was skipped on Pump B.",
    failed_barrier: "Positive Isolation",
    failed_barrier_type: "Verification Skipped",
    site_location: "Moran Rig #04",
    date: "Sep 02",
  };
  const normMixed = normalizeCard(mixedCard);
  assert(normMixed !== null, "Report with both compliance terms AND explicit failure evidence is RETAINED");
  assert(normMixed?.source_report_id === "R-MIX-01", "Mixed report preserved with correct ID");

  // ──────────────────────────────────────────────────────────────────────────
  // TEST L: LSR Alone is NOT Sufficient Evidence for Grouping
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST L: LSR Alone is NOT Sufficient Evidence ===");
  const cardLsrOnlyA = {
    source_report_id: "LSR-A",
    normalized_activity: "truck driving",
    normalized_location: "highway",
    normalized_hazard: "speeding vehicle",
    normalized_safety_protection: "seatbelt",
    normalized_failure_state: "not worn",
    normalized_lsr: ["Bypassing Safety Controls"],
    normalized_issue_summary: "driver did not buckle seatbelt during convoy transport",
    dateStr: "2026-09-01",
    epochMs: Date.now(),
    duplicateFingerprint: "lsr-a",
    rawCard: {},
    hasFailureEvidence: true,
  };
  const cardLsrOnlyB = {
    source_report_id: "LSR-B",
    normalized_activity: "drilling rig floor",
    normalized_location: "moran rig 4",
    normalized_hazard: "gas sensor bypass",
    normalized_safety_protection: "toxic gas sensor interlock",
    normalized_failure_state: "jumper installed",
    normalized_lsr: ["Bypassing Safety Controls"], // Same LSR, but completely different barrier, failure, activity
    normalized_issue_summary: "technician placed electrical jumper on h2s alarm panel",
    dateStr: "2026-09-02",
    epochMs: Date.now(),
    duplicateFingerprint: "lsr-b",
    rawCard: {},
    hasFailureEvidence: true,
  };
  const similarityLsrOnly = computeHybridSimilarity(cardLsrOnlyA, cardLsrOnlyB, DEFAULT_PATTERN_CONFIG);
  assert(
    similarityLsrOnly === null,
    "Reports sharing only an LSR without safety protection or failure state overlap DO NOT form an edge"
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TEST M: Auth Protection on Session Token
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n=== TEST M: Auth Session Verification ===");
  const validToken = createSessionToken({ userId: "priyanka@oilindia.in", role: "manager" });
  const verifiedClaims = verifySessionToken(validToken);
  assert(verifiedClaims !== null, "Valid session token verifies successfully");
  assert(verifiedClaims?.userId === "priyanka@oilindia.in", "Claims userId verified");

  const tamperedToken = validToken.slice(0, -4) + "XXXX";
  const rejectedClaims = verifySessionToken(tamperedToken);
  assert(rejectedClaims === null, "Tampered session token is rejected");

  console.log("\n==================================================");
  console.log(`PATTERN ENGINE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
