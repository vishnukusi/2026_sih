/**
 * Safety Concerns Repository
 *
 * Persistence & state management for cards, columns, and audit records.
 * ARCHITECTURAL INVARIANT: Must NOT depend on or import AI inference engines.
 * All AI predictions (SafetyAnalysisResult, consequences, suggestions) are passed in
 * from the application / API orchestration layer.
 */

import fs from "fs/promises";
import path from "path";
import { getDb } from "./mongodb";
import type {
  CardData,
  ColumnData,
  BoardDocument,
  WorkerConcernPayload,
  ReviewAuditRecord,
  Priority,
  Tag,
  ReporterInfo,
} from "../../types";

// Clean initial board schema for OIL India HSE Operations
const CLEAN_INITIAL_BOARD: ColumnData[] = [
  {
    id: "col-1",
    title: "To Do",
    cards: [],
  },
  {
    id: "col-2",
    title: "In Progress",
    cards: [],
  },
  {
    id: "col-3",
    title: "Done",
    cards: [],
  },
];

const DATA_DIR = path.join(process.cwd(), "data");
const CONCERNS_FILE = path.join(DATA_DIR, "concerns.json");

let memoryBoard: ColumnData[] = JSON.parse(JSON.stringify(CLEAN_INITIAL_BOARD));

function enrichCard(card: CardData): CardData {
  const enriched = { ...card };

  if (!enriched.reporter) {
    enriched.reporter = {
      name: "Lav Kumar",
      role: "HSE Field Safety Officer (Derrick Floor)",
      avatarUrl:
        enriched.avatars?.[0] ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      email: "lav.kumar@oilindia.in",
      station: "Moran Rig-04 • Production Operations",
      radioChannel: "UHF CH-04",
      badgeId: "OIL-FLD-5542",
    };
  }

  if (!enriched.hazard || !enriched.failed_barrier) {
    const desc = enriched.description || "";
    const quoteMatch = desc.match(/Quote:\s*"([^"]+)"/i);
    const barrierMatch = desc.match(/Failed Barrier:\s*([^|]+)/i);
    const obsMatch = desc.match(/Observation:\s*(.+)$/i);

    if (quoteMatch && !enriched.evidence_quote) {
      enriched.evidence_quote = quoteMatch[1].trim();
    }
    if (barrierMatch && !enriched.failed_barrier) {
      enriched.failed_barrier = barrierMatch[1].trim();
    }
    if (obsMatch && !enriched.observation) {
      enriched.observation = obsMatch[1].trim();
    }

    if (!enriched.hazard) {
      const titleClean = enriched.title.replace(/\s*-\s*[a-z0-9]+$/i, "").trim();
      enriched.hazard = titleClean.length > 3 ? titleClean : "Operational Safety Precursor";
    }
  }

  if (enriched.observation && enriched.observation.includes("|")) {
    const obsMatch = enriched.observation.match(/Observation:\s*(.+)$/i);
    if (obsMatch) {
      enriched.observation = obsMatch[1].trim();
    } else if (enriched.evidence_quote) {
      enriched.observation = enriched.evidence_quote;
    }
  }

  if (!enriched.observation) {
    enriched.observation = enriched.evidence_quote || enriched.title;
  }

  if (enriched.sif_score === undefined) {
    const sifTag = enriched.tags?.find((t) => t.label.toLowerCase().includes("sif"));
    if (sifTag) {
      const match = sifTag.label.match(/\d+/);
      if (match) enriched.sif_score = parseInt(match[0], 10);
    }
    if (enriched.sif_score === undefined) {
      enriched.sif_score = enriched.priority === "High" ? 85 : enriched.priority === "Medium" ? 50 : 25;
    }
  }

  if (!enriched.reportedAt) {
    enriched.reportedAt = enriched.date ? `${enriched.date}, 2026 • 14:00 IST` : "Sep 06, 2026 • 16:15 IST";
  }

  if (enriched.title && enriched.title.endsWith("...") && enriched.observation) {
    if (enriched.hazard) {
      enriched.title = `${enriched.hazard} — ${enriched.observation}`;
    } else {
      enriched.title = enriched.observation;
    }
  }

  if (enriched.tags && Array.isArray(enriched.tags)) {
    enriched.tags = enriched.tags.map((tag) => {
      if (tag.label.endsWith("...") && enriched.hazard) {
        return {
          ...tag,
          label: enriched.hazard.replace(/\(.*\)/, "").trim(),
        };
      }
      return tag;
    });
  }

  if (!enriched.possible_consequence) {
    enriched.possible_consequence = "Severe occupational physical trauma, barrier breach, or acute personal injury";
  }

  return enriched;
}

async function syncLocalFile(board: ColumnData[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CONCERNS_FILE, JSON.stringify(board, null, 2), "utf-8");
  } catch (e) {
    console.warn("Local sync write failed:", e);
  }
}

