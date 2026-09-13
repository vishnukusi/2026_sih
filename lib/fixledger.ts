import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { getDb } from "./data/mongodb";
import { getBoard, saveBoard } from "./data/concerns";
import { CardData } from "@/types/concerns";

export type EffectivenessScore = "Effective" | "Minor Breach" | "Ineffective";

export interface EffectivenessAuditTransaction {
  auditId: string;
  parentBlockHash: string;
  auditedAt: string;
  inspectorBadgeId: string;
  inspectorName: string;
  station: string;
  effectivenessScore: EffectivenessScore;
  auditFindings: string;
  transactionHash: string;
}

export interface IncidentPayload {
  concernId: string;
  title: string;
  hazard: string;
  failedBarrier: string;
  observation: string;
  sifScore: number;
  iogpRule?: string;
  station?: string;
  reportedAt?: string;
  reporterBadgeId?: string;
}

export interface LedgerBlock {
  blockIndex: number;
  blockId: string;
  concernId: string;
  previousBlockHash: string;
  timestamp: string;
  incidentPayload: IncidentPayload;
  rcaFiveWhys: string[];
  approvedEngineeringFix: string;
  auditorId: string;
  auditorName: string;
  auditorRole: string;
  status: "Fix Deployed & Locked";
  ledger_hash: string;
  effectivenessAudits: EffectivenessAuditTransaction[];
  // For simulation/testing only
  _isSimulatedTamper?: boolean;
  _tamperedField?: string;
  _originalPayloadBackup?: IncidentPayload;
}

export interface LedgerIntegrityReport {
  isValid: boolean;
  totalBlocks: number;
  verifiedAt: string;
  tamperedBlocks: Array<{
    blockIndex: number;
    blockId: string;
    expectedHash: string;
    computedHash: string;
    reason: string;
  }>;
  chainIntegrityBreakIndex?: number;
}

export interface RcaResult {
  hazard: string;
  failedBarrier: string;
  fiveWhys: string[];
  recommendedEngineeringFix: string;
  iogpRule: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const FIX_LEDGER_FILE = path.join(DATA_DIR, "fix_ledger.json");

// Canonical JSON serializer to guarantee deterministic SHA-256 calculation
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJsonStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ":" + canonicalJsonStringify(val);
  });
  return "{" + pairs.join(",") + "}";
}

/**
 * Calculates SHA-256 block hash mathematically derived from the exact payload:
 * blockIndex + concernId + previousBlockHash + canonical(incidentPayload) + canonical(rcaFiveWhys) + approvedEngineeringFix + timestamp + auditorId
 */
export function computeBlockHash(
  blockIndex: number,
  concernId: string,
  previousBlockHash: string,
  incidentPayload: IncidentPayload,
  rcaFiveWhys: string[],
  approvedEngineeringFix: string,
  timestamp: string,
  auditorId: string
): string {
  const hashMaterial = [
    String(blockIndex),
    concernId,
    previousBlockHash,
    canonicalJsonStringify(incidentPayload),
    canonicalJsonStringify(rcaFiveWhys),
    approvedEngineeringFix.trim(),
    timestamp,
    auditorId.trim(),
  ].join("|#|");

  return crypto.createHash("sha256").update(hashMaterial, "utf8").digest("hex");
}

/**
 * Calculates SHA-256 for a linked closed-loop effectiveness audit transaction
 */
export function computeAuditTransactionHash(
  auditId: string,
  parentBlockHash: string,
  auditedAt: string,
  inspectorBadgeId: string,
  effectivenessScore: EffectivenessScore,
  auditFindings: string
): string {
  const hashMaterial = [
    auditId,
    parentBlockHash,
    auditedAt,
    inspectorBadgeId.trim(),
    effectivenessScore,
    auditFindings.trim(),
  ].join("|#|");

  return crypto.createHash("sha256").update(hashMaterial, "utf8").digest("hex");
}

