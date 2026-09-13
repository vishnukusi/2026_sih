/**
 * Canonical Safety & AI Domain Types
 */

export type FailureState =
  | "Bypassed"
  | "Not Followed"
  | "Damaged"
  | "Missing"
  | "Not Checked"
  | "Inadequate"
  | "Verified Compliant"
  | "Unspecified";

export interface ProtectionExtraction {
  safety_protection: string;
  protection_failure_state: FailureState;
}

export interface LifeSavingRule {
  number: number;
  name: string;
  shortLabel: string;
  mandate: string;
  category: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export interface SafetyRuleValidationResult {
  validation_flag: "PASSED" | "NEEDS_HSE_REVIEW";
  validation_notes?: string;
  flagged_for_review: boolean;
}

export interface SifEvidenceFactors {
  hazardSeverity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  barrierCompromised: boolean;
  humanExposure: boolean;
}

export interface SafetyAnalysisResult {
  hazard: string;
  possible_consequence?: string;
  failed_barrier: string;
  evidence_quote: string;
  sif_score: number;
  raw?: Record<string, unknown>;
  // Canonical fields
  sif_potential: boolean;
  sif_category: "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
  iogp_life_saving_rule?: string;
  iogp_rules?: string[];
  life_saving_rules?: string[];
  critical_barrier_failure: boolean;
  failed_barrier_type?: string;
  safety_protection: string;
  protection_failure_state: FailureState | string;
  operational_activity?: string;
  site_location?: string;
  confidence?: number;
  sif_factors?: SifEvidenceFactors;
  validation_flag?: "PASSED" | "NEEDS_HSE_REVIEW";
  validation_notes?: string;
  engine?: "modal" | "ollama" | "fallback";
  // Traceability
  analysis_engine: string;
  model_name: string;
  model_version: string;
  dataset_version?: string;
  analyzed_at: string;
}

export interface OllamaHealthStatus {
  online: boolean;
  version?: string;
  model: string;
  targetModelFound: boolean;
  availableModels: string[];
  error?: string;
}

export interface ModalHealthStatus {
  online: boolean;
  url: string;
  modelName: string;
  error?: string;
}

export interface AiSystemStatus {
  online: boolean;
  activeEngine: "modal" | "ollama";
  preferredEngine: "auto" | "modal" | "ollama";
  environment: "vercel" | "production" | "local";
  modal: ModalHealthStatus;
  ollama: OllamaHealthStatus;
}