/**
 * Retrieves board columns and cards directly from MongoDB Atlas.
 */
export async function getBoard(): Promise<ColumnData[]> {
  try {
    const db = await getDb();
    const boardCol = db.collection<BoardDocument>("board_state");
    const boardDoc = await boardCol.findOne({ _id: "active_board" });

    if (boardDoc && Array.isArray(boardDoc.board) && boardDoc.board.length > 0) {
      const cleanBoard: ColumnData[] = boardDoc.board.map((col: ColumnData) => ({
        ...col,
        cards: (col.cards || [])
          .filter((c: CardData) => !c.id.match(/^c-[1-4]$/))
          .map(enrichCard),
      }));
      memoryBoard = cleanBoard;
      await syncLocalFile(cleanBoard);
      return cleanBoard;
    }

    const concernsCol = db.collection<CardData>("concerns");
    const realCards = await concernsCol.find().toArray();
    const cleanCards = realCards
      .filter((c) => !c.id.match(/^c-[1-4]$/))
      .map(enrichCard);

    const initialBoard: ColumnData[] = [
      {
        id: "col-1",
        title: "To Do",
        cards: cleanCards.filter((c) => !c.status || c.status === "To Do"),
      },
      {
        id: "col-2",
        title: "In Progress",
        cards: cleanCards.filter((c) => c.status === "In Progress"),
      },
      {
        id: "col-3",
        title: "Done",
        cards: cleanCards.filter((c) => c.status === "Done"),
      },
    ];

    await boardCol.updateOne(
      { _id: "active_board" },
      { $set: { board: initialBoard, updatedAt: new Date() } },
      { upsert: true }
    );

    memoryBoard = initialBoard;
    await syncLocalFile(initialBoard);
    return initialBoard;
  } catch (e) {
    console.warn("[concerns] Failed to fetch board from MongoDB Atlas, checking fallback:", e);

    try {
      const content = await fs.readFile(CONCERNS_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const cleanParsed = parsed.map((col: ColumnData) => ({
          ...col,
          cards: (col.cards || []).filter((c: CardData) => !c.id.match(/^c-[1-4]$/)).map(enrichCard),
        }));
        memoryBoard = cleanParsed;
        return cleanParsed;
      }
    } catch {
      // Fall through to memoryBoard
    }

    return memoryBoard.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => !c.id.match(/^c-[1-4]$/)).map(enrichCard),
    }));
  }
}

/**
 * Persists updated board state to MongoDB Atlas and updates individual cards.
 */