// Initial Genesis Block for OIL India HSE Regulatory Compliance Ledger
const GENESIS_BLOCK: LedgerBlock = (() => {
  const timestamp = "2026-08-15T00:00:00.000Z";
  const incidentPayload: IncidentPayload = {
    concernId: "GENESIS-OIL-000",
    title: "OIL India Safety Protocol - Zero SIF Genesis Baseline",
    hazard: "Systemic Oilfield Safety Architecture Baseline",
    failedBarrier: "None (System Foundation)",
    observation:
      "Initialization of the OIL India DGMS/OSHA Compliant Tamper-Proof FixLedger knowledge base.",
    sifScore: 0,
    iogpRule: "Corporate Safety Baseline",
    station: "Duliajan Corporate HSE Directorate",
    reportedAt: "Aug 15, 2026 • 00:00 IST",
    reporterBadgeId: "OIL-DIR-001",
  };
  const rcaFiveWhys = [
    "Why 1: Regulatory bodies (DGMS / OSHA) require immutable proof of engineering hazard mitigation.",
    "Why 2: Traditional databases allow unverified row overwrites, risking liability cover-ups.",
    "Why 3: Previous audit trails lacked cryptographic mathematical linkage between incident and fix.",
    "Why 4: Management requires verifiable zero-trust transparency before approving rig operations.",
    "Why 5: Core Mandate: Establish an append-only, SHA-256 tamper-proof ledger for all SIF precursors.",
  ];
  const approvedEngineeringFix =
    "Deploy FixLedger cryptographically sealed data lock architecture on top of MongoDB with SHA-256 payload derivation.";
  const auditorId = "OIL-DIR-001";
  const auditorName = "OIL Corporate HSE Directorate";
  const auditorRole = "Executive Director (Corporate HSE)";
  const previousBlockHash = "0000000000000000000000000000000000000000000000000000000000000000";

  const ledger_hash = computeBlockHash(
    0,
    "GENESIS-OIL-000",
    previousBlockHash,
    incidentPayload,
    rcaFiveWhys,
    approvedEngineeringFix,
    timestamp,
    auditorId
  );

  return {
    blockIndex: 0,
    blockId: "BLK-OIL-2026-0000",
    concernId: "GENESIS-OIL-000",
    previousBlockHash,
    timestamp,
    incidentPayload,
    rcaFiveWhys,
    approvedEngineeringFix,
    auditorId,
    auditorName,
    auditorRole,
    status: "Fix Deployed & Locked",
    ledger_hash,
    effectivenessAudits: [
      {
        auditId: "AUDIT-GENESIS-01",
        parentBlockHash: ledger_hash,
        auditedAt: "2026-08-16T10:00:00.000Z",
        inspectorBadgeId: "OIL-MGR-1002",
        inspectorName: "Priyanka Bora",
        station: "Duliajan HQ",
        effectivenessScore: "Effective",
        auditFindings: "Genesis cryptographic parameters verified across Moran and Naharkatiya field nodes.",
        transactionHash: computeAuditTransactionHash(
          "AUDIT-GENESIS-01",
          ledger_hash,
          "2026-08-16T10:00:00.000Z",
          "OIL-MGR-1002",
          "Effective",
          "Genesis cryptographic parameters verified across Moran and Naharkatiya field nodes."
        ),
      },
    ],
  };
})();

// In-memory fallback
let memoryLedger: LedgerBlock[] = [GENESIS_BLOCK];

async function syncLocalLedgerFile(blocks: LedgerBlock[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FIX_LEDGER_FILE, JSON.stringify(blocks, null, 2), "utf-8");
  } catch (e) {
    console.warn("[FixLedger] Local file sync failed:", e);
  }
}

/**
 * Loads the current blockchain from MongoDB Atlas, falling back to local json / memory.
 */
export async function getLedgerBlocks(): Promise<LedgerBlock[]> {
  try {
    const db = await getDb();
    const col = db.collection<LedgerBlock>("fix_ledger");
    const blocks = await col.find().sort({ blockIndex: 1 }).toArray();

    if (blocks && blocks.length > 0) {
      memoryLedger = blocks;
      await syncLocalLedgerFile(blocks);
      return blocks;
    }

    // Initialize with Genesis block if empty in DB
    await col.insertOne(GENESIS_BLOCK);
    memoryLedger = [GENESIS_BLOCK];
    await syncLocalLedgerFile(memoryLedger);
    return memoryLedger;
  } catch (err) {
    console.warn("[FixLedger] Mongo fetch failed, using local/memory ledger:", err);
    try {
      const raw = await fs.readFile(FIX_LEDGER_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryLedger = parsed;
        return parsed;
      }
    } catch {
      // Fallback
    }
    return memoryLedger;
  }
}

/**
 * Saves blocks to MongoDB Atlas and local disk
 */
