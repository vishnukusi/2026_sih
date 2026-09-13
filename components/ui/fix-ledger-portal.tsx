"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  Copy,
  Check,
  RefreshCw,
  Search,
  History,
  AlertTriangle,
  CheckCircle2,
  Send,
  Eye,
  X,
  ExternalLink,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { type UserSessionData } from "./auth-form-1";
import { cn } from "@/lib/utils";

interface EffectivenessAuditTransaction {
  auditId: string;
  parentBlockHash: string;
  auditedAt: string;
  inspectorBadgeId: string;
  inspectorName: string;
  station: string;
  effectivenessScore: "Effective" | "Minor Breach" | "Ineffective";
  auditFindings: string;
  transactionHash: string;
}

interface IncidentPayload {
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

interface LedgerBlock {
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
  _isSimulatedTamper?: boolean;
  _tamperedField?: string;
}

interface IntegrityReport {
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
}

interface FixLedgerPortalProps {
  user?: UserSessionData | null;
  onSelectConcern?: (concernId: string) => void;
}

export function FixLedgerPortal({ user, onSelectConcern }: FixLedgerPortalProps) {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "audits" | "audited" | "tampered">("all");
  const [selectedBlock, setSelectedBlock] = useState<LedgerBlock | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Simulation & Audit State
  const [isSimulating, setIsSimulating] = useState(false);
  const [auditTargetBlock, setAuditTargetBlock] = useState<LedgerBlock | null>(null);
  const [auditScore, setAuditScore] = useState<"Effective" | "Minor Breach" | "Ineffective">("Effective");
  const [auditFindings, setAuditFindings] = useState("");
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const fetchLedger = async (runVerification = false) => {
    setLoading(true);
    try {
      const url = runVerification ? "/api/ledger?verify=true" : "/api/ledger";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.blocks)) {
        setBlocks(data.blocks);
        if (data.integrity) {
          setIntegrityReport(data.integrity);
        }
      }
    } catch (err) {
      console.warn("Failed to load FixLedger:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger(true);
  }, []);

