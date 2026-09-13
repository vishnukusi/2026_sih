/**
 * Deterministic Safety Fallback Analysis Engine
 *
 * Provides instantaneous, zero-latency safety analysis for upstream oil & gas operations
 * when external AI providers (Modal Cloud SLM, Local Ollama) are unavailable.
 * Strictly adheres to IOGP Life-Saving Rules and deterministic energy containment principles.
 */

import type { SafetyAnalysisResult, SifEvidenceFactors } from "../../types";
import { extractProtectionAndFailureState } from "../safety";
import { derivePossibleConsequence } from "./consequence";

/**
 * Deterministic safety fallback analysis used when neither Modal nor Ollama is reachable.
 */
export function analyzeWithDeterministicFallback(
  observation: string,
  location?: string,
  activity?: string
): SafetyAnalysisResult {
  const trimmed = observation?.trim() || "";
  const lower = trimmed.toLowerCase();

  let hazard = "Operational Safety Hazard";
  let barrier = "Safety Barrier Control";
  let iogpRule = "Bypassing Safety Controls";
  let sifScore = 35;

  if (lower.includes("height") || lower.includes("fall") || lower.includes("harness") || lower.includes("derrick")) {
    hazard = "Working at Heights";
    barrier = "Fall Arrest System / 100% Tie-Off";
    iogpRule = "Work at Height";
    sifScore = 85;
  } else if (lower.includes("gas") || lower.includes("h2s") || lower.includes("toxic") || lower.includes("vapor")) {
    hazard = "Toxic Gas / Hazardous Atmosphere";
    barrier = "Gas Detection / SCBA Protection";
    iogpRule = "Toxic Gas & Atmosphere";
    sifScore = 90;
  } else if (lower.includes("loto") || lower.includes("isolation") || lower.includes("energy") || lower.includes("electric")) {
    hazard = "Hazardous Energy / Lockout Tagout";
    barrier = "Positive Isolation / Lockout Tagout";
    iogpRule = "Energy Isolation";
    sifScore = 80;
  } else if (lower.includes("lift") || lower.includes("crane") || lower.includes("sling") || lower.includes("rigging")) {
    hazard = "Suspended Load / Mechanical Lifting";
    barrier = "Drop Zone Barricade / Certified Rigging";
    iogpRule = "Safe Mechanical Lifting";
    sifScore = 75;
  } else if (lower.includes("confined") || lower.includes("tank") || lower.includes("vessel")) {
    hazard = "Confined Space Entry Hazard";
    barrier = "Entry Permit & Forced Air Ventilation";
    iogpRule = "Confined Space Entry";
    sifScore = 85;
  } else if (lower.includes("hot work") || lower.includes("weld") || lower.includes("spark")) {
    hazard = "Hot Work / Flammable Atmosphere";
    barrier = "Combustible Gas Test & Fire Watch";
    iogpRule = "Hot Work";
    sifScore = 75;
  } else if (lower.includes("line of fire") || lower.includes("pinch") || lower.includes("crush")) {
    hazard = "Line of Fire / Pinch Point";
    barrier = "Physical Machine Guarding";
    iogpRule = "Line of Fire";
    sifScore = 65;
  }

  const sifPotential = sifScore >= 70;
  const possible_consequence = derivePossibleConsequence(hazard, trimmed);

  const protectionInfo = extractProtectionAndFailureState(
    trimmed,
    hazard,
    barrier
  );

  const sifFactors: SifEvidenceFactors = {
    hazardSeverity: sifScore >= 70 ? "CRITICAL" : sifScore >= 40 ? "HIGH" : "MODERATE",
    barrierCompromised: sifPotential,
    humanExposure: true,
  };

  return {
    hazard,
    possible_consequence,
    failed_barrier: barrier,
    evidence_quote: trimmed,
    sif_score: sifScore,
    sif_potential: sifPotential,
    sif_category: sifScore >= 70 ? "HIGH" : sifScore >= 40 ? "MEDIUM" : "LOW",
    iogp_life_saving_rule: iogpRule,
    iogp_rules: [iogpRule],
    life_saving_rules: [iogpRule],
    critical_barrier_failure: sifPotential,
    safety_protection: protectionInfo.safety_protection,
    protection_failure_state: protectionInfo.protection_failure_state,
    confidence: 0.7,
    sif_factors: sifFactors,
    validation_flag: "PASSED",
    engine: "fallback",
    analysis_engine: "deterministic_fallback",
    model_name: "Deterministic Fallback Engine",
    model_version: "1.0",
    dataset_version: "OIL-SIF-Precursor-UAUC-v1.0",
    analyzed_at: new Date().toISOString(),
    site_location: location,
    operational_activity: activity,
  };
}