async function persistBlocks(blocks: LedgerBlock[]): Promise<void> {
  memoryLedger = blocks;
  await syncLocalLedgerFile(blocks);

  try {
    const db = await getDb();
    const col = db.collection("fix_ledger");
    for (const block of blocks) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...blockToSave } = block as LedgerBlock & { _id?: unknown };
      await col.updateOne(
        { blockId: block.blockId },
        { $set: blockToSave },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn("[FixLedger] Mongo update failed:", err);
  }
}

/**
 * Generates an Automated 5-Whys Root Cause Analysis (RCA) and Recommended Engineering Fix
 * tailored specifically for oilfield drilling/production hazards.
 */
export function generateRcaAndFix(
  hazard?: string,
  failedBarrier?: string,
  observation?: string
): RcaResult {
  const combined = `${hazard || ""} ${failedBarrier || ""} ${observation || ""}`.toLowerCase();

  // 1. Working at Height / Derrick / Scaffolding
  if (
    combined.includes("height") ||
    combined.includes("fall") ||
    combined.includes("harness") ||
    combined.includes("derrick") ||
    combined.includes("scaffold") ||
    combined.includes("girder")
  ) {
    return {
      hazard: hazard || "Working at Height Fall Hazard",
      failedBarrier: failedBarrier || "Fall Arrest System & Secondary Anchor Tie-Off",
      iogpRule: "Work at Height (Rule #1)",
      fiveWhys: [
        `Why 1 (Direct Event): Derrickman unclipped safety harness lanyard while traversing monkey board at 15m elevation.`,
        `Why 2 (Physical Barrier): Single lanyard setup lacked continuous 100% tie-off dual-hook configuration for structural transit.`,
        `Why 3 (Procedural/PTW): Working at Height Permit checklist did not enforce dual-carabiner self-retracting lifeline (SRL) requirement for monkey board operations.`,
        `Why 4 (Supervision): Rig superintendent toolbox talk did not physically inspect monkey board harness harness tether certs prior to shift commencement.`,
        `Why 5 (Systemic Root Cause): Absence of an automated interlocked overhead inertia-reel safety track system along the derrick traversal beam.`,
      ],
      recommendedEngineeringFix:
        "Retrofit overhead certified stainless-steel rigid rail lifeline system with dual-carabiner 3M DBI-SALA Self-Retracting Lifelines (SRL), enforce mandatory pre-climb digital harness pull-test verification, and install automatic descent rescue winches at monkey board level.",
    };
  }

  // 2. Toxic Gas / H2S / Confined Space Atmosphere
  if (
    combined.includes("gas") ||
    combined.includes("h2s") ||
    combined.includes("vapor") ||
    combined.includes("leak") ||
    combined.includes("alarm") ||
    combined.includes("detector")
  ) {
    return {
      hazard: hazard || "Toxic H2S / Flammable Gas Exposure",
      failedBarrier: failedBarrier || "Fixed Gas Detection Telemetry & Emergency Vent Shutdown",
      iogpRule: "Bypassing Safety Controls & Confined Space (Rules #6 & #8)",
      fiveWhys: [
        `Why 1 (Direct Event): Atmospheric H2S levels reached 18 ppm near Wellhead Manifold while operators were unisolated without positive-pressure SCBA.`,
        `Why 2 (Physical Barrier): Fixed electrochemical H2S gas sensor node failed to trigger audible sounders due to sensor cell poison drift.`,
        `Why 3 (Procedural/PTW): Bump-test calibration cycle had lapsed 14 days past the OIL standard 30-day mandatory calibration interval without red-tagging.`,
        `Why 4 (Supervision): Maintenance technicians bypassed sensor loop telemetry during routine line-pigging without registering an approved Management of Change (MOC).`,
        `Why 5 (Systemic Root Cause): Facility lacked fail-safe auto-tripping interlocks linking dual-optical gas sensors directly to Emergency Depressurization (EDP) blowdown valves.`,
      ],
      recommendedEngineeringFix:
        "Install SIL-2 certified redundant point-infrared and open-path laser optical H2S detectors with automatic 2-out-of-3 voting logic wired directly to pneumatic Emergency Shutdown Valves (ESDVs), paired with mandatory wireless personal multi-gas monitors for all wellhead technicians.",
    };
  }

  // 3. Safe Mechanical Lifting / Crane / Sling
  if (
    combined.includes("lift") ||
    combined.includes("crane") ||
    combined.includes("sling") ||
    combined.includes("rigging") ||
    combined.includes("wire")
  ) {
    return {
      hazard: hazard || "Mechanical Lifting Failure & Suspended Load Hazard",
      failedBarrier: failedBarrier || "Certified Rigging Hardware & Exclusion Zone Barricade",
      iogpRule: "Safe Mechanical Lifting (Rule #5)",
      fiveWhys: [
        `Why 1 (Direct Event): Frayed wire-rope sling snapped under 4.2-tonne casing bundle load, causing dropped object in drill deck corridor.`,
        `Why 2 (Physical Barrier): Wire rope had suffered internal bird-caging and broken core wires that were not flagged prior to rig up.`,
        `Why 3 (Procedural/PTW): Critical Lift Plan relied on generic tonnage charts rather than actual rigging inspection and sling tag validation.`,
        `Why 4 (Supervision): Banksman failed to establish a 1.5x drop radius physical exclusion zone, permitting crew members inside the swing corridor.`,
        `Why 5 (Systemic Root Cause): Rig site lacked a digitized RFID color-coded lifting gear tracking register with automatic quarantine for uninspected rigging hardware.`,
      ],
      recommendedEngineeringFix:
        "Implement mandatory RFID-tagged alloy steel round slings with automated gate-locked digital color-coding; install acoustic exclusion zone laser barrier sensors around crane boom radius that cut winch power when personnel enter drop zone.",
    };
  }

  // 4. Energy Isolation / LOTO / High Pressure
  if (
    combined.includes("loto") ||
    combined.includes("energy") ||
    combined.includes("isolation") ||
    combined.includes("pressure") ||
    combined.includes("electric") ||
    combined.includes("lockout")
  ) {
    return {
      hazard: hazard || "Hazardous Energy Discharge / Pressure Breach",
      failedBarrier: failedBarrier || "Double Block and Bleed (DBB) & LOTO Padlock Barrier",
      iogpRule: "Energy Isolation (Rule #3)",
      fiveWhys: [
        `Why 1 (Direct Event): High-pressure crude emulsion leaked at 45 bar during choke valve gasket replacement on active header.`,
        `Why 2 (Physical Barrier): Upstream isolation valve had weeping seat leakage and bleed port valve was partially seized shut with paraffin scale.`,
        `Why 3 (Procedural/PTW): Technician did not perform physical gauge zero-energy verification or needle valve depressurization test prior to unbolting studs.`,
        `Why 4 (Supervision): LOTO padlock was applied to secondary bypass line instead of the master header isolation station due to ambiguous line tagging.`,
        `Why 5 (Systemic Root Cause): Absence of mechanical captive-key interlock system (Kirk Key) enforcing sequential valve closure, bleed-off, and permit issuance.`,
      ],
      recommendedEngineeringFix:
        "Standardize mechanical captive-key trapped interlock systems (Trapped Key LOTO) on all manifold block valves; replace weeping manual ball valves with double-isolation trunnion-mounted valves featuring automated differential pressure transmitter sensors.",
    };
  }

  // Default OIL India Production & Drilling Hazard RCA
  return {
    hazard: hazard || "Operational Safety Precursor",
    failedBarrier: failedBarrier || "Primary Physical / Administrative Safety Defense",
    iogpRule: "Life-Saving Rules Compliance & Operational Discipline",
    fiveWhys: [
      `Why 1 (Direct Event): Operational task progressed with compromised primary barrier defense at ${observation || "site station"}.`,
      `Why 2 (Physical Barrier): Physical containment or interlock was not functioning at 100% rated capacity.`,
      `Why 3 (Procedural/PTW): Pre-job Hazard Identification (HAZID) and Job Safety Analysis (JSA) failed to identify specific precursor conditions.`,
      `Why 4 (Supervision): Field inspection frequency was insufficient to catch barrier degradation prior to active task execution.`,
      `Why 5 (Systemic Root Cause): Lack of closed-loop predictive barrier telemetry and tamper-proof operational audit enforcement.`,
    ],
    recommendedEngineeringFix:
      "Install redundant fail-safe physical barrier interlock, mandate dual-signoff Pre-Task Safety Verification, and enforce closed-loop verification audits on FixLedger tamper-proof ledger.",
  };
}

