"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  FileCheck2,
  History,
  Send,
} from "lucide-react";
import { CardData } from "@/types/concerns";
import { type UserSessionData } from "./auth-form-1";
import { cn } from "@/lib/utils";

interface RcaFiveWhysSectionProps {
  card: CardData;
  onCardUpdated?: (updatedCard: CardData) => void;
  currentManager?: UserSessionData | null;
}

export function RcaFiveWhysSection({
  card,
  onCardUpdated,
  currentManager,
}: RcaFiveWhysSectionProps) {
  const [loadingRca, setLoadingRca] = useState(false);
  const [rcaWhys, setRcaWhys] = useState<string[]>([]);
  const [engineeringFix, setEngineeringFix] = useState<string>("");
  const [isSealing, setIsSealing] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verifying" | "valid" | "tampered">("idle");
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [auditScore, setAuditScore] = useState<"Effective" | "Minor Breach" | "Ineffective">("Effective");
  const [auditFindings, setAuditFindings] = useState("");
  const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);
  const [auditSuccessMsg, setAuditSuccessMsg] = useState("");
  const [auditList, setAuditList] = useState<Array<{
    auditId: string;
    auditedAt: string;
    inspectorBadgeId: string;
    inspectorName: string;
    effectivenessScore: "Effective" | "Minor Breach" | "Ineffective";
    auditFindings: string;
    transactionHash: string;
  }>>([]);

  const isLocked = Boolean(card.ledgerLock?.isLocked || card.status === "Fix Deployed & Locked");
  const blockId = card.ledgerLock?.blockId;
  const ledgerHash = card.ledgerLock?.ledgerHash;

  // Load initial RCA or fetch automated 5-Whys
  useEffect(() => {
    if (card.ledgerLock?.fiveWhysRca && card.ledgerLock.fiveWhysRca.length > 0) {
      setRcaWhys(card.ledgerLock.fiveWhysRca);
      setEngineeringFix(card.ledgerLock.engineeringFix || "");
      return;
    }

    fetchAutomatedRca();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id, isLocked]);

  // If locked, fetch block details to display linked audits
  useEffect(() => {
    if (!isLocked || !blockId) return;

    const fetchBlockDetails = async () => {
      try {
        const res = await fetch("/api/ledger");
        const data = await res.json();
        if (data.success && Array.isArray(data.blocks)) {
          const found = data.blocks.find((b: { blockId: string }) => b.blockId === blockId);
          if (found && Array.isArray(found.effectivenessAudits)) {
            setAuditList(found.effectivenessAudits);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch block details:", err);
      }
    };
    fetchBlockDetails();
  }, [isLocked, blockId]);

  const fetchAutomatedRca = async () => {
    setLoadingRca(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_rca",
          hazard: card.hazard || card.title,
          failed_barrier: card.failed_barrier,
          observation: card.observation || card.description,
        }),
      });
      const data = await res.json();
      if (data.success && data.rca) {
        setRcaWhys(data.rca.fiveWhys || []);
        setEngineeringFix(data.rca.recommendedEngineeringFix || "");
      }
    } catch (err) {
      console.warn("Failed to generate automated RCA:", err);
    } finally {
      setLoadingRca(false);
    }
  };

  const handleSealToLedger = async () => {
    if (!engineeringFix.trim()) return;

    setIsSealing(true);
    try {
      const auditorId = currentManager?.badgeId || "OIL-MGR-1002";
      const auditorName = currentManager?.name || "Priyanka Bora";
      const auditorRole = currentManager?.designation || "HSE Operations Manager";

      const incidentPayload = {
        concernId: card.id,
        title: card.title,
        hazard: card.hazard || "Operational Safety Precursor",
        failedBarrier: card.failed_barrier || "Physical Barrier Control",
        observation: card.observation || card.description || card.title,
        sifScore: card.sif_score ?? (card.priority === "High" ? 85 : 50),
        iogpRule: card.iogp_rule || "IOGP Life-Saving Rules",
        station: card.reporter?.station || "Moran Rig #04 • Wellhead Section",
        reportedAt: card.reportedAt || card.date || "Sep 06, 2026 • 16:15 IST",
        reporterBadgeId: card.reporter?.badgeId || "OIL-FLD-5542",
      };

      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lock_and_seal",
          concernId: card.id,
          incidentPayload,
          rcaFiveWhys: rcaWhys,
          approvedEngineeringFix: engineeringFix,
          auditor: {
            id: auditorId,
            name: auditorName,
            role: auditorRole,
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.block) {
        const updatedCard: CardData = {
          ...card,
          status: "Fix Deployed & Locked",
          ledgerLock: {
            isLocked: true,
            blockIndex: data.block.blockIndex,
            blockId: data.block.blockId,
            ledgerHash: data.block.ledger_hash,
            lockedAt: data.block.timestamp,
            lockedByBadge: auditorId,
            lockedByName: auditorName,
            lockedByRole: auditorRole,
            fiveWhysRca: rcaWhys,
            engineeringFix: engineeringFix,
          },
        };
        onCardUpdated?.(updatedCard);
      }
    } catch (err) {
      console.error("Failed to seal fix to ledger:", err);
    } finally {
      setIsSealing(false);
    }
  };

  const handleVerifyBlockIntegrity = async () => {
    setVerifyStatus("verifying");
    try {
      const res = await fetch("/api/ledger?verify=true");
      const data = await res.json();
      if (data.success && data.integrity) {
        const isThisBlockCompromised = data.integrity.tamperedBlocks?.some(
          (tb: { blockId: string }) => tb.blockId === blockId
        );
        setVerifyStatus(isThisBlockCompromised ? "tampered" : "valid");
      } else {
        setVerifyStatus("valid");
      }
    } catch {
      setVerifyStatus("valid");
    }
  };

  const handleCopyHash = () => {
    if (!ledgerHash) return;
    navigator.clipboard.writeText(ledgerHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleAppendAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockId || !auditFindings.trim()) return;

    setIsSubmittingAudit(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "append_audit",
          blockId,
          inspector: {
            badgeId: currentManager?.badgeId || "OIL-INSP-304",
            name: currentManager?.name || "HSE Rig Field Inspector",
            station: card.reporter?.station || "Moran Rig #04",
            effectivenessScore: auditScore,
            findings: auditFindings.trim(),
          },
        }),
      });

      const data = await res.json();
      if (data.success && data.auditTransaction) {
        setAuditList((prev) => [...prev, data.auditTransaction]);
        setAuditSuccessMsg(`Field audit recorded with score '${auditScore}'.`);
        setAuditFindings("");
        setShowAuditForm(false);
        setTimeout(() => setAuditSuccessMsg(""), 4000);
      }
    } catch (err) {
      console.warn("Failed to append audit:", err);
    } finally {
      setIsSubmittingAudit(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* ─── Lock & Verification Status Card ─── */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className={isLocked ? "text-emerald-600" : "text-neutral-500"} />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                5-Whys Root Cause Analysis & Engineering Lock
              </h4>
              <p className="text-[11px] text-neutral-500">
                {isLocked
                  ? `Sealed in Block ${card.ledgerLock?.blockId} • DGMS / OSHA Compliance Verified`
                  : "Review systemic root causes and preventative engineering fix before sealing"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Fix Deployed & Locked
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                Draft Mitigation
              </span>
            )}

            {isLocked && ledgerHash && (
              <button
                type="button"
                onClick={handleVerifyBlockIntegrity}
                disabled={verifyStatus === "verifying"}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 cursor-pointer",
                  verifyStatus === "valid"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : verifyStatus === "tampered"
                    ? "bg-red-50 text-red-800 border-red-200"
                    : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                )}
                title="Verify SHA-256 block hash against payload"
              >
                <FileCheck2 size={12} className={verifyStatus === "verifying" ? "animate-spin" : ""} />
                <span>
                  {verifyStatus === "verifying"
                    ? "Verifying..."
                    : verifyStatus === "valid"
                    ? "Signature Valid"
                    : verifyStatus === "tampered"
                    ? "Discrepancy"
                    : "Verify Hash"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Cryptographic Hash Bar if Locked */}
        {isLocked && ledgerHash && (
          <div className="bg-neutral-50 border border-neutral-200/80 rounded-lg p-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-neutral-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Cryptographic Block Signature (SHA-256)</span>
              <button
                type="button"
                onClick={handleCopyHash}
                className="text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
              >
                {copiedHash ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>{copiedHash ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="font-mono text-[11px] text-neutral-800 break-all select-all">
              {ledgerHash}
            </div>
          </div>
        )}

        {auditSuccessMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" /> {auditSuccessMsg}
          </div>
        )}
      </div>

      {/* ─── 5-Whys Root Cause Analysis Visual List ─── */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              5-Whys Root Cause Analysis (RCA)
            </h4>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Fault isolation protocol aligned with IOGP Life-Saving Rules
            </p>
          </div>

          {!isLocked && (
            <button
              type="button"
              onClick={fetchAutomatedRca}
              disabled={loadingRca}
              className="p-1.5 text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors"
              title="Regenerate 5-Whys"
            >
              <RefreshCw size={13} className={loadingRca ? "animate-spin" : ""} />
            </button>
          )}
        </div>

        {loadingRca ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {rcaWhys.map((why, idx) => {
              const isRootCause = idx === rcaWhys.length - 1;
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    isRootCause
                      ? "bg-neutral-50/90 border-neutral-300"
                      : "bg-neutral-50/50 border-neutral-200/70"
                  )}
                >
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5",
                      isRootCause
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-200 text-neutral-700"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider block",
                        isRootCause ? "text-neutral-900" : "text-neutral-500"
                      )}
                    >
                      {isRootCause ? "Root Cause (Systemic Barrier Failure)" : `Why Level ${idx + 1}`}
                    </span>
                    <p className="text-xs text-neutral-800 font-medium leading-relaxed mt-0.5">{why}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Approved Preventative Engineering Fix ─── */}
      <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Approved Preventative Engineering Fix
            </h4>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Engineering barrier action required prior to task resumption
            </p>
          </div>
          {isLocked && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
              Locked Record
            </span>
          )}
        </div>

        {isLocked ? (
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-800 leading-relaxed font-medium">
            {engineeringFix || card.ledgerLock?.engineeringFix}
          </div>
        ) : (
          <textarea
            value={engineeringFix}
            onChange={(e) => setEngineeringFix(e.target.value)}
            rows={3}
            placeholder="Specify exact preventative engineering fix, barrier retrofit, or hardware lockout required..."
            className="w-full text-xs p-3 rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 leading-relaxed font-sans"
          />
        )}

        {/* Lock Trigger Button if not locked */}
        {!isLocked && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100">
            <span className="text-[11px] text-neutral-500">
              Auditor Signoff: <strong className="text-neutral-800">{currentManager?.name || "Priyanka Bora"}</strong> ({currentManager?.badgeId || "OIL-MGR-1002"})
            </span>

            <button
              type="button"
              onClick={handleSealToLedger}
              disabled={isSealing || !engineeringFix.trim()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Lock size={12} className={isSealing ? "animate-spin" : ""} />
              <span>{isSealing ? "Sealing to FixLedger..." : "Approve 5-Whys & Seal Fix"}</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── Closed-Loop Tracking: Field Effectiveness Audits ─── */}
      {isLocked && (
        <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <History size={15} className="text-neutral-500" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                  Field Effectiveness Audits
                </h4>
                <p className="text-[11px] text-neutral-500">
                  Subsequent site verification scores appended as linked transactions
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAuditForm(!showAuditForm)}
              className="px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
            >
              {showAuditForm ? "Cancel" : "+ Append Field Audit"}
            </button>
          </div>

          {/* Audit Appending Form */}
          {showAuditForm && (
            <form onSubmit={handleAppendAudit} className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1.5">Effectiveness Score:</label>
                <div className="flex gap-2">
                  {(["Effective", "Minor Breach", "Ineffective"] as const).map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setAuditScore(score)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
                        auditScore === score
                          ? score === "Effective"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : score === "Minor Breach"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-red-50 text-red-800 border-red-300"
                          : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                      )}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  value={auditFindings}
                  onChange={(e) => setAuditFindings(e.target.value)}
                  placeholder="Record site observations, barrier condition, and test results..."
                  rows={2}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-900 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingAudit || !auditFindings.trim()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send size={12} className={isSubmittingAudit ? "animate-spin" : ""} />
                  <span>{isSubmittingAudit ? "Submitting..." : "Append Audit"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Audit Transactions List */}
          {auditList.length === 0 ? (
            <p className="text-neutral-400 text-xs text-center py-3 italic">
              No field audits recorded yet. Click &ldquo;+ Append Field Audit&rdquo; to add site verification.
            </p>
          ) : (
            <div className="space-y-2">
              {auditList.map((audit, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/80 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-semibold border",
                          audit.effectivenessScore === "Effective"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : audit.effectivenessScore === "Minor Breach"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-red-50 text-red-800 border-red-200"
                        )}
                      >
                        {audit.effectivenessScore}
                      </span>
                      <span className="font-medium text-neutral-800">
                        {audit.inspectorName} ({audit.inspectorBadgeId})
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {new Date(audit.auditedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-neutral-700 leading-relaxed">{audit.auditFindings}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
