/**
 * AI Orchestration & Multi-Engine Routing
 *
 * Intelligently routes observation analysis across:
 * 1. Modal Cloud Fine-Tuned SLM (Primary Production Engine)
 * 2. Local Ollama Edge Engine (Local Development / Edge Failover)
 * 3. Deterministic Safety Fallback Engine (Guaranteed zero-failure failover)
 *
 * Applies the Domain Safety Validation Gate post-inference to ensure strict
 * human-in-the-loop review if AI outputs conflict with formal safety taxonomy.
 */

import type { SafetyAnalysisResult, AiSystemStatus } from "../../types";
import { validateSafetyRules } from "../safety";
import { checkModalStatus, analyzeWithModal } from "./modal";
import { checkOllamaStatus, analyzeWithOllama, OLLAMA_MODEL } from "./ollama";
import { analyzeWithDeterministicFallback } from "./deterministic-fallback";

/**
 * Returns overall AI system status across Modal and Ollama.
 */
export async function checkAiStatus(): Promise<AiSystemStatus> {
  const isVercel = Boolean(
    process.env.VERCEL ||
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      (process.env.NODE_ENV === "production" && !process.env.FORCE_LOCAL_OLLAMA)
  );

  const preferred = (process.env.AI_ENGINE || "auto").toLowerCase() as
    | "auto"
    | "modal"
    | "ollama";

  // In Vercel, don't waste time trying localhost Ollama since it does not exist
  const [modalStatus, ollamaStatus] = await Promise.all([
    checkModalStatus(),
    isVercel
      ? Promise.resolve({
          online: false,
          model: OLLAMA_MODEL,
          targetModelFound: false,
          availableModels: [],
          error: "Ollama not hosted in serverless cloud environment",
        })
      : checkOllamaStatus(),
  ]);

  let activeEngine: "modal" | "ollama" = "modal";
  if (preferred === "ollama" && ollamaStatus.online) {
    activeEngine = "ollama";
  } else if (preferred === "auto" && !isVercel && ollamaStatus.online) {
    activeEngine = "ollama";
  } else {
    activeEngine = "modal";
  }

  const online = activeEngine === "modal" ? modalStatus.online : ollamaStatus.online;

  return {
    online,
    activeEngine,
    preferredEngine: preferred,
    environment: isVercel ? "vercel" : process.env.NODE_ENV === "production" ? "production" : "local",
    modal: modalStatus,
    ollama: ollamaStatus,
  };
}

/**
 * Intelligently routes observation analysis to the appropriate engine (Modal Cloud SLM or Local Ollama).
 * In Vercel / Production: uses Modal Cloud SLM.
 * In Local Dev: uses local Ollama if online; falls back to Modal Cloud SLM automatically.
 * When both fail: falls back to deterministic analysis rather than crashing.
 */
export async function analyzeSafetyObservation(
  observation: string,
  preferredEngine?: "modal" | "ollama" | "auto" | "fallback"
): Promise<SafetyAnalysisResult> {
  const isVercel = Boolean(
    process.env.VERCEL ||
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      (process.env.NODE_ENV === "production" && !process.env.FORCE_LOCAL_OLLAMA)
  );

  const envEngine = (process.env.AI_ENGINE || "auto").toLowerCase();
  const engineToUse =
    preferredEngine && preferredEngine !== "auto" ? preferredEngine : envEngine;

  let rawResult: SafetyAnalysisResult = analyzeWithDeterministicFallback(observation);

  if (engineToUse === "fallback") {
    rawResult = analyzeWithDeterministicFallback(observation);
  } else if (engineToUse === "modal" || (isVercel && engineToUse !== "ollama")) {
    // 1. Explicitly requested 'modal', or running in cloud Vercel environment
    try {
      rawResult = await analyzeWithModal(observation);
    } catch (modalErr) {
      if (!isVercel) {
        try {
          rawResult = await analyzeWithOllama(observation);
        } catch {
          // Continue to fallback
        }
      }
      console.warn("Modal SLM unavailable, falling back to deterministic analysis:", modalErr);
      rawResult = analyzeWithDeterministicFallback(observation);
    }
  } else if (engineToUse === "ollama") {
    // 2. Explicitly requested 'ollama'
    try {
      rawResult = await analyzeWithOllama(observation);
    } catch (ollamaErr) {
      console.warn("Local Ollama failed, attempting resilient fallback to Modal SLM:", ollamaErr);
      try {
        rawResult = await analyzeWithModal(observation);
      } catch {
        rawResult = analyzeWithDeterministicFallback(observation);
      }
    }
  } else {
    // 3. 'auto' mode:
    let done = false;
    if (!isVercel) {
      try {
        const ollamaStatus = await checkOllamaStatus();
        if (ollamaStatus.online) {
          rawResult = await analyzeWithOllama(observation);
          done = true;
        }
      } catch {
        // Continue to Modal
      }
    }

    if (!done) {
      try {
        rawResult = await analyzeWithModal(observation);
      } catch (err) {
        console.warn("Modal Cloud SLM unavailable in auto mode, falling back to deterministic engine:", err);
        rawResult = analyzeWithDeterministicFallback(observation);
      }
    }
  }

  // Safety fallback guarantee if all branches encountered an edge
  if (!rawResult) {
    rawResult = analyzeWithDeterministicFallback(observation);
  }

  // ─── DOMAIN SAFETY VALIDATION GATE ─────────────────────────────────────────
  // Post-inference check: validate AI output against controlled safety rules.
  // ARCHITECTURAL INVARIANT: NEVER silently overwrite AI outputs.
  // If AI flags a SIF potential on text that describes a verified/compliant state,
  // flag as 'NEEDS_HSE_REVIEW' to direct human review without losing original predictions.
  const validation = validateSafetyRules(
    observation,
    rawResult.sif_potential,
    rawResult.critical_barrier_failure
  );

  if (validation.flagged_for_review) {
    rawResult.validation_flag = "NEEDS_HSE_REVIEW";
    rawResult.validation_notes = validation.validation_notes;
    rawResult.sif_category = "REVIEW";
  } else {
    rawResult.validation_flag = "PASSED";
  }

  return rawResult;
}
