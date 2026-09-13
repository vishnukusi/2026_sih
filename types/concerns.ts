/**
 * Canonical Concerns, Cards & Review Domain Types
 */

export type Priority = "Low" | "Medium" | "High";

export interface Tag {
  label: string;
  dotColor: string;
}

export interface ReporterInfo {
  name: string;
  role: string;
  avatarUrl: string;
  email?: string;
  station?: string;
  radioChannel?: string;
  badgeId?: string;
  phone?: string;
}

export interface ReviewAuditRecord {
  reviewedBy: {
    name: string;
    email: string;
    badgeId?: string;
    role: string;
  };
  reviewedAt: string;
  decision: "confirmed" | "corrected";
  notes?: string;
  originalAssessment: {
    hazard?: string;
    possible_consequence?: string;
    failed_barrier?: string;
    failed_barrier_type?: string;
    iogp_rule?: string;
    iogp_rules?: string[];
    sif_score?: number;
    sif_potential?: boolean;
    sif_category?: "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
  };
  correctedAssessment?: {
    hazard?: string;
    possible_consequence?: string;
    failed_barrier?: string;
    failed_barrier_type?: string;
    iogp_rule?: string;
    iogp_rules?: string[];
    sif_score?: number;
    sif_potential?: boolean;
    sif_category?: "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
  };
}

export interface CardData {
  id: string;
  title: string;
  description?: string;
  tags?: Tag[];
  priority?: Priority;
  date?: string;
  avatars?: string[];
  tasksCompleted?: number;
  tasksTotal?: number;
  comments?: number;
  attachments?: number;
  coverImage?: string;
  // Structured safety fields
  observation?: string;
  hazard?: string;
  possible_consequence?: string;
  failed_barrier?: string;
  failed_barrier_type?: string;
  safety_protection?: string;
  protection_failure_state?: string;
  operational_activity?: string;
  site_location?: string;
  evidence_quote?: string;
  sif_score?: number;
  sif_potential?: boolean;
  sif_category?: "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
  iogp_rule?: string;
  iogp_rules?: string[];
  life_saving_rules?: string[];
  critical_barrier_failure?: boolean;
  confidence?: number;
  validation_flag?: "PASSED" | "NEEDS_HSE_REVIEW";
  validation_notes?: string;
  inference_engine?: "modal" | "ollama" | "fallback";
  // Model traceability
  analysis_engine?: string;
  model_name?: string;
  model_version?: string;
  dataset_version?: string;
  analyzed_at?: string;
  duplicateFingerprint?: string;
  // Human review audit
  humanReviewed?: boolean;
  reviewAudit?: ReviewAuditRecord;
  reporter?: ReporterInfo;
  reviewer?: ReporterInfo;
  reportedAt?: string;
  llmSuggestions?: string[];
  status?: "To Do" | "In Progress" | "Done" | "Fix Deployed & Locked";
  voiceNoteUrl?: string;
  hadVoiceNote?: boolean;
  columnId?: string;
  ledgerLock?: {
    isLocked: boolean;
    blockIndex: number;
    blockId: string;
    ledgerHash?: string;
    lockedByName?: string;
    lockedAt: string;
    lockedByBadge: string;
    lockedByRole: string;
    fiveWhysRca: string[];
    engineeringFix: string;
  };
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ColumnData {
  id: string;
  title: string;
  cards: CardData[];
}

export interface BoardDocument {
  _id: string;
  board: ColumnData[];
  updatedAt: Date;
}

export interface WorkerConcernPayload {
  observation: string;
  hazard?: string;
  possible_consequence?: string;
  failed_barrier?: string;
  failed_barrier_type?: string;
  safety_protection?: string;
  protection_failure_state?: string;
  operational_activity?: string;
  site_location?: string;
  evidence_quote?: string;
  sif_score?: number;
  sif_potential?: boolean;
  sif_category?: "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
  iogp_rule?: string;
  iogp_rules?: string[];
  life_saving_rules?: string[];
  critical_barrier_failure?: boolean;
  confidence?: number;
  validation_flag?: "PASSED" | "NEEDS_HSE_REVIEW";
  validation_notes?: string;
  inference_engine?: "modal" | "ollama" | "fallback";
  analysis_engine?: string;
  model_name?: string;
  model_version?: string;
  dataset_version?: string;
  analyzed_at?: string;
  duplicateFingerprint?: string;
  reporter?: string | Partial<ReporterInfo>;
  llmSuggestions?: string[];
  voiceNoteUrl?: string;
}
