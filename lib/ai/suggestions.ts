/**
 * HSE Corrective Action Suggestions Engine
 *
 * Generates field-level, actionable corrective suggestions mapped to IOGP Life-Saving Rules
 * either via local SLM prompt or domain expert safety fallback catalog.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "safety-phi3";

/**
 * Generates 3 actionable field corrective action tips for site managers.
 */
export async function generateHseSuggestions(
  hazard?: string,
  failedBarrier?: string,
  observation?: string
): Promise<string[]> {
  const defaultTips = getFallbackSuggestions(hazard, failedBarrier);

  const isVercel = Boolean(
    process.env.VERCEL ||
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      (process.env.NODE_ENV === "production" && !process.env.FORCE_LOCAL_OLLAMA)
  );

  if (!isVercel) {
    try {
      const prompt = `<|user|>
You are an expert Senior HSE Rig Safety Superintendent for OIL India Limited.
A safety breach occurred:
Hazard: ${hazard || "Oilfield Operational Hazard"}
Breached Barrier: ${failedBarrier || "Safety Barrier Control"}
Observation: ${observation || "Unsafe condition observed on site."}

List 3 immediate, concise, bulletproof field corrective action tips for the manager:
1.
2.
3.
<|end|>
<|assistant|>
1.`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: prompt,
          raw: true,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const rawText = "1." + (data.response || "");
        const lines = rawText
          .split(/\r?\n/)
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0);

        const parsedSteps: string[] = [];
        for (const line of lines) {
          const cleaned = line.replace(/^(\d+[\.\)]|\-|\*|Step\s*\d+:?)\s*/i, "").trim();
          if (cleaned.length > 10) {
            parsedSteps.push(cleaned);
          }
        }

        if (parsedSteps.length >= 2) {
          return parsedSteps.slice(0, 3);
        }
      }
    } catch {
      // Gracefully fall back to expert domain tips
    }
  }

  return defaultTips;
}

/**
 * Domain-specific corrective actions mapped to official IOGP Life-Saving Rules.
 */
export function getFallbackSuggestions(hazard?: string, barrier?: string): string[] {
  const combined = `${hazard || ""} ${barrier || ""}`.toLowerCase();

  // 1. Work at Height / Scaffolding
  if (
    combined.includes("height") ||
    combined.includes("fall") ||
    combined.includes("harness") ||
    combined.includes("derrick") ||
    combined.includes("scaffold") ||
    combined.includes("toe board")
  ) {
    return [
      "Issue immediate Stop Work Order on elevated platform until 100% tie-off compliance and toe-board barrier integrity is re-certified.",
      "Conduct immediate physical pull-test and harness web integrity audit for all personnel working above 1.8 meters.",
      "Convene mandatory Stand-Down Tool Box Talk with crew on IOGP Life-Saving Rule #1 (Work at Height) before work resumption.",
    ];
  }

  // 2. Toxic Gas / H2S / Confined Space Atmosphere
  if (
    combined.includes("gas") ||
    combined.includes("h2s") ||
    combined.includes("vapor") ||
    combined.includes("sensor") ||
    combined.includes("detector")
  ) {
    return [
      "Evacuate non-essential personnel upwind to designated muster point and verify fixed detector loop telemetry with central control room.",
      "Deploy portable multi-gas detector survey to establish 10 ppm H2S exclusion zone prior to manual maintenance authorization.",
      "Require positive pressure SCBA apparatus for entry and verify calibration certificates of gas detection instrumentation.",
    ];
  }

  // 3. Energy Isolation / LOTO
  if (
    combined.includes("loto") ||
    combined.includes("isolation") ||
    combined.includes("electric") ||
    combined.includes("pressure") ||
    combined.includes("padlock")
  ) {
    return [
      "Apply positive physical isolation (Double Block and Bleed + Red Padlock LOTO) at primary upstream supply points.",
      "Verify zero stored energy (depressurization gauge check and electrical zero-volt test) before opening system.",
      "Audit Permit to Work (PTW) cross-signatures between operations custodian and performing authority.",
    ];
  }

  // 4. Safe Mechanical Lifting / Crane
  if (
    combined.includes("lift") ||
    combined.includes("crane") ||
    combined.includes("sling") ||
    combined.includes("rigging") ||
    combined.includes("winch")
  ) {
    return [
      "Immediately ground suspended load and barricade 1.5x crane swing drop-zone with high-visibility safety tape.",
      "Perform thorough visual inspection on wire rope slings, shackles, and load hooks for elongation, kinks, or missing safety latches.",
      "Re-verify Critical Lift Plan calculation sheet and ensure banksman / rigger certification is current before any further lift.",
    ];
  }

  // 5. Confined Space
  if (
    combined.includes("confined") ||
    combined.includes("tank") ||
    combined.includes("vessel") ||
    combined.includes("pit")
  ) {
    return [
      "Halt vessel entry immediately and test atmospheric oxygen (19.5% - 23.5%), LEL (<10%), and toxic gases at bottom, middle, and top.",
      "Post a dedicated, trained Standby Attendant with emergency rescue winch and direct UHF radio link to rig control.",
      "Verify valid Confined Space Entry Permit (CSEP) and continuous forced-air mechanical ventilation before re-entry.",
    ];
  }

  // 6. Bypassing Safety Controls
  if (
    combined.includes("bypass") ||
    combined.includes("override") ||
    combined.includes("interlock") ||
    combined.includes("defeat")
  ) {
    return [
      "Immediately re-instate safety interlock or restore safety shutdown function to active fail-safe state.",
      "Audit Management of Change (MOC) register; verify senior superintendent authorization for any temporary trip bypass.",
      "Perform live loop simulation to confirm automated shutdown trips actuate reliably.",
    ];
  }

  // Default OIL HSE Action Protocol
  return [
    "Issue immediate Stop Work Authority to halt unsafe operational conditions and clear personnel from line of fire.",
    "Perform physical barrier audit to re-establish primary and secondary defense layers according to IOGP safety protocols.",
    "Log safety intervention in OIL India HSE registry and conduct pre-job safety debrief before clearing work permit.",
  ];
}
