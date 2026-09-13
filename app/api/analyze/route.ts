import { NextResponse } from "next/server";
import { analyzeSafetyObservation, checkAiStatus, generateHseSuggestions } from "@/lib/ai";
import { addConcernFromWorker } from "@/lib/data/concerns";

export const dynamic = "force-dynamic";

/**
 * GET /api/analyze
 * Returns the operational health and readiness of the AI inference subsystem.
 */
export async function GET() {
  try {
    const status = await checkAiStatus();
    return NextResponse.json({
      success: true,
      online: status.online,
      activeEngine: status.activeEngine,
      preferredEngine: status.preferredEngine,
      environment: status.environment,
      modal: status.modal,
      ollama: status.ollama,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        online: false,
        error: `Could not check AI status: ${msg}`,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analyze
 * Body: { observation: string, autoDispatch?: boolean, engine?: "modal" | "ollama" | "auto" | "fallback", reporter?: any, voiceNoteUrl?: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { observation, autoDispatch = true, engine = "auto", reporter, voiceNoteUrl } = body;

    if (!observation || typeof observation !== "string" || !observation.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Observation text is required in request body.",
        },
        { status: 400 }
      );
    }

    const result = await analyzeSafetyObservation(observation, engine);

    // Intelligently forward worker concern to Manager Portal's 'To Do' board
    let concernCard = null;
    if (autoDispatch) {
      try {
        const suggestions = await generateHseSuggestions(
          result.hazard,
          result.failed_barrier,
          observation.trim()
        ).catch(() => undefined);

        concernCard = await addConcernFromWorker({
          observation: observation.trim(),
          hazard: result.hazard,
          possible_consequence: result.possible_consequence,
          failed_barrier: result.failed_barrier,
          safety_protection: result.safety_protection,
          protection_failure_state: result.protection_failure_state,
          operational_activity: result.operational_activity,
          site_location: result.site_location,
          evidence_quote: result.evidence_quote,
          sif_score: result.sif_score,
          sif_potential: result.sif_potential,
          sif_category: result.sif_category,
          iogp_rule: result.iogp_life_saving_rule,
          iogp_rules: result.iogp_rules,
          life_saving_rules: result.life_saving_rules,
          critical_barrier_failure: result.critical_barrier_failure,
          confidence: result.confidence,
          validation_flag: result.validation_flag,
          validation_notes: result.validation_notes,
          inference_engine: result.engine,
          analysis_engine: result.analysis_engine,
          model_name: result.model_name,
          model_version: result.model_version,
          dataset_version: result.dataset_version,
          analyzed_at: result.analyzed_at,
          reporter,
          llmSuggestions: suggestions,
          voiceNoteUrl,
        });
      } catch (dispatchErr) {
        console.warn("Could not auto-dispatch concern to manager board:", dispatchErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      concernCard,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal safety analysis error";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