/**
 * Trigger: Approves the 5-Whys RCA and Engineering Fix, transitioning record to 'Fix Deployed & Locked'.
 * Calculates SHA-256 hash mathematically derived from the exact payload and previous block hash,
 * seals block, appends to MongoDB, and updates Kanban board card.
 */
export async function lockAndSealFix(
  concernId: string,
  incidentPayload: IncidentPayload,
  rcaFiveWhys: string[],
  approvedEngineeringFix: string,
  auditor: { id: string; name: string; role: string }
): Promise<LedgerBlock> {
  const blocks = await getLedgerBlocks();

  // Check if already locked
  const existing = blocks.find((b) => b.concernId === concernId);
  if (existing) {
    return existing;
  }

  const prevBlock = blocks[blocks.length - 1];
  const newIndex = prevBlock ? prevBlock.blockIndex + 1 : 1;
  const previousBlockHash = prevBlock ? prevBlock.ledger_hash : GENESIS_BLOCK.ledger_hash;
  const timestamp = new Date().toISOString();
  const blockId = `BLK-OIL-2026-${String(newIndex).padStart(4, "0")}`;

  // Deterministically compute the cryptographic block hash (SHA-256)
  const ledger_hash = computeBlockHash(
    newIndex,
    concernId,
    previousBlockHash,
    incidentPayload,
    rcaFiveWhys,
    approvedEngineeringFix,
    timestamp,
    auditor.id
  );

  const newBlock: LedgerBlock = {
    blockIndex: newIndex,
    blockId,
    concernId,
    previousBlockHash,
    timestamp,
    incidentPayload,
    rcaFiveWhys,
    approvedEngineeringFix,
    auditorId: auditor.id,
    auditorName: auditor.name,
    auditorRole: auditor.role,
    status: "Fix Deployed & Locked",
    ledger_hash,
    effectivenessAudits: [],
  };

  // 1. Append new block to ledger and persist
  const updatedBlocks = [...blocks, newBlock];
  await persistBlocks(updatedBlocks);

  // 2. Synchronize card status on the Kanban board to 'Fix Deployed & Locked'
  try {
    const board = await getBoard();
    let cardFound = false;

    const updatedBoard = board.map((col) => ({
      ...col,
      cards: col.cards.map((card: CardData) => {
        if (card.id === concernId) {
          cardFound = true;
          return {
            ...card,
            status: "Fix Deployed & Locked" as const,
            ledgerLock: {
              isLocked: true,
              blockIndex: newIndex,
              blockId,
              ledgerHash: ledger_hash,
              lockedAt: timestamp,
              lockedByBadge: auditor.id,
              lockedByName: auditor.name,
              lockedByRole: auditor.role,
              fiveWhysRca: rcaFiveWhys,
              engineeringFix: approvedEngineeringFix,
            },
          };
        }
        return card;
      }),
    }));

    if (cardFound) {
      await saveBoard(updatedBoard);
    }
  } catch (err) {
    console.warn("[FixLedger] Failed to sync board card to Fix Deployed & Locked:", err);
  }

  return newBlock;
}

