"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Radio,
  Clock,
  MapPin,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Printer,
  CheckCircle2,
  Phone,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { CardData } from "@/lib/concerns";
import { mapToLifeSavingRule } from "@/lib/lsr";
import { type UserSessionData } from "./auth-form-1";
import {
  CompactProfileCard,
  type SocialLink,
} from "./animated-profile-card";
import { RcaFiveWhysSection } from "./rca-five-whys-section";

interface CardDetailModalProps {
  card: CardData | null;
  columnTitle: string;
  columnId: string;
  onClose: () => void;
  onMoveColumn: (cardId: string, targetColId: string) => void;
  onDeleteCard?: (colId: string, cardId: string) => void;
  currentManager?: UserSessionData | null;
}

function getCleanObservation(card: CardData): string {
  const obs = card.observation || "";
  if (obs.includes("|")) {
    const match = obs.match(/Observation:\s*(.+)$/i);
    if (match) return match[1].trim();
    const parts = obs.split("|").map((s) => s.trim());
    const lastPart = parts[parts.length - 1];
    if (lastPart.toLowerCase().startsWith("observation:")) {
      return lastPart.replace(/^observation:\s*/i, "").trim();
    }
    if (card.evidence_quote) {
      return card.evidence_quote;
    }
  }
  return obs || card.description || "No observation narrative recorded.";
}

// Persistent suggestions cache per card ID so suggestions stay completely stable and don't re-fetch on poll
const suggestionCache = new Map<string, string[]>();