  const handleRunVerification = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/ledger?verify=true");
      const data = await res.json();
      if (data.success && data.integrity) {
        setIntegrityReport(data.integrity);
        if (Array.isArray(data.blocks)) setBlocks(data.blocks);
        setSuccessToast(
          data.integrity.isValid
            ? "Registry Verification: All blocks matched cryptographic SHA-256 signatures."
            : `Tamper Warning: Discrepancy detected in ${data.integrity.tamperedBlocks?.length} block(s).`
        );
        setTimeout(() => setSuccessToast(""), 5000);
      }
    } catch (err) {
      console.warn("Verification failed:", err);
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleSimulateTamper = async (block: LedgerBlock) => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate_tamper",
          blockId: block.blockId,
          fieldToMutate: "sifScore",
          tamperedValue: 10,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await handleRunVerification();
        setSuccessToast(`Simulated database modification on ${block.blockId}. Audit caught discrepancy.`);
      }
    } catch (err) {
      console.warn("Tamper simulation failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRestoreBlock = async (blockId: string) => {
    setIsSimulating(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_block",
          blockId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await handleRunVerification();
        setSuccessToast(`Block ${blockId} restored to original verified state.`);
      }
    } catch (err) {
      console.warn("Restore failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditTargetBlock || !auditFindings.trim()) return;

    setIsSubmittingAudit(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "append_audit",
          blockId: auditTargetBlock.blockId,
          inspector: {
            badgeId: user?.badgeId || "OIL-INSP-204",
            name: user?.name || "HSE Rig Field Inspector",
            station: auditTargetBlock.incidentPayload?.station || "Moran Rig #04",
            effectivenessScore: auditScore,
            findings: auditFindings.trim(),
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessToast(`Field audit appended to Block ${auditTargetBlock.blockId}.`);
        setAuditTargetBlock(null);
        setAuditFindings("");
        await fetchLedger(true);
      }
    } catch (err) {
      console.warn("Failed to append audit:", err);
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  // Filter blocks
  const filteredBlocks = blocks.filter((b) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      b.blockId.toLowerCase().includes(q) ||
      b.ledger_hash.toLowerCase().includes(q) ||
      b.incidentPayload?.title?.toLowerCase().includes(q) ||
      b.incidentPayload?.hazard?.toLowerCase().includes(q) ||
      b.incidentPayload?.station?.toLowerCase().includes(q) ||
      b.approvedEngineeringFix?.toLowerCase().includes(q);

    if (!matchesQuery) return false;

    if (filterTab === "audits") {
      return Array.isArray(b.effectivenessAudits) && b.effectivenessAudits.length > 0;
    }
    if (filterTab === "tampered") {
      return integrityReport?.tamperedBlocks?.some((tb) => tb.blockId === b.blockId);
    }

    return true;
  });

  const totalAudits = blocks.reduce((acc, b) => acc + (b.effectivenessAudits?.length || 0), 0);
  const tamperedCount = integrityReport?.tamperedBlocks?.length || 0;
  const isAllValid = integrityReport ? integrityReport.isValid : true;

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/60 overflow-hidden font-sans">
      {/* ─── Header ─── */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight">
                FixLedger & Regulatory Registry
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                DGMS / OSHA Compliance
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Tamper-evident record of approved 5-Whys root cause analyses, engineering barrier mitigations, and field audits.
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunVerification}
              disabled={verifying}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 border shadow-2xs",
                isAllValid
                  ? "bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-300"
                  : "bg-red-50 hover:bg-red-100 text-red-700 border-red-300 animate-pulse"
              )}
            >
              <ShieldCheck size={14} className={isAllValid ? "text-emerald-600" : "text-red-600"} />
              <span>{verifying ? "Verifying SHA-256 Hashes..." : "Verify Registry Integrity"}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchLedger(true)}
              disabled={loading}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
              title="Refresh records"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filter Navigation Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                filterTab === "all"
                  ? "bg-neutral-900 text-white shadow-xs"
                  : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/70"
              )}
            >
              <span>All Blocks</span>
              <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-bold", filterTab === "all" ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-700")}>
                {blocks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab("audits")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border",
                filterTab === "audits"
                  ? "bg-neutral-900 text-white border-neutral-900 shadow-xs"
                  : "bg-neutral-100/80 text-neutral-600 border-neutral-200/70 hover:bg-neutral-200/70"
              )}
            >
              <span>Field Audited</span>
              <span className={cn("px-1.5 py-0.2 rounded-full text-[10px] font-bold", filterTab === "audits" ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-700")}>
                {blocks.filter((b) => b.effectivenessAudits && b.effectivenessAudits.length > 0).length}
              </span>
            </button>

            {tamperedCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab("tampered")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-red-600 text-white shadow-xs"
              >
                <span>Tamper Alerts</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-800 text-white">
                  {tamperedCount}
                </span>
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search records, stations, fixes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-white rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
        </div>
      </div>

      {/* ─── Notification Toast ─── */}
      {successToast && (
        <div className="px-6 py-2 bg-neutral-900 text-white text-xs font-medium flex items-center justify-between border-b border-neutral-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button type="button" onClick={() => setSuccessToast("")} className="text-neutral-400 hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}

      {/* ─── Metrics Summary Cards ─── */}
      <div className="px-6 py-3.5 grid grid-cols-2 md:grid-cols-4 gap-3.5 shrink-0 bg-neutral-50 border-b border-neutral-200/70">
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs">
          <span className="text-[11px] font-medium text-neutral-500">Registry Verification</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("w-2 h-2 rounded-full", isAllValid ? "bg-emerald-500" : "bg-red-500")} />
            <span className="text-sm font-bold text-neutral-900">
              {isAllValid ? "All Signatures Valid" : "Discrepancy Detected"}
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs">
          <span className="text-[11px] font-medium text-neutral-500">Sealed Ledger Blocks</span>
          <div className="text-sm font-bold text-neutral-900 mt-1">
            {blocks.length} {blocks.length === 1 ? "Block" : "Blocks"}
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs">
          <span className="text-[11px] font-medium text-neutral-500">Field Effectiveness Audits</span>
          <div className="text-sm font-bold text-neutral-900 mt-1">
            {totalAudits} Sub-Transactions
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs">
          <span className="text-[11px] font-medium text-neutral-500">Compliance Standard</span>
          <div className="text-sm font-bold text-neutral-900 mt-1">
            DGMS / IOGP Life-Saving Rules
          </div>
        </div>
      </div>

      {/* ─── Blocks List ─── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 max-w-6xl mx-auto w-full">
        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white rounded-xl border border-neutral-200/80 animate-pulse" />
            ))}
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-neutral-200 p-8 space-y-2">
            <ShieldCheck className="h-8 w-8 mx-auto text-neutral-400" />
            <h3 className="text-sm font-bold text-neutral-800">No matching records found</h3>
            <p className="text-xs text-neutral-500">Try adjusting your search query or filter selection.</p>
          </div>
        ) : (
          filteredBlocks.map((block) => {
            const isTampered = integrityReport?.tamperedBlocks?.some((tb) => tb.blockId === block.blockId);
            const isGenesis = block.blockIndex === 0;

            return (
              <div
                key={block.blockId}
                className={cn(
                  "bg-white rounded-xl border transition-all duration-200 shadow-2xs p-5 space-y-3.5",
                  isTampered
                    ? "border-red-400 ring-1 ring-red-200 bg-red-50/20"
                    : "border-neutral-200/90 hover:border-neutral-300 hover:shadow-xs"
                )}
              >
                {/* Block Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-neutral-900">
                      Block #{block.blockIndex}
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      {block.blockId}
                    </span>
                    <span className="text-neutral-300">•</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(block.timestamp).toLocaleString()} IST
                    </span>

                    {isGenesis ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                        Genesis Anchor
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border",
                          isTampered
                            ? "bg-red-50 text-red-800 border-red-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", isTampered ? "bg-red-500" : "bg-emerald-500")} />
                        {isTampered ? "Payload Altered (Discrepancy)" : "Sealed & Verified"}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAuditTargetBlock(block)}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors shadow-2xs"
                    >
                      + Add Field Audit
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedBlock(block)}
                      className="px-2.5 py-1 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-2xs"
                    >
                      Inspect Details
                    </button>

                    {/* Subtle Demo Simulation Trigger */}
                    {!isGenesis && (
                      block._isSimulatedTamper ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreBlock(block.blockId)}
                          disabled={isSimulating}
                          className="text-[11px] text-emerald-700 hover:underline font-medium ml-1"
                        >
                          Restore Original
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSimulateTamper(block)}
                          disabled={isSimulating}
                          className="text-[11px] text-neutral-400 hover:text-neutral-700 hover:underline font-medium ml-1"
                          title="Simulate modifying database record to test audit detection"
                        >
                          Simulate Tamper
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Block Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left Column: Incident Observation & Approved Engineering Fix (7 cols) */}
                  <div className="lg:col-span-7 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>Incident Observation</span>
                        <span>{block.incidentPayload?.station || "Moran Rig #04"}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-neutral-900 mt-0.5">
                        {block.incidentPayload?.title || "Safety Precursor Observation"}
                      </h4>
                      <p className="text-xs text-neutral-600 mt-1 leading-relaxed bg-neutral-50 p-2.5 rounded-lg border border-neutral-200/60 font-sans">
                        {block.incidentPayload?.observation}
                      </p>
                    </div>

                    {/* Approved Preventative Engineering Fix (Natural Clean Enterprise Card) */}
                    <div className="bg-neutral-50/80 border border-neutral-200 rounded-lg p-3 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="font-semibold text-neutral-900">
                          Approved Preventative Engineering Fix
                        </span>
                        <span className="text-neutral-500 text-[11px]">
                          Auditor: <strong className="text-neutral-700 font-medium">{block.auditorName}</strong> ({block.auditorId})
                        </span>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed font-sans">
                        {block.approvedEngineeringFix}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Cryptographic Fingerprint & Field Audits (5 cols) */}
                  <div className="lg:col-span-5 space-y-2.5">
                    <div className="bg-neutral-50/80 border border-neutral-200 rounded-lg p-3 space-y-2 text-xs font-sans">
                      <div>
                        <div className="flex items-center justify-between text-neutral-500 text-[10px] font-bold uppercase tracking-wider">
                          <span>SHA-256 Block Hash</span>
                          <button
                            type="button"
                            onClick={() => handleCopyHash(block.ledger_hash)}
                            className="text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedHash === block.ledger_hash ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span>{copiedHash === block.ledger_hash ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-neutral-800 break-all bg-white p-2 rounded border border-neutral-200 select-all">
                          {block.ledger_hash}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-neutral-200/70">
                        <span className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider block">
                          Chained Predecessor Link
                        </span>
                        <div className="mt-1 font-mono text-[11px] text-neutral-500 break-all bg-white p-2 rounded border border-neutral-200 select-all">
                          {block.previousBlockHash}
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-600">
                        <span>Field Audits Appended:</span>
                        <span className="font-semibold text-neutral-800">
                          {block.effectivenessAudits?.length || 0} recorded
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tampered Warning Callout */}
                {isTampered && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="text-red-600 shrink-0" />
                      <span>
                        <strong>Integrity Discrepancy Flagged:</strong> Stored SHA-256 signature does not match recomputed payload.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreBlock(block.blockId)}
                      className="text-xs font-semibold underline hover:text-red-900"
                    >
                      Restore Block
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Block Inspection Drawer ─── */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-neutral-200 flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  Block Dossier: {selectedBlock.blockId}
                </h3>
                <p className="text-xs text-neutral-500">
                  Cryptographic verification parameters and root-cause evidence
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* 5-Whys Chain */}
              <div className="space-y-2 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
                  5-Whys Root Cause Analysis Chain
                </span>
                <div className="space-y-2 pl-2">
                  {selectedBlock.rcaFiveWhys?.map((why, idx) => (
                    <div key={idx} className="text-neutral-800 leading-relaxed font-medium">
                      {why}
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw JSON Canonical Payload */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
                  Deterministic Payload Record
                </span>
                <pre className="p-3 bg-neutral-50 text-neutral-800 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed border border-neutral-200">
                  {JSON.stringify(selectedBlock.incidentPayload, null, 2)}
                </pre>
              </div>

              {/* Linked Field Audits */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider block">
                  Field Effectiveness Audits ({selectedBlock.effectivenessAudits?.length || 0})
                </span>
                {(!selectedBlock.effectivenessAudits || selectedBlock.effectivenessAudits.length === 0) ? (
                  <p className="text-neutral-400 text-xs italic">No child audits appended yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedBlock.effectivenessAudits.map((a, i) => (
                      <div key={i} className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-neutral-900">{a.effectivenessScore}</span>
                          <span className="text-[10px] text-neutral-400">{new Date(a.auditedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-neutral-700">{a.auditFindings}</p>
                        <span className="text-[10px] font-mono text-neutral-400 block truncate">
                          Tx Hash: {a.transactionHash}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedBlock(null)}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Append Field Audit Modal ─── */}
      {auditTargetBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-neutral-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Append Field Audit</h3>
                <p className="text-xs text-neutral-500 font-mono">Target: {auditTargetBlock.blockId}</p>
              </div>
              <button
                type="button"
                onClick={() => setAuditTargetBlock(null)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitAudit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                  Effectiveness Score:
                </label>
                <div className="flex gap-2">
                  {(["Effective", "Minor Breach", "Ineffective"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAuditScore(s)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                        auditScore === s
                          ? s === "Effective"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : s === "Minor Breach"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-red-50 text-red-800 border-red-300"
                          : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  Inspector Verification Remarks:
                </label>
                <textarea
                  value={auditFindings}
                  onChange={(e) => setAuditFindings(e.target.value)}
                  placeholder="Record site observations, barrier condition, and test pull results..."
                  rows={3}
                  required
                  className="w-full text-xs p-3 rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAuditTargetBlock(null)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAudit || !auditFindings.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Send size={13} className={isSubmittingAudit ? "animate-spin" : ""} />
                  {isSubmittingAudit ? "Appending..." : "Append to Block"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