export async function saveBoard(board: ColumnData[]): Promise<void> {
  const cleanBoard = board.map((col) => ({
    ...col,
    cards: col.cards.filter((c) => !c.id.match(/^c-[1-4]$/)),
  }));
  memoryBoard = cleanBoard;
  await syncLocalFile(cleanBoard);

  try {
    const { invalidatePatternCache } = await import("../patterns");
    invalidatePatternCache();
  } catch {
    // Non-critical
  }

  try {
    const db = await getDb();
    const boardCol = db.collection<BoardDocument>("board_state");
    await boardCol.updateOne(
      { _id: "active_board" },
      { $set: { board: cleanBoard, updatedAt: new Date() } },
      { upsert: true }
    );

    const concernsCol = db.collection("concerns");
    for (const col of cleanBoard) {
      for (const card of col.cards) {
        await concernsCol.updateOne(
          { id: card.id },
          {
            $set: {
              ...card,
              columnId: col.id,
              status:
                card.status === "Fix Deployed & Locked"
                  ? "Fix Deployed & Locked"
                  : (col.title as "To Do" | "In Progress" | "Done"),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    }
  } catch (e) {
    console.warn("[concerns] Failed to save board to MongoDB Atlas:", e);
  }
}

function getHazardDotColor(hazard?: string): string {
  const h = (hazard || "").toLowerCase();
  if (h.includes("height") || h.includes("fall")) return "bg-red-500";
  if (h.includes("gas") || h.includes("h2s") || h.includes("vapor") || h.includes("fire")) return "bg-amber-500";
  if (h.includes("lift") || h.includes("crane") || h.includes("sling")) return "bg-orange-500";
  if (h.includes("electric") || h.includes("energy") || h.includes("loto")) return "bg-yellow-500";
  return "bg-blue-500";
}

/**
 * Helper to construct a schema-compliant CardData object.
 */
function buildCardFromPayload(payload: WorkerConcernPayload, indexOffset: number = 0): CardData {
  const score = payload.sif_score ?? 0;
  const priority: Priority = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";

  let cardTitle = payload.hazard?.trim();
  if (!cardTitle || cardTitle.length < 3) {
    cardTitle = payload.observation?.trim() || "Operational Safety Precursor";
  } else if (payload.observation && !cardTitle.toLowerCase().includes(payload.observation.toLowerCase().slice(0, 15))) {
    cardTitle = `${cardTitle} — ${payload.observation.trim()}`;
  }

  const descParts: string[] = [];
  if (payload.evidence_quote) {
    descParts.push(`Quote: "${payload.evidence_quote}"`);
  }
  if (payload.failed_barrier) {
    descParts.push(`Failed Barrier: ${payload.failed_barrier}`);
  }
  if (payload.observation && payload.observation !== payload.evidence_quote) {
    descParts.push(`Observation: ${payload.observation}`);
  }
  const description = descParts.join(" | ");

  const tags: Tag[] = [];
  if (payload.hazard) {
    tags.push({
      label: payload.hazard.replace(/\(.*\)/, "").trim(),
      dotColor: getHazardDotColor(payload.hazard),
    });
  }
  if (score > 0) {
    tags.push({
      label: `SIF ${score}`,
      dotColor: score >= 70 ? "bg-red-500" : score >= 40 ? "bg-amber-500" : "bg-blue-500",
    });
  } else {
    tags.push({
      label: "Worker Log",
      dotColor: "bg-purple-500",
    });
  }

  const now = new Date();
  const formattedTime =
    now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + ` • ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} IST`;

  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const cardId = `worker-concern-${Date.now() + indexOffset}-${randomSuffix}`;

  return {
    id: cardId,
    title: cardTitle,
    description: description || undefined,
    tags,
    priority,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    comments: 0,
    attachments: 0,
    avatars: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    ],
    observation: payload.observation,
    hazard: payload.hazard,
    possible_consequence:
      payload.possible_consequence || "Severe occupational physical trauma, barrier breach, or acute personal injury",
    failed_barrier: payload.failed_barrier,
    failed_barrier_type: payload.failed_barrier_type,
    safety_protection: payload.safety_protection || payload.failed_barrier,
    protection_failure_state: payload.protection_failure_state || payload.failed_barrier_type,
    operational_activity: payload.operational_activity,
    site_location: payload.site_location,
    evidence_quote: payload.evidence_quote,
    sif_score: score,
    sif_potential: payload.sif_potential,
    sif_category: payload.sif_category || (score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW"),
    iogp_rule: payload.iogp_rule,
    iogp_rules: payload.iogp_rules || (payload.iogp_rule ? [payload.iogp_rule] : undefined),
    life_saving_rules: payload.life_saving_rules || payload.iogp_rules || (payload.iogp_rule ? [payload.iogp_rule] : undefined),
    critical_barrier_failure: payload.critical_barrier_failure,
    confidence: payload.confidence,
    validation_flag: payload.validation_flag || "PASSED",
    validation_notes: payload.validation_notes,
    inference_engine: payload.inference_engine,
    analysis_engine: payload.analysis_engine || payload.inference_engine || "unknown",
    model_name:
      payload.model_name ||
      (payload.inference_engine === "modal"
        ? "Fine-Tuned SLM (Modal Cloud)"
        : payload.inference_engine === "ollama"
        ? "safety-phi3"
        : "Deterministic Fallback Engine"),
    model_version: payload.model_version || "unknown",
    dataset_version: payload.dataset_version || "OIL-SIF-Precursor-UAUC-v1.0",
    analyzed_at: payload.analyzed_at || new Date().toISOString(),
    duplicateFingerprint: payload.duplicateFingerprint,
    reportedAt: formattedTime,
    reporter:
      typeof payload.reporter === "object" && payload.reporter
        ? {
            name: payload.reporter.name || "Lav Kumar",
            role: payload.reporter.role || "HSE Field Safety Officer (Derrick Operations)",
            avatarUrl:
              payload.reporter.avatarUrl ||
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            email: payload.reporter.email || "lav.kumar@oilindia.in",
            station: payload.reporter.station || "Moran Rig #04 • Wellhead Section",
            radioChannel: payload.reporter.radioChannel || "UHF CH-04",
            badgeId: payload.reporter.badgeId || "OIL-FLD-5542",
            phone: payload.reporter.phone || "+91 94350 44521",
          }
        : {
            name: typeof payload.reporter === "string" ? payload.reporter : "Lav Kumar",
            role: "HSE Field Safety Officer (Derrick Operations)",
            avatarUrl:
              "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            email: "lav.kumar@oilindia.in",
            station: "Moran Rig #04 • Wellhead Section",
            radioChannel: "UHF CH-04",
            badgeId: "OIL-FLD-5542",
            phone: "+91 94350 44521",
          },
    reviewer: undefined,
    status: "To Do",
    columnId: "col-1",
    createdAt: new Date().toISOString(),
    llmSuggestions: payload.llmSuggestions,
    voiceNoteUrl: payload.voiceNoteUrl,
    hadVoiceNote: Boolean(payload.voiceNoteUrl),
  };
}

/**
 * Persists a new concern card from a worker observation into MongoDB Atlas.
 */
export async function addConcernFromWorker(payload: WorkerConcernPayload): Promise<CardData> {
  const board = await getBoard();
  const newCard = buildCardFromPayload(payload);

  try {
    const db = await getDb();
    if (db) {
      await db.collection("concerns").insertOne(newCard);
    }
  } catch (err) {
    console.warn("[concerns] Failed to insert card into concerns collection in Atlas:", err);
  }

  const updatedBoard = board.map((col) => {
    if (col.id === "col-1" || col.title.toLowerCase().includes("to do")) {
      return {
        ...col,
        cards: [newCard, ...col.cards],
      };
    }
    return col;
  });

  await saveBoard(updatedBoard);
  return newCard;
}

/**
 * Atomic batch ingestion of multiple concerns.
 */
export async function addConcernsBatch(payloads: WorkerConcernPayload[]): Promise<CardData[]> {
  if (payloads.length === 0) return [];

  const board = await getBoard();
  const newCards: CardData[] = payloads.map((p, idx) => buildCardFromPayload(p, idx));

  try {
    const db = await getDb();
    if (db) {
      await db.collection("concerns").insertMany(newCards);
    }
  } catch (err) {
    console.warn("[concerns] Failed to batch insert cards into Atlas concerns collection:", err);
  }

  const updatedBoard = board.map((col) => {
    if (col.id === "col-1" || col.title.toLowerCase().includes("to do")) {
      return {
        ...col,
        cards: [...newCards, ...col.cards],
      };
    }
    return col;
  });

  await saveBoard(updatedBoard);
  return newCards;
}

/**
 * Applies HSE Manager Review to a concern card.
 */
export async function reviewConcernCard(params: {
  cardId: string;
  review: ReviewAuditRecord;
  correctedFields?: {
    hazard?: string;
    possible_consequence?: string;
    failed_barrier?: string;
    failed_barrier_type?: string;
    iogp_rule?: string;
    iogp_rules?: string[];
    sif_score?: number;
    sif_category?: "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
  };
}): Promise<CardData> {
  const board = await getBoard();
  let targetCard: CardData | null = null;
  let targetColId: string | null = null;

  for (const col of board) {
    const found = (col.cards || []).find((c) => c.id === params.cardId);
    if (found) {
      targetCard = found;
      targetColId = col.id;
      break;
    }
  }

  if (!targetCard) {
    throw new Error(`Card with ID ${params.cardId} not found.`);
  }

  targetCard.humanReviewed = true;
  targetCard.reviewAudit = params.review;
  targetCard.reviewer = {
    name: params.review.reviewedBy.name,
    email: params.review.reviewedBy.email,
    badgeId: params.review.reviewedBy.badgeId || "OIL-MGR",
    role: params.review.reviewedBy.role || "HSE Operations Manager",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    station: "Duliajan Corporate HQ",
    radioChannel: "COMMAND CH-01",
    phone: "+91 374 280 4501",
  };
  targetCard.updatedAt = new Date().toISOString();

  if (params.review.decision === "corrected" && params.correctedFields) {
    if (params.correctedFields.hazard) targetCard.hazard = params.correctedFields.hazard;
    if (params.correctedFields.possible_consequence) targetCard.possible_consequence = params.correctedFields.possible_consequence;
    if (params.correctedFields.failed_barrier) targetCard.failed_barrier = params.correctedFields.failed_barrier;
    if (params.correctedFields.failed_barrier_type) targetCard.failed_barrier_type = params.correctedFields.failed_barrier_type;
    if (params.correctedFields.iogp_rule) targetCard.iogp_rule = params.correctedFields.iogp_rule;
    if (params.correctedFields.iogp_rules) targetCard.iogp_rules = params.correctedFields.iogp_rules;
    if (params.correctedFields.sif_score !== undefined) {
      targetCard.sif_score = params.correctedFields.sif_score;
      targetCard.priority = params.correctedFields.sif_score >= 70 ? "High" : params.correctedFields.sif_score >= 40 ? "Medium" : "Low";
    }
    if (params.correctedFields.sif_category) {
      targetCard.sif_category = params.correctedFields.sif_category;
    }
  }

  const updatedBoard = board.map((col) => {
    if (col.id === targetColId) {
      return {
        ...col,
        cards: col.cards.map((c) => (c.id === params.cardId ? targetCard! : c)),
      };
    }
    return col;
  });

  await saveBoard(updatedBoard);

  try {
    const db = await getDb();
    await db.collection("concerns").updateOne(
      { id: params.cardId },
      {
        $set: {
          ...targetCard,
          updatedAt: new Date(),
        },
      }
    );
  } catch (err) {
    console.warn("[concerns] Failed to update reviewed concern in Atlas:", err);
  }

  return targetCard;
}