export function CardDetailModal({
  card,
  columnTitle,
  columnId,
  onClose,
  onMoveColumn,
  onDeleteCard,
  currentManager,
}: CardDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedPlan, setCopiedPlan] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const cardId = card?.id;

  // Load or fetch suggestions once per card ID
  useEffect(() => {
    if (!cardId || !card) return;

    // 1. If card already has suggestions attached
    if (card.llmSuggestions && card.llmSuggestions.length > 0) {
      setSuggestions(card.llmSuggestions);
      suggestionCache.set(cardId, card.llmSuggestions);
      return;
    }

    // 2. If cached in memory for this card
    const cached = suggestionCache.get(cardId);
    if (cached && cached.length > 0) {
      setSuggestions(cached);
      return;
    }

    // 3. Otherwise fetch once
    fetchSuggestions(false);
  }, [cardId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const fetchSuggestions = async (forceRefresh = false) => {
    if (!card) return;
    if (!forceRefresh && cardId && suggestionCache.has(cardId)) {
      setSuggestions(suggestionCache.get(cardId)!);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hazard: card.hazard || card.title,
          failed_barrier: card.failed_barrier,
          observation: getCleanObservation(card),
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        if (cardId) {
          suggestionCache.set(cardId, data.suggestions);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  if (!card) return null;

  const sifScore =
    card.sif_score ?? (card.priority === "High" ? 85 : card.priority === "Medium" ? 50 : 25);

  const getSifColor = (score: number) => {
    if (score >= 70)
      return { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500" };
    if (score >= 40)
      return { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500" };
    return { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500" };
  };

  const sifColor = getSifColor(sifScore);
  const cleanObsText = getCleanObservation(card);
  const lsr = mapToLifeSavingRule(card.hazard, card.failed_barrier, cleanObsText);

  // Field Observer Profile Data
  const reporterName = card.reporter?.name || "Field Officer";
  const reporterInitials =
    reporterName
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "FO";
  const reporterAvatar =
    card.reporter?.avatarUrl ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
  const reporterStation = card.reporter?.station || "Moran Rig #04 • Wellhead Section";
  const reporterBadge = card.reporter?.badgeId || "OIL-FLD-5542";
  const reporterRole = card.reporter?.role || "HSE Field Safety Officer (Derrick Floor)";
  const reporterBio = `${reporterRole}. Assigned to rig observations, SIF precursor detection, and hazard mitigation at ${reporterStation}. Logged on ${card.reportedAt || card.date || "Sep 06, 2026 • 16:15 IST"}.`;

  const reporterSocials: SocialLink[] = [
    {
      id: "radio",
      url: "#",
      label: `Radio: ${card.reporter?.radioChannel || "UHF CH-04"}`,
      icon: <Radio className="h-4 w-4" />,
    },
    {
      id: "phone",
      url: `tel:${card.reporter?.phone || "+919435044521"}`,
      label: `Call: ${card.reporter?.phone || "+91 94350 44521"}`,
      icon: <Phone className="h-4 w-4" />,
    },
    {
      id: "email",
      url: `mailto:${card.reporter?.email || "lav.kumar@oilindia.in"}`,
      label: `Email: ${card.reporter?.email || "lav.kumar@oilindia.in"}`,
      icon: <Mail className="h-4 w-4" />,
    },
  ];

  // Reviewing HSE Manager Profile Data (if assigned)
  const managerName = card.reviewer?.name || "";
  const managerInitials =
    managerName
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "MGR";
  const managerAvatar =
    card.reviewer?.avatarUrl ||
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80";
  const managerStation = card.reviewer?.station || "Duliajan Corporate HQ";
  const managerBadge = card.reviewer?.badgeId || "OIL-MGR";
  const managerRole =
    card.reviewer?.role ||
    "HSE Operations Manager";
  const managerBio = `${managerRole}. Authorized HSE Manager approving barrier verifications, SIF mitigation controls, and stage audits across ${managerStation}.`;

  const managerSocials: SocialLink[] = [
    {
      id: "radio",
      url: "#",
      label: `Command Freq: ${card.reviewer?.radioChannel || "COMMAND CH-01"}`,
      icon: <Radio className="h-4 w-4" />,
    },
    {
      id: "phone",
      url: `tel:${card.reviewer?.phone || "+913742804501"}`,
      label: `Direct: ${card.reviewer?.phone || "+91 374 280 4501"}`,
      icon: <Phone className="h-4 w-4" />,
    },
    {
      id: "email",
      url: `mailto:${card.reviewer?.email || "hse@oilindia.in"}`,
      label: `Email: ${card.reviewer?.email || "hse@oilindia.in"}`,
      icon: <Mail className="h-4 w-4" />,
    },
  ];

  const handleCopySummary = () => {
    const text = `[OIL INDIA HSE REPORT]\nIssue: ${card.title}\nSeverity: SIF ${sifScore}/100\nHazard: ${card.hazard || "N/A"}\nFailed Barrier: ${card.failed_barrier || "N/A"}\nReported by: ${card.reporter?.name || "Field Officer"} (${card.reportedAt || card.date})\nObservation: ${cleanObsText}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPlan = () => {
    const text = suggestions.map((s, idx) => `Step ${idx + 1}: ${s}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 overflow-hidden bg-neutral-950/60 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-5xl h-full max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-neutral-200/90 flex flex-col overflow-hidden font-sans"
        >
          {/* Top Bar / Header */}
          <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80 shrink-0">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-red-100 text-red-800 border border-red-200">
                OIL INDIA HSE • INCIDENT DOSSIER
              </span>
              <span className="text-xs font-semibold text-neutral-500">
                Stage: <span className="text-neutral-800 font-bold">{columnTitle}</span>
              </span>
              <span className="text-xs font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                REF: #{card.id.slice(-6).toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors shadow-2xs"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy Brief"}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors shadow-2xs hidden sm:inline-flex"
              >
                <Printer size={14} /> Print
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/60 transition-colors ml-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title & Top Metrics */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-neutral-100">
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  {card.priority && (
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase ${
                        card.priority === "High"
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : card.priority === "Medium"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                    >
                      {card.priority} Priority
                    </span>
                  )}
                  {card.tags?.map((tag, idx) => {
                    const fullTagLabel =
                      tag.label.endsWith("...") && card.hazard
                        ? card.hazard.replace(/\(.*\)/, "").trim()
                        : tag.label;
                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${tag.dotColor}`} />
                        {fullTagLabel}
                      </span>
                    );
                  })}
                  {card.inference_engine && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                        card.inference_engine === "modal"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-blue-50 text-blue-800 border-blue-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          card.inference_engine === "modal" ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                      />
                      {card.inference_engine === "modal" ? "Fine-Tuned SLM (Modal)" : "Edge Ollama (Local)"}
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight leading-snug">
                  {card.title.endsWith("...") && card.observation
                    ? card.hazard
                      ? `${card.hazard} — ${card.observation}`
                      : card.observation
                    : card.title}
                </h2>
              </div>

              {/* SIF Density Gauge Badge */}
              <div
                className={`shrink-0 p-3.5 rounded-xl border ${sifColor.border} ${sifColor.bg} flex flex-col items-center justify-center text-center min-w-[150px] shadow-2xs`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  SIF Precursor Density
                </span>
                <div className="flex items-baseline gap-1 my-0.5">
                  <span className={`text-2xl font-black ${sifColor.text}`}>{sifScore}</span>
                  <span className="text-xs font-semibold text-neutral-400">/100</span>
                </div>
                <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${sifColor.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(100, sifScore)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold mt-1.5 ${sifColor.text}`}>
                  {sifScore >= 70
                    ? "CRITICAL SIF RISK"
                    : sifScore >= 40
                    ? "MODERATE SIF RISK"
                    : "CONTROLLED SIF RISK"}
                </span>
              </div>
            </div>

            {/* 2-Column Responsive Body */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (Reporter Profile & Observation Narrative) - 5 cols */}
              <div className="lg:col-span-5 space-y-4">
                {/* Field Observer Compact Profile Card */}
                <CompactProfileCard
                  badgeTitle="Field Observer Profile"
                  badgeId={reporterBadge}
                  name={reporterName}
                  role={reporterRole}
                  location={`${reporterStation} • ${card.reportedAt || card.date || "Sep 06, 2026 • 16:15 IST"}`}
                  bio={`SIF Precursor Monitor • Logged observation & barrier condition alert at ${reporterStation}.`}
                  avatarSrc={reporterAvatar}
                  avatarFallback={reporterInitials}
                  socials={reporterSocials}
                  themeVariant="emerald"
                />

                {/* Field Observation Narrative */}
                <div className="bg-white border border-neutral-200 rounded-xl p-3.5 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Field Observation
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      REF #{card.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-relaxed font-sans bg-neutral-50/70 p-2.5 rounded-lg border border-neutral-200/60">
                    {cleanObsText}
                  </p>
                </div>

                {/* Reviewing HSE Manager Compact Profile Card / Pending Assignment */}
                {card.reviewer ? (
                  <CompactProfileCard
                    badgeTitle="Reviewing HSE Manager"
                    badgeId={managerBadge}
                    badgeIcon={<ShieldCheck size={14} className="text-blue-600" />}
                    name={managerName}
                    role={managerRole}
                    location={`${managerStation} • Active Reviewer`}
                    bio={`HSE Process Lead • Reviewing barrier restoration, work-order clearances, and audit workflows.`}
                    avatarSrc={managerAvatar}
                    avatarFallback={managerInitials}
                    socials={managerSocials}
                    themeVariant="blue"
                  />
                ) : (
                  <div className="bg-white border border-dashed border-neutral-300 rounded-xl p-4 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Reviewing HSE Manager
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Pending Assignment
                      </span>
                    </div>
                    <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200/80 flex items-center justify-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                        AWAITING FOR MANAGER REVIEW
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (Structured AI Extraction & Recommendations) - 7 cols */}
              <div className="lg:col-span-7 space-y-4">
                {/* Official IOGP Life-Saving Rule (LSR) Alignment Card */}
                <div className="bg-white border border-neutral-200/90 rounded-xl p-4 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      IOGP Life-Saving Rule Alignment
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${lsr.badgeBg} ${lsr.badgeText} ${lsr.badgeBorder}`}
                    >
                      {lsr.shortLabel}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 leading-tight">
                      Rule #{lsr.number}: {lsr.name}
                    </h4>
                    <p className="text-xs italic text-neutral-600 mt-1 leading-relaxed pl-2.5 border-l-2 border-neutral-300">
                      &ldquo;{lsr.mandate}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Structured Safety Classification Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Primary Hazard Card */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                          Primary Hazard
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                          Class A
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900 leading-snug pt-1">
                        {card.hazard || "Operational Hazard"}
                      </h4>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-2 font-medium">
                      IOGP Life-Saving Rules Core Domain
                    </span>
                  </div>

                  {/* Breached Barrier Card */}
                  <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                          Breached Barrier System
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                          Failed
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900 leading-snug pt-1">
                        {card.failed_barrier || "Safety Barrier Control"}
                      </h4>
                    </div>
                    <span className="text-[10px] text-red-600 font-semibold mt-2">
                      Physical / Administrative Defense Compromised
                    </span>
                  </div>
                </div>

                {/* 4. Root Cause Analysis (5 Whys) & Cryptographic Lock */}
                <div className="space-y-2 mt-6">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800">
                      ROOT CAUSE ANALYSIS & SEAL
                    </h3>
                  </div>
                  <RcaFiveWhysSection
                    card={card}
                    currentManager={currentManager}
                  />
                </div>

                {/* Corrective Actions & Recommendations (Clean White Enterprise Card) */}
                <div className="bg-white border border-neutral-200/90 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold tracking-tight text-neutral-900">
                          Corrective Actions & Safety Recommendations
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                          safety-phi3
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Actionable field restoration steps for site supervisors
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyPlan}
                        className="px-2.5 py-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-200 flex items-center gap-1 shadow-2xs"
                        title="Copy suggestions"
                      >
                        {copiedPlan ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        {copiedPlan ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => fetchSuggestions(true)}
                        disabled={loadingSuggestions}
                        className="p-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-200 disabled:opacity-50 shadow-2xs"
                        title="Regenerate tips from Ollama"
                      >
                        <RefreshCw
                          size={14}
                          className={loadingSuggestions ? "animate-spin text-neutral-700" : ""}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Suggestions List in Clean White/Neutral Style */}
                  {loadingSuggestions ? (
                    <div className="space-y-2.5 py-1">
                      <div className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
                      <div className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
                      <div className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {suggestions.map((step, idx) => (
                        <div
                          key={idx}
                          className="bg-neutral-50 border border-neutral-200/80 rounded-lg p-3.5 flex items-start gap-3 hover:border-neutral-300 transition-colors"
                        >
                          <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-800 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                              {step}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-400 border-t border-neutral-100">
                    <span>OIL India HSE Standard Operating Guidelines</span>
                    <span className="text-neutral-600 font-semibold">Zero SIF Target 2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Sticky Action Bar */}
          <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-500">Quick Workflow Transitions:</span>
              {columnId !== "col-1" && (
                <button
                  type="button"
                  onClick={() => onMoveColumn(card.id, "col-1")}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors shadow-2xs"
                >
                  Move to To Do
                </button>
              )}
              {columnId !== "col-2" && (
                <button
                  type="button"
                  onClick={() => onMoveColumn(card.id, "col-2")}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  Move to In Progress <ArrowRight size={13} />
                </button>
              )}
              {columnId !== "col-3" && (
                <button
                  type="button"
                  onClick={() => onMoveColumn(card.id, "col-3")}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 size={13} /> Mark Resolved / Done
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onDeleteCard && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteCard?.(columnId, card.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete Issue
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
              >
                Close View
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
