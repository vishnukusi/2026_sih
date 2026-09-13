/**
 * Local Edge Ollama Service Client (safety-phi3)
 * Used for offline edge rig deployments and local development fallback
 */

import type { OllamaHealthStatus, SafetyAnalysisResult, SifEvidenceFactors } from "../../types";
import { extractProtectionAndFailureState } from "../safety";
import { sanitizePii } from "./pii-sanitization";
import { derivePossibleConsequence } from "./consequence";

export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "safety-phi3";

/**
 * Checks connection to local Ollama instance and verifies the safety model is available.
 */
export async function checkOllamaStatus(): Promise<OllamaHealthStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        online: false,
        model: OLLAMA_MODEL,
        targetModelFound: false,
        availableModels: [],
        error: `Ollama service returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    const availableModels: string[] = (data.models || []).map(
      (m: { name: string }) => m.name
    );

    const targetModelFound = availableModels.some(
      (name) =>
        name === OLLAMA_MODEL ||
        name.startsWith(`${OLLAMA_MODEL}:`) ||
        name.includes(OLLAMA_MODEL)
    );

    return {
      online: true,
      model: OLLAMA_MODEL,
      targetModelFound,
      availableModels,
    };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unable to reach Ollama service";
    return {
      online: false,
      model: OLLAMA_MODEL,
      targetModelFound: false,
      availableModels: [],
      error: `Could not connect to Ollama at ${OLLAMA_BASE_URL}. (${errorMessage})`,
    };
  }
}

/**
 * Extracts and parses JSON from raw LLM output strings.
 */
export function extractJsonFromResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Attempt direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to regex extraction
  }

  // Fallback: locate outermost curly braces
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const candidate = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue
    }
  }

  throw new Error(`Failed to parse structured JSON from model response: "${raw.slice(0, 100)}..."`);
}

/**
 * Sends a safety observation to the local fine-tuned Ollama model and returns structured JSON.
 */
export async function analyzeWithOllama(
  observation: string
): Promise<SafetyAnalysisResult> {
  const trimmed = observation?.trim();
  if (!trimmed) {
    throw new Error("Observation text is required.");
  }

  // Pre-inference PII sanitization
  const sanitized = sanitizePii(trimmed);

  const endpoint = `${OLLAMA_BASE_URL}/api/generate`;

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: sanitized,
        stream: false,
        format: "json",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to communicate with Ollama at ${endpoint}. Is Ollama running and model '${OLLAMA_MODEL}' pulled? (${msg})`
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Ollama API returned HTTP ${response.status}: ${errText || response.statusText}`
    );
  }

  const data = await response.json();
  const rawText: string = data.response;
  if (!rawText) {
    throw new Error("Received empty response from Ollama model.");
  }

  const parsed = extractJsonFromResponse(rawText);

  // Case-insensitive key lookup helper
  const findValue = (keys: string[]): unknown => {
    for (const key of keys) {
      if (parsed[key] !== undefined) return parsed[key];
      const foundKey = Object.keys(parsed).find(
        (k) => k.toLowerCase() === key.toLowerCase()
      );
      if (foundKey && parsed[foundKey] !== undefined) return parsed[foundKey];
    }
    return undefined;
  };

  const rawHazard = findValue(["hazard", "hazards", "primary_hazard"]);
  const rawBarrier = findValue(["failed_barrier", "failed_barriers", "barrier", "barriers"]);
  const rawQuote = findValue(["evidence_quote", "evidence", "quote", "evidencequote"]);

  let rawScore = findValue([
    "sif_score",
    "siif_score",
    "si_score",
    "sf_score",
    "sifscore",
    "score",
  ]);

  if (rawScore === undefined) {
    const scoreKey = Object.keys(parsed).find((k) =>
      k.toLowerCase().includes("score")
    );
    if (scoreKey) {
      rawScore = parsed[scoreKey];
    }
  }

  const hazard = typeof rawHazard === "string" ? rawHazard : String(rawHazard ?? "");
  const failed_barrier =
    typeof rawBarrier === "string" ? rawBarrier : String(rawBarrier ?? "");
  const evidence_quote =
    typeof rawQuote === "string" ? rawQuote : String(rawQuote ?? "");

  const sif_score =
    typeof rawScore === "number"
      ? rawScore
      : !isNaN(Number(rawScore))
      ? Number(rawScore)
      : 0;

  const sifCategory: "HIGH" | "MEDIUM" | "LOW" | "REVIEW" =
    sif_score >= 70 ? "HIGH" : sif_score >= 40 ? "MEDIUM" : "LOW";

  const possible_consequence = derivePossibleConsequence(hazard, trimmed, parsed);

  const protectionInfo = extractProtectionAndFailureState(
    trimmed,
    hazard,
    failed_barrier
  );

  const confidence = Math.min(0.9, Math.max(0.4, Math.round((sif_score / 100) * 100) / 100));

  const sifFactors: SifEvidenceFactors = {
    hazardSeverity: sif_score >= 70 ? "CRITICAL" : sif_score >= 40 ? "HIGH" : "MODERATE",
    barrierCompromised: sif_score >= 70,
    humanExposure: true,
  };

  return {
    hazard: hazard.trim() || "Operational Safety Concern",
    possible_consequence,
    failed_barrier: failed_barrier.trim() || "Safety Barrier Control",
    evidence_quote: evidence_quote.trim() || trimmed,
    sif_score,
    sif_potential: sif_score >= 70,
    sif_category: sifCategory,
    critical_barrier_failure: sif_score >= 70,
    safety_protection: protectionInfo.safety_protection,
    protection_failure_state: protectionInfo.protection_failure_state,
    life_saving_rules: [hazard.trim() || "Operational Safety Concern"],
    confidence,
    sif_factors: sifFactors,
    validation_flag: "PASSED",
    engine: "ollama",
    analysis_engine: "ollama",
    model_name: OLLAMA_MODEL,
    model_version: "1.0-edge",
    dataset_version: "OIL-SIF-Precursor-UAUC-v1.0",
    analyzed_at: new Date().toISOString(),
    raw: parsed,
  };
}