/**
 * Closed-Loop Tracking: Field inspectors append subsequent "Effectiveness Scores"
 * (Effective, Minor Breach, Ineffective) as new linked transactions rather than overwriting the original lock.
 */
export async function appendEffectivenessAudit(
  blockId: string,
  inspector: {
    badgeId: string;
    name: string;
    station: string;
    effectivenessScore: EffectivenessScore;
    findings: string;
  }
): Promise<{ success: boolean; auditTransaction?: EffectivenessAuditTransaction; error?: string }> {
  const blocks = await getLedgerBlocks();
  const blockIdx = blocks.findIndex((b) => b.blockId === blockId);

  if (blockIdx === -1) {
    return { success: false, error: `Block with ID ${blockId} not found.` };
  }

  const block = blocks[blockIdx];
  const auditId = `AUDIT-${block.blockId}-${Date.now().toString().slice(-6)}`;
  const auditedAt = new Date().toISOString();

  const transactionHash = computeAuditTransactionHash(
    auditId,
    block.ledger_hash,
    auditedAt,
    inspector.badgeId,
    inspector.effectivenessScore,
    inspector.findings
  );

  const newAudit: EffectivenessAuditTransaction = {
    auditId,
    parentBlockHash: block.ledger_hash,
    auditedAt,
    inspectorBadgeId: inspector.badgeId,
    inspectorName: inspector.name,
    station: inspector.station,
    effectivenessScore: inspector.effectivenessScore,
    auditFindings: inspector.findings,
    transactionHash,
  };

  block.effectivenessAudits = [...(block.effectivenessAudits || []), newAudit];
  blocks[blockIdx] = block;

  await persistBlocks(blocks);
  return { success: true, auditTransaction: newAudit };
}

