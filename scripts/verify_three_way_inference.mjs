import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const jiti = require("jiti")(fileURLToPath(import.meta.url));

const {
  analyzeWithOllama,
} = jiti("../lib/ai/ollama.ts");

const {
  analyzeWithDeterministicFallback,
} = jiti("../lib/ai/deterministic-fallback.ts");

const {
  analyzeWithModal,
  checkModalStatus
} = jiti("../lib/ai/modal.ts");

async function main() {
  const observation =
    "Roustabout working on monkey board 30ft above rig floor with unclipped safety harness";

  console.log("==================================================================");
  console.log("SENTINELSIF AI — COMPARATIVE THREE-WAY INFERENCE TEST PROOF");
  console.log("==================================================================");
  console.log("Observation Under Test:");
  console.log(`"${observation}"\n`);

  // 1. Fine-tuned Modal SLM
  console.log("------------------------------------------------------------------");
  console.log("ENGINE 1: Modal Cloud SLM (Fine-Tuned)");
  console.log("Endpoint: https://railavjeet897--oil-safety-classifier-sifclassifier-analy-8ffce8.modal.run");
  console.log("------------------------------------------------------------------");
  try {
    const modalRes = await analyzeWithModal(observation);
    console.log("Engine Type:", modalRes.engine);
    console.log("Analysis Engine:", modalRes.analysis_engine);
    console.log("Model Name:", modalRes.model_name);
    console.log("Hazard:", modalRes.hazard);
    console.log("Possible Consequence:", modalRes.possible_consequence);
    console.log("Failed Barrier:", modalRes.failed_barrier);
    console.log("Failed Barrier Type:", modalRes.failed_barrier_type);
    console.log("SIF Score:", modalRes.sif_score);
    console.log("SIF Potential:", modalRes.sif_potential);
    console.log("SIF Category:", modalRes.sif_category);
    console.log("LSR:", modalRes.iogp_life_saving_rule);
    console.log("Critical Failure:", modalRes.critical_barrier_failure);
    console.log("Raw Response:", JSON.stringify(modalRes.raw));
  } catch (err) {
    console.log("Modal Execution Result: FAILED ->", err.message);
  }

  // 2. Ollama Local SLM
  console.log("\n------------------------------------------------------------------");
  console.log("ENGINE 2: Local Edge Ollama (safety-phi3)");
  console.log("Endpoint: http://127.0.0.1:11434/api/generate");
  console.log("------------------------------------------------------------------");
  try {
    const ollamaRes = await analyzeWithOllama(observation);
    console.log("Engine Type:", ollamaRes.engine);
    console.log("Analysis Engine:", ollamaRes.analysis_engine);
    console.log("Model Name:", ollamaRes.model_name);
    console.log("Hazard:", ollamaRes.hazard);
    console.log("Possible Consequence:", ollamaRes.possible_consequence);
    console.log("Failed Barrier:", ollamaRes.failed_barrier);
    console.log("SIF Score:", ollamaRes.sif_score);
    console.log("Raw Response:", JSON.stringify(ollamaRes.raw));
  } catch (err) {
    console.log("Engine Status: OFFLINE / UNREACHABLE");
    console.log("Error Detail:", err.message);
    console.log("Fallback Routing Behavior: Automatically routed to Modal SLM or Fallback.");
  }

  // 3. Deterministic Safety Fallback
  console.log("\n------------------------------------------------------------------");
  console.log("ENGINE 3: Deterministic Fallback Engine (Expert IOGP Rule Heuristics)");
  console.log("Execution Path: Local In-Memory Deterministic Safety Rules");
  console.log("------------------------------------------------------------------");
  try {
    const fallbackRes = analyzeWithDeterministicFallback(observation);
    console.log("Engine Type:", fallbackRes.engine);
    console.log("Analysis Engine:", fallbackRes.analysis_engine);
    console.log("Model Name:", fallbackRes.model_name);
    console.log("Hazard:", fallbackRes.hazard);
    console.log("Possible Consequence:", fallbackRes.possible_consequence);
    console.log("Failed Barrier:", fallbackRes.failed_barrier);
    console.log("SIF Score:", fallbackRes.sif_score);
    console.log("SIF Potential:", fallbackRes.sif_potential);
    console.log("LSR:", fallbackRes.iogp_life_saving_rule);
    console.log("Critical Failure:", fallbackRes.critical_barrier_failure);
  } catch (err) {
    console.log("Fallback Execution Result: FAILED ->", err.message);
  }

  console.log("\n==================================================================");
  console.log("END COMPARATIVE INFERENCE TEST");
  console.log("==================================================================");
}

main().catch(console.error);