/**
 * Tamper-Evident Immutability Verification:
 * Mathematically validates the entire chain:
 * 1. Recomputes SHA-256 for every block from its exact payload -> must equal stored ledger_hash.
 * 2. Checks previousBlockHash of block N against ledger_hash of block N-1.
 * If any malicious administrator alters historical records before an OSHA/DGMS audit,
 * the payload will no longer match the stored hash, instantly flagging the record as compromised!
 */
export async function verifyLedgerIntegrity(): Promise<LedgerIntegrityReport> {
  const blocks = await getLedgerBlocks();
  const tamperedBlocks: LedgerIntegrityReport["tamperedBlocks"] = [];
  let chainBreakIdx: number | undefined;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Recompute block hash
    const computedHash = computeBlockHash(
      block.blockIndex,
      block.concernId,
      block.previousBlockHash,
      block.incidentPayload,
      block.rcaFiveWhys,
      block.approvedEngineeringFix,
      block.timestamp,
      block.auditorId
    );

    // Check payload hash match
    if (computedHash !== block.ledger_hash) {
      tamperedBlocks.push({
        blockIndex: block.blockIndex,
        blockId: block.blockId,
        expectedHash: block.ledger_hash,
        computedHash,
        reason: `Cryptographic SHA-256 Payload Discrepancy: Database contents were maliciously modified or forged after approval. Stored: ${block.ledger_hash.slice(0, 12)}... vs Computed: ${computedHash.slice(0, 12)}...`,
      });
    }

    // Check chain linkage to previous block
    if (i > 0) {
      const prevBlock = blocks[i - 1];
      if (block.previousBlockHash !== prevBlock.ledger_hash) {
        tamperedBlocks.push({
          blockIndex: block.blockIndex,
          blockId: block.blockId,
          expectedHash: prevBlock.ledger_hash,
          computedHash: block.previousBlockHash,
          reason: `Broken Verification Chain Link: Previous block hash does not point to Block #${prevBlock.blockIndex} (${prevBlock.blockId}).`,
        });
        if (chainBreakIdx === undefined) chainBreakIdx = i;
      }
    }
  }

  return {
    isValid: tamperedBlocks.length === 0,
    totalBlocks: blocks.length,
    verifiedAt: new Date().toISOString(),
    tamperedBlocks,
    chainIntegrityBreakIndex: chainBreakIdx,
  };
}

/**
 * Interactive Regulatory Simulation:
 * Simulates a malicious database administrator attempting to alter historical safety records
 * to hide systemic negligence (e.g. lowering SIF score from 85 to 20 or removing breached barrier).
 */
export async function simulateTamper(
  blockId: string,
  fieldToMutate: "sifScore" | "failedBarrier" | "observation" | "approvedEngineeringFix",
  tamperedValue: string | number
): Promise<{ success: boolean; block: LedgerBlock }> {
  const blocks = await getLedgerBlocks();
  const idx = blocks.findIndex((b) => b.blockId === blockId);
  if (idx === -1) throw new Error(`Block ${blockId} not found.`);

  const block = blocks[idx];

  // Backup original payload if not already backed up
  if (!block._originalPayloadBackup) {
    block._originalPayloadBackup = JSON.parse(JSON.stringify(block.incidentPayload));
  }

  block._isSimulatedTamper = true;
  block._tamperedField = fieldToMutate;

  if (fieldToMutate === "approvedEngineeringFix") {
    block.approvedEngineeringFix = String(tamperedValue);
  } else if (fieldToMutate === "sifScore") {
    block.incidentPayload.sifScore = Number(tamperedValue);
  } else if (fieldToMutate === "failedBarrier") {
    block.incidentPayload.failedBarrier = String(tamperedValue);
  } else if (fieldToMutate === "observation") {
    block.incidentPayload.observation = String(tamperedValue);
  }

  blocks[idx] = block;
  await persistBlocks(blocks);

  return { success: true, block };
}

/**
 * Restores a simulated tampered block back to its authentic cryptographic seal.
 */
export async function restoreBlock(blockId: string): Promise<{ success: boolean; block: LedgerBlock }> {
  const blocks = await getLedgerBlocks();
  const idx = blocks.findIndex((b) => b.blockId === blockId);
  if (idx === -1) throw new Error(`Block ${blockId} not found.`);

  const block = blocks[idx];

  if (block._originalPayloadBackup) {
    block.incidentPayload = JSON.parse(JSON.stringify(block._originalPayloadBackup));
    delete block._originalPayloadBackup;
  }
  delete block._isSimulatedTamper;
  delete block._tamperedField;

  blocks[idx] = block;
  await persistBlocks(blocks);

  return { success: true, block };
}
